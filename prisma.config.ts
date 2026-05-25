// Prisma 7+ moved CLI config out of schema.prisma into this file.
// Read by every `npx prisma` command (migrate, generate, studio, ...).
//
// dotenv/config is imported because the Prisma CLI runs as its own Node
// process — Nest's ConfigModule isn't available here.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // CLI-only URL (migrations, studio, generate). Uses the DIRECT
    // connection (port 5432) because pgBouncer doesn't support the
    // features Prisma Migrate needs (advisory locks, DDL transactions).
    // Runtime queries use DATABASE_URL via the adapter — see PrismaService.
    url: process.env['DIRECT_URL'],
  },
});
