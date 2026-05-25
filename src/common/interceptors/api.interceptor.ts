/* ============================================================================
 * NestJS Interceptors — concept reference
 * ============================================================================
 *
 * WHY INTERCEPTORS EXIST (the problem)
 * ------------------------------------
 * Real APIs are full of logic that doesn't belong inside any single controller
 * method, yet has to run on many of them:
 *   - Logging request duration, trace IDs, metrics.
 *   - Wrapping every response in a consistent envelope like { ok, data }.
 *   - Caching successful responses, enforcing timeouts, retrying.
 *   - Translating thrown errors into specific HTTP responses uniformly.
 *
 * Without a dedicated mechanism this leaks into every handler as copy-pasted
 * boilerplate. The other Nest building blocks don't fit either:
 *   - Middleware runs before the handler and has no access to the return value.
 *   - Filters only fire on exceptions.
 *   - Pipes only transform inputs.
 *   - Guards only decide allow/deny.
 * None of them can wrap behavior AROUND a handler — observing inputs, the
 * result, and reshaping the response stream.
 *
 *
 * HOW THEY SOLVE IT (the mechanism)
 * ---------------------------------
 * An interceptor is a class implementing intercept(context, next) that Nest
 * inserts between the request pipeline and the route handler. Mental model:
 * it is a WRAPPER that can run code before the handler, after the handler, on
 * the value the handler produced, and even instead of calling the handler.
 *
 * The key idea is that next.handle() returns an RxJS Observable representing
 * the future result of the handler. This unlocks four things:
 *   1. Pre-handler work — anything before next.handle() runs first
 *      (start timer, attach request ID).
 *   2. Post-handler work — .pipe(tap(...)) runs side effects after the
 *      handler resolves without changing the value (logging, metrics).
 *   3. Transformation — .pipe(map(...)) rewrites the response shape on the
 *      way out (response envelope).
 *   4. Short-circuit / error mapping — catchError, timeout, or returning a
 *      different observable entirely lets you skip the handler (cache hit)
 *      or translate errors.
 *
 * Interceptors can be bound at four scopes — global, module, controller, or
 * single handler — and they NEST LIKE RUSSIAN DOLLS: the outermost runs its
 * pre-code first and its post-code last. For a request with [A, B]:
 *   1. A pre-code runs
 *   2. B pre-code runs
 *   3. Handler executes
 *   4. B's .pipe(...) operators run (closer to handler runs first)
 *   5. A's .pipe(...) operators run last
 * That reverse order lets an outer interceptor measure total time including
 * everything inner interceptors do.
 *
 * Tradeoff: the API is observable-based, so you need a basic grasp of RxJS
 * operators. For purely synchronous use cases this can feel heavyweight.
 * ========================================================================== */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, map, tap } from 'rxjs';

// INTERCEPTOR — wraps every controller response in a standard ApiResponse shape
// and logs method, url, and duration for every request.
//
// WHY INTERCEPTOR AND NOT CONTROLLER?
// Without this, every controller method manually returns { ok: true, data: ... }.
// This interceptor centralizes that so controllers just return raw data.
//
// EXECUTION ORDER:
//   Request → intercept() runs (before block) → controller runs
//           → next.handle() emits response → tap() logs → map() wraps → client receives

// @Injectable() — marks the class as a Nest provider so the DI container can
// construct it and inject dependencies (loggers, cache clients, config).
@Injectable()
// implements NestInterceptor — the contract forcing the intercept() signature
// Nest expects to call.
export class ApiInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  // intercept(context, next) — the single entry point Nest invokes per request.
  //   context: ExecutionContext — runtime info about WHAT is being called:
  //     handler, controller class, transport type (HTTP/WS/gRPC), and
  //     accessors like context.switchToHttp().getRequest(). Use it to read
  //     headers, set metadata, or pull data passed via reflectors/decorators.
  //   next: CallHandler — thin wrapper around the actual route handler.
  //     Calling next.handle() runs the handler and returns an Observable of
  //     its result.
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // ---- PRE-HANDLER slot -------------------------------------------------
    // Anything before next.handle() runs first. Here we capture the request
    // details and start time; both are held in closure so the post-handler
    // step can use them.
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
    }>();
    const { method, url } = request;
    const start = Date.now();

    // return next.handle().pipe(...) — next.handle() executes the handler and
    // returns the result as an Observable. You MUST return this observable —
    // Nest subscribes to it to send the HTTP response. Forgetting `return`
    // makes the request hang forever.
    return next.handle().pipe(
      // ---- POST-HANDLER side effect --------------------------------------
      // tap is a side-effect-only operator: it runs the callback when the
      // observable emits a value but doesn't change the value. Perfect for
      // logging, metrics, audit trails.
      tap(() => {
        const end = Date.now();
        this.logger.log(
          `${method} ${url} | start: ${start}ms | end: ${end}ms | duration: ${end - start}ms`,
        );
      }),

      // ---- TRANSFORMATION ------------------------------------------------
      // map replaces the handler's return value with a new shape — the
      // response Nest serializes is now this wrapped object, not the
      // original. Every handler in scope of this interceptor gets the
      // envelope without knowing about it.
      //
      // `data` here is the raw value returned by the controller method.
      map((data: unknown) => ({ ok: true, data })),

      // ---- OTHER COMMON OPERATORS (not used here, kept for reference) ----
      // catchError(err => throwError(() => new BadGatewayException()))
      //   Intercepts errors thrown inside the handler (or upstream
      //   interceptors) and replaces them. Useful for converting low-level
      //   exceptions (e.g. a DB driver error) into a clean HTTP error.
      //
      // SHORT-CIRCUIT pattern (cache hit):
      //   const cached = this.cache.get(key);
      //   if (cached) return of(cached);   // never calls next.handle()
      //   return next.handle().pipe(tap(value => this.cache.set(key, value)));
      // of(cached) creates an Observable that emits the cached value
      // immediately. Because next.handle() is never called, the route
      // handler doesn't run — the response comes entirely from the
      // interceptor.
    );
  }
}

/* ============================================================================
 * BINDING AN INTERCEPTOR
 * ============================================================================
 * @UseInterceptors(ApiInterceptor) attaches the interceptor.
 *   - On a controller class  → applies to every handler in it.
 *   - On a single method     → only that handler.
 *   - In a module's providers as:
 *       { provide: APP_INTERCEPTOR, useClass: ApiInterceptor }
 *     → applied globally with full DI support (preferred over
 *       app.useGlobalInterceptors() when the interceptor depends on
 *       injected services).
 * ========================================================================== */
