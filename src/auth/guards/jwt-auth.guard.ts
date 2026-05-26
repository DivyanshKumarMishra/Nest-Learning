/* ============================================================================
 * JwtAuthGuard — verifies a JWT cookie and attaches user identity to req
 * ============================================================================
 *
 * WHY GUARDS EXIST
 * ----------------
 * Guards solve one problem: where should "is this allowed?" checks live?
 *
 * Three approaches that DON'T work well:
 *
 *   1. Inline in every controller method.
 *        if (!req.user) throw new UnauthorizedException();
 *        if (req.user.role !== 'ADMIN') throw new ForbiddenException();
 *      → Easy to forget on a new endpoint (silent security hole). Auth logic
 *        mixed with business logic. Changing auth rules touches dozens of
 *        files. Can't test in isolation.
 *
 *   2. Express-style path-based middleware.
 *        app.use('/admin/*', requireAdmin)
 *      → Middleware doesn't know WHICH handler will run; only the path. You
 *        can't write @Roles('ADMIN') on one method and have middleware see
 *        it. Also: plain middleware has no DI access.
 *
 *   3. Hand-rolled decorators that wrap method bodies.
 *      → Just hides Attempt 1. The decorator still can't access services or
 *        be tested independently.
 *
 * Guards win because they have FOUR properties simultaneously:
 *   - Live in a defined lifecycle slot (after middleware, before pipes).
 *   - Know the target handler + class via ExecutionContext → can read
 *     decorator metadata (@Roles, @Public, …).
 *   - Participate in DI → can inject JwtService, UsersService, etc.
 *   - Implement one method, canActivate() → boolean. Stackable: you can
 *     write @UseGuards(JwtAuthGuard, RolesGuard) and they run in order.
 *
 * Net result: authorization becomes a DECLARATIVE property of a route,
 * not imperative code mixed into the handler.
 *
 * THE CanActivate CONTRACT
 * ------------------------
 *   interface CanActivate {
 *     canActivate(ctx: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>;
 *   }
 *
 *   return true    → request continues to interceptors / pipes / controller
 *   return false   → Nest throws ForbiddenException (403), generic message
 *   throw          → exception filter formats it (preferred — custom message)
 *
 * Practical rule: almost always throw. Returning false gives a 403 with no
 * useful message; throwing UnauthorizedException → 401 with your text.
 *
 * WHAT ExecutionContext GIVES YOU
 * -------------------------------
 *   ctx.switchToHttp().getRequest()  → Express request (cookies, headers, body)
 *   ctx.getHandler()                 → the method about to run
 *   ctx.getClass()                   → the controller class
 *
 * The handler/class refs are critical for METADATA. When you write
 * @Roles('ADMIN') on a method, you attach metadata to it. ctx.getHandler()
 * lets a guard read it back via Reflector. That's how generic guards
 * (RolesGuard) apply per-route policy without if-chains.
 *
 * REGISTRATION SCOPES
 * -------------------
 *   per method    : @UseGuards(JwtAuthGuard) on the handler
 *   per controller: @UseGuards(JwtAuthGuard) on the class
 *   global (DI)   : { provide: APP_GUARD, useClass: JwtAuthGuard } in providers
 *   global (no DI): app.useGlobalGuards(new JwtAuthGuard(...)) in main.ts
 *
 * Multiple guards: @UseGuards(JwtAuthGuard, RolesGuard) runs left-to-right;
 * first one to throw / return false stops the chain. Stack auth-before-role
 * this way.
 * ========================================================================== */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_COOKIE } from '../auth.controller';
import type { JwtPayload } from '../auth.service';
import type { AuthUser } from 'src/types/user';

// Minimal request shape we actually use. Intentionally narrow — pulling in
// Express's full Request type drags in `any`-typed fields that pollute
// type inference (eslint then flags downstream assignments as unsafe).
// `user` is optional in the type because it's only present AFTER this
// guard has run; controllers behind the guard can rely on it being set.
type RequestWithAuth = {
  cookies: Record<string, string>;
  user?: AuthUser;
};

// @Injectable() — registers the class with Nest's DI container.
// Required so Nest can construct the guard and inject JwtService into it,
// and so APP_GUARD / @UseGuards(JwtAuthGuard) can route it through DI.
@Injectable()
// implements CanActivate — the only contract Nest looks for. Compile-time
// safety: canActivate's signature must match exactly.
export class JwtAuthGuard implements CanActivate {
  // Constructor injection — same pattern as services. JwtService comes from
  // the JwtModule.registerAsync(...) wired up in AuthModule.
  constructor(private readonly jwt: JwtService) {}

  // async — returning Promise<boolean> because verifying a JWT is async
  // (jwt.verifyAsync). Throwing UnauthorizedException instead of returning
  // false so the response is 401 with a useful message (vs 403 generic).
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // switchToHttp() narrows ExecutionContext to the HTTP transport.
    // getRequest() returns Express's req — same object controllers see.
    const req = context.switchToHttp().getRequest<RequestWithAuth>();

    // cookie-parser middleware (wired in main.ts) populated req.cookies.
    // Without it, this would be `undefined` and the optional chain below
    // would still safely yield `undefined` — but the cookie wouldn't be
    // readable at all.
    const token: string | undefined = req.cookies?.[ACCESS_TOKEN_COOKIE];

    // Fail fast: no cookie → no identity → reject. Cleaner than letting
    // jwt.verifyAsync(undefined) throw a less helpful error downstream.
    if (!token) throw new UnauthorizedException('Not authenticated');

    // verifyAsync checks signature, algorithm, and exp atomically. Any
    // failure (bad signature, expired, malformed) throws — we collapse
    // them all to a single 401 because from the API's perspective the
    // distinction doesn't matter to the caller.
    //
    // The <JwtPayload> generic is what makes `payload` typed instead of
    // `any` — without it the destructuring below would be unsafe.
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Reshape JWT payload → AuthedUser. JWT uses `sub` (RFC 7519's
    // standard "subject" claim) for the principal id; the rest of the
    // app prefers `id`. Translating here means controllers never see
    // JWT-specific field names — clean separation.
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AuthUser['role'],
    };

    // All gates passed → request continues to interceptors / pipes / controller.
    return true;
  }
}
