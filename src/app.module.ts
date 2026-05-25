import { Module } from '@nestjs/common';
import { UserModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env-config';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,

      // envFilePath — single local dev file (gitignored). dotenv reads it
      // only if it exists. In prod no file is shipped; values come from
      // the platform (Docker, k8s Secret, AWS task def, etc.) via real
      // process.env. .env.example (committed) documents the required keys.
      envFilePath: '.env',

      // ignoreEnvFile — belt-and-suspenders for production. Even if a
      // .env file accidentally lands in the image, refuse to read it in
      // prod so values can only come from real env vars (12-factor).
      ignoreEnvFile: process.env.NODE_ENV === 'prod',

      // validate — runs BEFORE the load factories. Reads raw process.env,
      // throws if anything required is missing or wrong-typed. App refuses
      // to boot on failure.
      validate: validateEnv,

      // load — array of registerAs factories. Each produces a namespaced,
      // typed config object that can be injected via @Inject(xConfig.KEY).
      // Order doesn't matter; namespaces are independent.
      load: [appConfig, databaseConfig, authConfig],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
