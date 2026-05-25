/* ============================================================================
 * app.config.ts — namespaced config for general app settings
 * ============================================================================
 *
 * registerAs + ConfigType typed injection
 * ---------------------------------------
 * Each domain (app, database, auth, payments, …) gets its own config file
 * exporting a `registerAs(namespace, factory)` default. The factory reads
 * raw env vars and returns a typed object — type-coercion happens HERE, once,
 * so call sites never repeat parseInt / === "true" / etc.
 *
 * The exported `appConfig` carries two pieces:
 *   appConfig()         — the factory itself, passed to ConfigModule.load
 *   appConfig.KEY       — a DI token Nest attaches to the factory
 *
 * Consumers inject the whole namespace as a typed object:
 *   constructor(
 *     @Inject(appConfig.KEY)
 *     private readonly cfg: ConfigType<typeof appConfig>,
 *   ) {}
 *   this.cfg.port;        // number, autocompleted, no string keys
 *   this.cfg.nodeEnv;     // string
 *
 * Boot validation (env-config.ts) still runs on raw process.env BEFORE these
 * factories execute, so missing/invalid vars fail the boot — these factories
 * can therefore assume the values exist and are the right type.
 * ========================================================================== */

import { registerAs } from '@nestjs/config';

// 'app' is the namespace. With ConfigService you'd access these as
// 'app.port' / 'app.nodeEnv' — but with typed injection (the preferred path)
// the namespace string is only used internally by Nest.
export default registerAs('app', () => ({
  // process.env values are always strings; coerce here so the rest of the
  // app sees a real number. Non-null assertion (!) is safe because
  // validateEnv has already verified PORT is present and integer-shaped.
  port: parseInt(process.env.PORT!, 10),
  nodeEnv: process.env.NODE_ENV!,
}));
