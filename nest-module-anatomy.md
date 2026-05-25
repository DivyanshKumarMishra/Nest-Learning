# Nest Module Anatomy

What goes in each `@Module({ ... })` field, and why.

| Array | Goes here | Mental model |
|---|---|---|
| `imports` | Other **modules** (whose exports you want to use) | "I want what these modules expose" |
| `controllers` | **Controller classes** of this module | Route handlers Nest should mount |
| `providers` | Anything **injectable** owned by this module — services, guards, interceptors, filters, factories, repositories | "Things Nest constructs and offers to the DI graph" |
| `exports` | A **subset of `providers`** (or whole imported modules) | "Of what I own, what other modules can see" |

## Two notes

1. **`providers` is broader than "services."** Anything `@Injectable()` goes there — guards that need DI, custom factories (`{ provide: TOKEN, useFactory: ... }`), repositories, mappers. "Service" is just the most common case.

2. **You can re-export imported modules.** If `UsersModule` imports `PrismaModule` and you put `PrismaModule` in `UsersModule`'s `exports`, then any module importing `UsersModule` automatically gets Prisma too. Useful occasionally; mostly avoided because it makes the dependency graph implicit. `@Global` solves the same problem more honestly.

## How `exports` and `@Global` relate

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

## Why have private providers at all?

When a service is purely an implementation detail of one module (an internal helper, a circuit breaker, a parser), leaving it out of `exports` keeps the module's public surface area small. Same idea as `private` on a class field.
