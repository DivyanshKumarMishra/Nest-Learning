import { forwardRef, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import authConfig from 'src/config/auth.config';
import { UserModule } from 'src/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    // forwardRef breaks the AuthModule ↔ UserModule import cycle.
    // (AuthModule needs UserService for login; UserModule needs
    // JwtAuthGuard for /users/me — each side imports the other.)
    forwardRef(() => UserModule),
    // Async registration so we can pull the secret from our typed
    // authConfig (which itself reads JWT_SECRET via @nestjs/config).
    // Avoids reading process.env directly anywhere in this module.
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: ConfigType<typeof authConfig>) => ({
        secret: auth.jwtSecret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // Re-export JwtModule so importing modules get JwtService visible in
  // their injector. JwtAuthGuard is constructed in the consumer's scope
  // when @UseGuards(JwtAuthGuard) runs, and it needs JwtService there.
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
