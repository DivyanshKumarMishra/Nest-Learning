# Nest Request Lifecycle

The order every HTTP request flows through. Burn this in — debugging and extending the app becomes mechanical once you know which slot does what.

```
Incoming HTTP request
        │
        ▼
┌───────────────────┐  Express-level. Runs before Nest's DI engages on the route.
│   Middleware      │  Doesn't know which handler will run. Use for: cors, helmet,
└───────────────────┘  body parsing, request logging.
        │
        ▼
┌───────────────────┐  "Should this request be allowed through?"
│      Guards       │  Knows the target handler + class. Can read decorator metadata
└───────────────────┘  via Reflector. Return false / throw → reject. → AUTHORIZATION
        │
        ▼
┌───────────────────┐  "Wrap the handler call." Runs code before AND after the
│  Interceptors     │  controller. Can mutate request, mutate/transform response,
│     (before)      │  time the call, add caching. RxJS-based.
└───────────────────┘
        │
        ▼
┌───────────────────┐  "Is the input shaped correctly? Coerce it." Operates on
│      Pipes        │  @Body/@Param/@Query values. Throws → 400. → VALIDATION
└───────────────────┘
        │
        ▼
┌───────────────────┐  Your business logic. Calls services, returns a value.
│    Controller     │
└───────────────────┘
        │
        ▼
┌───────────────────┐  Same interceptor instances, after-phase (the `tap`,
│  Interceptors     │  `map`, etc. in the RxJS chain). Shape the response here.
│     (after)       │
└───────────────────┘
        │
        ▼
                       Response sent

  ⚡ If anything above throws, control jumps to:
┌───────────────────┐  Catches exceptions, formats the error response.
│ Exception filters │  Most specific @Catch(...) class wins.
└───────────────────┘
```

## Role of each piece

| Piece              | Role                                                         | Typical use                                                  |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Middleware         | Transport plumbing. Runs before route resolution.            | cors, helmet, body parsing, raw request logging              |
| Guards             | Authorization. May this request enter?                       | JWT auth, API key check, role checks via `Reflector`         |
| Interceptors       | Wrap controller execution. Before + after phases.            | Response shaping, caching, timing, structured logging        |
| Pipes              | Validate / transform incoming data.                          | DTO validation via `class-validator`, `ParseUUIDPipe`        |
| Controller         | Business logic entrypoint. Calls services, returns a value.  | Route handlers                                               |
| Exception filters  | Catch thrown exceptions and shape the error response.        | Consistent error JSON, map Prisma errors → HTTP, etc.        |

## One-sentence anchor

> Middleware is transport plumbing, guards are "may you enter," interceptors are "wrap the call," pipes are "is the input right," controller is the work, filters catch fallout.

## Why the order matters (guard-centric notes)

- **Guards run before pipes** → don't reach into `@Body()` payload validation inside a guard; the DTO isn't validated/transformed yet. Guards work with headers, params, the raw request, and the user identity attached by an upstream guard.
- **Guards run after middleware** → things like `cors` and body parsing have already happened, so `req.body`, `req.headers`, etc. are populated and readable.
- **Guards run before interceptors** → if a guard rejects, the interceptor's before-phase never executes, so a logging interceptor won't log rejected requests as "handled." If you need to log rejections too, do it in middleware or rely on the exception filter.
- **Throwing in a guard → exception filter** → throwing `UnauthorizedException` from a guard produces the same JSON shape as throwing it from a controller, because the same filter handles both.

## Decision rule

- Check is about **identity / permission** → guard.
- Check is about **input shape / coercion** → pipe.
- Need to **wrap** the call (before + after) → interceptor.
- Need to **format an error** → exception filter.
- Need to act before Nest's routing even resolves → middleware.
