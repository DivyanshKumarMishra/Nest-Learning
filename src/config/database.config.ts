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
 *   this.db.url;   // string, validated at boot
 * ========================================================================== */

import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DB_URL!,
}));
