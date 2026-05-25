/* ============================================================================
 * env-config.ts — boot-time validation of raw process.env
 * ============================================================================
 *
 * ROLE IN THE registerAs + ConfigType SETUP
 * -----------------------------------------
 * ConfigModule.forRoot({ validate, load }) runs this function ONCE during
 * module construction, BEFORE the registerAs factories in `load` execute.
 *   1. .env files are merged into process.env
 *   2. validateEnv(process.env) runs — fails the boot on bad/missing keys
 *   3. Only then do app.config / database.config / auth.config run their
 *      factories, which can safely assume every key is present and typed.
 *
 * WHY A CLASS, NOT AN INTERFACE
 * -----------------------------
 * class-validator decorators (@IsString, @IsInt, …) attach metadata to a
 * CLASS at runtime. Interfaces are erased by the TS compiler — they don't
 * exist when the validator looks for metadata. So the schema is a class
 * even though we never instantiate it ourselves; plainToInstance does that.
 *
 * WHY plainToInstance
 * -------------------
 * process.env values are ALL strings. We need PORT to be a number for
 * @IsInt to make sense. plainToInstance with enableImplicitConversion
 * coerces "3000" → 3000 before validation runs. Without that flag,
 * @IsInt would fail on the string "3000".
 *
 * WHY validateSync
 * ----------------
 * validateSync runs all decorator rules synchronously and returns an array
 * of failures (empty if everything passed). We must use the sync variant
 * because ConfigModule's `validate` option is synchronous — async validation
 * would silently be ignored.
 *
 * skipMissingProperties: false
 *   Without this, undefined values would pass any string/number check.
 *   With it, missing keys produce a clear "should not be empty" error.
 * ========================================================================== */

import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

// Postgres connection string prefix. We only check the protocol — Prisma
// will surface any deeper parse errors at first DB call.
const POSTGRES_URL = /^postgres(ql)?:\/\//;

// EnvSchema — single source of truth for which env vars exist and how they
// must be shaped. Add a new env var → add a property here with decorators.
class EnvSchema {
  // IsEnum gives a precise failure message ("must be one of development,
  // test, production") and rejects typos like "prod" or "dev". Stronger
  // than IsString + MinLength.
  @IsEnum(['dev', 'staging', 'prod'])
  NODE_ENV: 'dev' | 'staging' | 'prod';

  // @IsInt requires the value to be a real integer (after string coercion
  // via enableImplicitConversion). Min/Max bound it to valid TCP ports.
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  // DATABASE_URL → pooled connection (Supabase port 6543), used by the
  //                Nest app at runtime via PrismaClient.
  // DIRECT_URL   → direct connection (Supabase port 5432), used by the
  //                Prisma CLI for migrations.
  //
  // We use a regex (not @IsUrl) because class-validator's URL check is
  // overly strict for Postgres connection strings — it rejects perfectly
  // valid URLs containing URL-encoded passwords, dotted usernames, etc.
  @IsString()
  @Matches(POSTGRES_URL, {
    message: 'DATABASE_URL must start with postgres:// or postgresql://',
  })
  DATABASE_URL: string;

  @IsString()
  @Matches(POSTGRES_URL, {
    message: 'DIRECT_URL must start with postgres:// or postgresql://',
  })
  DIRECT_URL: string;

  // JWT secrets must be long enough to resist brute-forcing. 32 chars is
  // the common minimum recommendation for HS256. Refusing short secrets
  // at boot prevents a class of subtle prod misconfigurations.
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters long',
  })
  JWT_SECRET: string;
}

/**
 * Called by ConfigModule.forRoot({ validate }). Receives the merged
 * process.env (raw, all strings), returns the validated/coerced object,
 * or throws if any rule fails — which aborts the app boot.
 */
export function validateEnv(config: Record<string, unknown>) {
  // plainToInstance builds an EnvSchema instance from the raw process.env.
  // enableImplicitConversion coerces strings into the target types declared
  // on the class (PORT becomes number, etc.) so the validators see the
  // right type.
  const parsed = plainToInstance(EnvSchema, config, {
    enableImplicitConversion: true,
  });

  // validateSync collects every rule violation across the whole object.
  // skipMissingProperties: false flags missing keys as errors instead of
  // silently passing them.
  const errors = validateSync(parsed, {
    skipMissingProperties: false,
    forbidUnknownValues: false, // process.env has many vars we don't care about
  });

  if (errors.length > 0) {
    // errors.toString() produces a readable multi-line summary. We prefix
    // with a clear banner so the failure stands out in boot logs.
    throw new Error(
      'Invalid environment variables:\n' +
        errors
          .map((e) =>
            Object.values(e.constraints ?? {})
              .map((msg) => `  - ${msg}`)
              .join('\n'),
          )
          .join('\n'),
    );
  }

  // Return the validated, type-coerced object. ConfigModule uses this as
  // the source of truth for process.env-backed lookups going forward.
  return parsed;
}
