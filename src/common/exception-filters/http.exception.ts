/* ============================================================================
 * NestJS Exception Filters — concept reference
 * ============================================================================
 *
 * WHY EXCEPTION FILTERS EXIST (the problem)
 * -----------------------------------------
 * Errors happen everywhere in a backend — validation failures, missing
 * records, busted DB connections, unauthorized access, third-party API
 * blowups. Without a dedicated mechanism for handling them you end up with:
 *   - try/catch in every controller, each formatting an error response
 *     slightly differently. Inconsistent shapes — { error: "..." } here,
 *     { message: "..." } there.
 *   - Sensitive information leaks — raw stack traces or DB driver messages
 *     go straight to the client.
 *   - Cross-cutting needs duplicated everywhere — logging the error, tagging
 *     it with a request ID, mapping internal exception types to HTTP status
 *     codes. None of that belongs in business logic.
 *
 * Nest's other building blocks don't fit: middleware/guards/pipes/interceptors
 * all run BEFORE or AROUND the handler, not specifically when something
 * throws. Interceptors can use catchError, but they catch everything in their
 * pipe — there's no clean way to say "this filter handles only
 * EntityNotFoundError globally."
 *
 *
 * HOW THEY SOLVE IT (the mechanism)
 * ---------------------------------
 * An exception filter is a class implementing catch(exception, host),
 * decorated with @Catch(...) to declare which exception types it handles.
 * Nest maintains an internal exceptions layer: when ANYTHING in the request
 * lifecycle throws (controller, service, pipe, guard, interceptor), Nest
 * unwinds the stack into this layer, finds the most specific matching
 * filter, and gives it full control over the response.
 *
 * Mental model: filters are a TYPED try/catch mounted on the framework
 * boundary. You declare "handle exception type X" once, and Nest routes
 * every throw of that type (or its subclasses) to your filter, regardless
 * of where in the codebase it was thrown.
 *
 * Key properties:
 *   - ArgumentsHost — same abstraction interceptors/guards use. Hands you
 *     the underlying request/response so the filter works for HTTP, WS, and
 *     microservices with minor branching.
 *   - Filter resolution — Nest picks the most specific filter matching the
 *     thrown exception's class hierarchy. A filter for HttpException catches
 *     all its subclasses (NotFoundException, BadRequestException, …) unless
 *     a more specific filter exists.
 *   - Built-in HttpException family — most of the time you don't write a
 *     filter; you `throw new NotFoundException('user not found')` and Nest's
 *     built-in filter formats it correctly. You write a custom filter when
 *     you need a different shape, want to handle non-HttpException errors
 *     (e.g. ORM exceptions), or want side effects like logging.
 *
 * EXECUTION ORDER
 *   1. Exception bubbles up through the controller/service/pipe/guard/interceptor.
 *   2. Any interceptor.catchError(...) wrappers in the active pipe get first
 *      crack — they can swallow or transform the exception.
 *   3. If not handled, Nest's exceptions layer locates the most specific
 *      filter matching the exception type.
 *   4. The filter's catch() runs and writes the response. The request ends here.
 *
 * Tradeoff: filters terminate the request — once one fires, the handler is
 * dead and no interceptor's post-code runs on the original value. Use them
 * for exception handling, not control flow.
 * ========================================================================== */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// @Catch(HttpException) — declares the exception type(s) this filter handles.
// You can pass multiple (e.g. @Catch(HttpException, ValidationError)) or none
// (@Catch()) to catch everything. The class hierarchy matters: this filter
// catches HttpException AND all its subclasses (BadRequestException,
// ForbiddenException, NotFoundException, etc.).
@Catch(HttpException)
// implements ExceptionFilter — contract forcing the catch(exception, host)
// signature Nest invokes.
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  // catch(exception, host) — the entry point Nest invokes when a matching
  // exception reaches this filter.
  //   exception: HttpException — the actual error object that was thrown.
  //     Typed to whatever you passed to @Catch().
  //   host: ArgumentsHost — same context abstraction interceptors use; lets
  //     you target HTTP, WS, or RPC transports.
  catch(exception: HttpException, host: ArgumentsHost) {
    // host.switchToHttp() — narrows the host to the HTTP transport so you can
    // pull getResponse() and getRequest(). Branch on host.getType() if the
    // filter must support multiple transports.
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // exception.getStatus() / exception.getResponse() — methods specific to
    // HttpException. getStatus() returns the HTTP code (404, 400, …);
    // getResponse() returns the message payload (string or object — e.g. for
    // ValidationPipe errors it's { message: string[], error, statusCode }).
    const status = exception.getStatus();
    const payload = exception.getResponse();

    // Side effect: log every handled error. Centralized here so individual
    // handlers stay clean. You can also push to Sentry/Datadog from this spot.
    this.logger.warn(
      `${request.method} ${request.url} → ${status} :: ${JSON.stringify(payload)}`,
    );

    // Normalize the error message. Payload may be a plain string, an object
    // with a string `message`, or — for ValidationPipe errors — an object
    // whose `message` is a string[]. Falling back to exception.message keeps
    // shapes we don't recognize from blowing up.
    const error =
      typeof payload === 'string'
        ? payload
        : ((payload as { message?: string | string[] }).message ??
          exception.message);

    // response.status(status).json(...) — manually writes the HTTP response.
    // Once this is called, the request is done — the original handler's
    // return value is discarded. The unified shape (ok: false, path,
    // timestamp) is the value of having a filter: every error in the app
    // looks identical from the client's side.
    response.status(status).json({
      ok: false,
      statusCode: status,
      path: request.url,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}

/* ============================================================================
 * WIRING THIS FILTER UP
 * ============================================================================
 * Same four binding scopes as interceptors. Pick the narrowest scope that
 * fits the filter's responsibility.
 *
 * 1. Per handler (single route only)
 * ----------------------------------
 *   import { UseFilters } from '@nestjs/common';
 *   import { HttpExceptionFilter } from './common/exception-filters/http.exception';
 *
 *   @Get(':id')
 *   @UseFilters(HttpExceptionFilter)
 *   findOne(@Param('id') id: string) { ... }
 *
 *
 * 2. Per controller (every route in the controller)
 * -------------------------------------------------
 *   @Controller('users')
 *   @UseFilters(HttpExceptionFilter)
 *   export class UsersController { ... }
 *
 *
 * 3. Globally via module providers (PREFERRED for app-wide use)
 * ------------------------------------------------------------
 * Use this when you want the filter applied to every route AND the filter
 * needs DI (logger, config service, Sentry client, etc.). Nest will
 * instantiate it through the DI container.
 *
 *   // app.module.ts
 *   import { APP_FILTER } from '@nestjs/core';
 *   import { HttpExceptionFilter } from './common/exception-filters/http.exception';
 *
 *   @Module({
 *     providers: [
 *       { provide: APP_FILTER, useClass: HttpExceptionFilter },
 *     ],
 *   })
 *   export class AppModule {}
 *
 *
 * 4. Globally via bootstrap (no DI)
 * ---------------------------------
 * Simpler but the filter is instantiated outside the DI container, so it
 * can't inject Nest providers. Fine for filters with no dependencies.
 *
 *   // main.ts
 *   import { HttpExceptionFilter } from './common/exception-filters/http.exception';
 *
 *   const app = await NestFactory.create(AppModule);
 *   app.useGlobalFilters(new HttpExceptionFilter());
 *   await app.listen(3000);
 *
 *
 * NOTES ON COMPOSITION
 * --------------------
 * - When multiple filters could match, Nest picks the MOST SPECIFIC by class
 *   hierarchy, not by binding scope. So a globally bound @Catch() catch-all
 *   filter will still defer to a handler-scoped @Catch(HttpException) filter
 *   for HttpException-derived errors.
 * - Pair this filter with a catch-all @Catch() filter (AllExceptionsFilter)
 *   bound globally to handle non-Nest errors (TypeORM errors, raw `Error`,
 *   third-party SDK errors) so nothing leaks an unformatted 500.
 * ========================================================================== */
