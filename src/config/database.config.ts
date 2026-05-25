/* ============================================================================
 * database.config.ts — namespaced DB config
 * ============================================================================
 * See app.config.ts for the full explanation of the registerAs / ConfigType
 * pattern. Same shape, different namespace.
 *
 * USAGE
 *   constructor(
 *     @Inject(databaseConfig.KEY)
 *     private readonly db: ConfigType<typeof databaseConfig>,
 *   ) {}
 *   this.db.url;        // pooled URL (runtime queries)
 *   this.db.directUrl;  // direct URL (rarely needed at runtime)
 *
 * Note: Prisma reads DATABASE_URL / DIRECT_URL itself via prisma.config.ts —
 * this Nest-side config is for places where the app needs the URL directly
 * (e.g. a health-check ping, or a non-Prisma raw client).
 * ========================================================================== */

import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL!,
  directUrl: process.env.DIRECT_URL!,
}));
