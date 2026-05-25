/* ============================================================================
 * AllExceptionsFilter — catch-all safety net
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * HttpExceptionFilter (@Catch(HttpException)) only handles Nest's HttpException
 * family. Anything else — raw `Error`, TypeError, ORM errors (TypeORM /
 * Prisma), third-party SDK exceptions — falls through to Nest's built-in
 * default filter, which sends an unformatted 500 with the raw stack message.
 * That leaks internals to the client and breaks the unified { ok, statusCode,
 * path, error, timestamp } shape our HttpExceptionFilter establishes.
 *
 * HOW IT WORKS
 * ------------
 * @Catch() with no arguments catches EVERYTHING. Because Nest picks the most
 * specific filter by class hierarchy, HttpExceptionFilter still wins for
 * HttpException-derived errors. This filter only kicks in for non-Nest
 * exceptions — exactly the gap we want covered.
 *
 * SHAPE RULE
 * ----------
 * Mirror the response shape produced by HttpExceptionFilter so clients see
 * one consistent error envelope across the whole app. Crucially, return a
 * GENERIC message ("Internal server error") to the client — never echo the
 * raw exception message, because it may contain DB queries, file paths, or
 * other server internals. Log the real error server-side instead.
 * ========================================================================== */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// @Catch() with no args — matches every thrown value. Nest will route here
// only when no more-specific filter (like HttpExceptionFilter) claims the
// exception first.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  // exception is typed `unknown` because non-HttpException throws don't share
  // any interface — could be Error, a plain object, a string, anything.
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // If somehow an HttpException reaches here (e.g. HttpExceptionFilter was
    // unbound), still honor its status/message. Otherwise it's an unexpected
    // error — treat it as 500.
    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Server-side: log the FULL error (including stack) so we can debug.
    // Client-side: receives only a generic message — never the raw text.
    this.logger.error(
      `${request.method} ${request.url} → ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const error = isHttp
      ? (() => {
          const payload = exception.getResponse();
          return typeof payload === 'string'
            ? payload
            : ((payload as { message?: string | string[] }).message ??
                exception.message);
        })()
      : 'Internal server error';

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
 * WIRING
 * ============================================================================
 * Pair this with HttpExceptionFilter. Both can be registered globally:
 *
 *   // main.ts
 *   app.useGlobalFilters(
 *     new AllExceptionsFilter(),     // catch-all safety net
 *     new HttpExceptionFilter(),     // typed handling for HttpException
 *   );
 *
 * Order in this call doesn't affect resolution — Nest picks the most specific
 * filter by exception class hierarchy, not by registration order. Listing
 * the catch-all first is just convention.
 *
 * Or via APP_FILTER providers (preferred when filters need DI):
 *
 *   providers: [
 *     { provide: APP_FILTER, useClass: AllExceptionsFilter },
 *     { provide: APP_FILTER, useClass: HttpExceptionFilter },
 *   ]
 * ========================================================================== */
