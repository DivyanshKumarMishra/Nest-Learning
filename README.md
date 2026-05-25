# user-module

NestJS learning sandbox — a users feature built incrementally while following the 7-day Nest plan. Real Postgres (Supabase) via Prisma v7, validation, interceptors, exception filters, and (in-progress) auth + guards.

## Setup

```bash
npm install
```

Fill in `.env` with your Supabase URLs (pooled `DATABASE_URL` on port 6543, direct `DIRECT_URL` on port 5432) and a `JWT_SECRET` of at least 32 chars.

Apply migrations:

```bash
npm run db:migrate -- --name init
```

## Run

```bash
npm run start:dev   # watch mode
npm run start       # one-shot
npm run start:prod  # NODE_ENV=prod, runs compiled dist/
```

## Database commands

```bash
npm run db:migrate -- --name <change>   # create + apply a new migration (dev)
npm run db:deploy                       # apply pending migrations (production)
npm run db:generate                     # regenerate the typed client
npx prisma studio                       # web GUI to browse DB on :5555
```

## Test

```bash
npm run test
npm run test:e2e
npm run test:cov
```

---

# Learning notes

The rest of this file is reference material — concepts internalized while building this project. Two main topics: the request lifecycle (what runs in what order) and module anatomy (what goes in each `@Module` field).

## Nest Request Lifecycle

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

### Role of each piece

| Piece              | Role                                                         | Typical use                                                  |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Middleware         | Transport plumbing. Runs before route resolution.            | cors, helmet, body parsing, raw request logging              |
| Guards             | Authorization. May this request enter?                       | JWT auth, API key check, role checks via `Reflector`         |
| Interceptors       | Wrap controller execution. Before + after phases.            | Response shaping, caching, timing, structured logging        |
| Pipes              | Validate / transform incoming data.                          | DTO validation via `class-validator`, `ParseUUIDPipe`        |
| Controller         | Business logic entrypoint. Calls services, returns a value.  | Route handlers                                               |
| Exception filters  | Catch thrown exceptions and shape the error response.        | Consistent error JSON, map Prisma errors → HTTP, etc.        |

### One-sentence anchor

> Middleware is transport plumbing, guards are "may you enter," interceptors are "wrap the call," pipes are "is the input right," controller is the work, filters catch fallout.

### Why the order matters (guard-centric notes)

- **Guards run before pipes** → don't reach into `@Body()` payload validation inside a guard; the DTO isn't validated/transformed yet. Guards work with headers, params, the raw request, and the user identity attached by an upstream guard.
- **Guards run after middleware** → things like `cors` and body parsing have already happened, so `req.body`, `req.headers`, etc. are populated and readable.
- **Guards run before interceptors** → if a guard rejects, the interceptor's before-phase never executes, so a logging interceptor won't log rejected requests as "handled." If you need to log rejections too, do it in middleware or rely on the exception filter.
- **Throwing in a guard → exception filter** → throwing `UnauthorizedException` from a guard produces the same JSON shape as throwing it from a controller, because the same filter handles both.

### Decision rule

- Check is about **identity / permission** → guard.
- Check is about **input shape / coercion** → pipe.
- Need to **wrap** the call (before + after) → interceptor.
- Need to **format an error** → exception filter.
- Need to act before Nest's routing even resolves → middleware.

---

## Nest Module Anatomy

What goes in each `@Module({ ... })` field, and why.

| Array | Goes here | Mental model |
|---|---|---|
| `imports` | Other **modules** (whose exports you want to use) | "I want what these modules expose" |
| `controllers` | **Controller classes** of this module | Route handlers Nest should mount |
| `providers` | Anything **injectable** owned by this module — services, guards, interceptors, filters, factories, repositories | "Things Nest constructs and offers to the DI graph" |
| `exports` | A **subset of `providers`** (or whole imported modules) | "Of what I own, what other modules can see" |

### Two notes

1. **`providers` is broader than "services."** Anything `@Injectable()` goes there — guards that need DI, custom factories (`{ provide: TOKEN, useFactory: ... }`), repositories, mappers. "Service" is just the most common case.

2. **You can re-export imported modules.** If `UsersModule` imports `PrismaModule` and you put `PrismaModule` in `UsersModule`'s `exports`, then any module importing `UsersModule` automatically gets Prisma too. Useful occasionally; mostly avoided because it makes the dependency graph implicit. `@Global` solves the same problem more honestly.

### How `exports` and `@Global` relate

They answer different questions:

- `exports` controls **what is visible** outside the module. Without it, a provider is module-private regardless of `@Global`.
- `@Global` controls **whether other modules must import this module** to see the exports. With it, they don't.

Rule of thumb: anything injectable outside this module → put it in `exports`. `@Global` is sugar on top of that.

```ts
@Global()
@Module({
  providers: [PrismaService],   // owned & constructible inside this module
  exports:   [PrismaService],   // visible to other modules
})
export class PrismaModule {}
```

Without `exports: [PrismaService]`, the `@Global` decorator does nothing — there's still nothing exposed.

### Why have private providers at all?

When a service is purely an implementation detail of one module (an internal helper, a circuit breaker, a parser), leaving it out of `exports` keeps the module's public surface area small. Same idea as `private` on a class field.
