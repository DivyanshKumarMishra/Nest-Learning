import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UserController } from './users.controller';
import { UserService } from './users.service';

@Module({
  // forwardRef breaks the AuthModule ↔ UserModule cycle (each side
  // needs the other's exports). AuthModule provides JwtAuthGuard so
  // the controller can apply @UseGuards(JwtAuthGuard).
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
