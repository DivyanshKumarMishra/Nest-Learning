/* ============================================================================
 * auth.config.ts — namespaced auth/JWT config
 * ============================================================================
 * See app.config.ts for the full explanation of the registerAs / ConfigType
 * pattern.
 *
 * USAGE
 *   constructor(
 *     @Inject(authConfig.KEY)
 *     private readonly auth: ConfigType<typeof authConfig>,
 *   ) {}
 *   this.auth.jwtSecret;   // string, validated at boot
 * ========================================================================== */

import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET!,
}));
