import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from 'src/users/users.service';
import type { User } from 'src/types/user';
import type { LoginDTO } from './dto/login.dto';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const ACCESS_TOKEN_TTL = `${ACCESS_TOKEN_TTL_SECONDS}s`;

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    // @Inject(forwardRef(...)) — required because AuthModule and
    // UserModule are circularly imported (see forwardRef in both modules).
    // The decorator tells Nest to resolve the token lazily.
    @Inject(forwardRef(() => UserService))
    private readonly users: UserService,
    private readonly jwt: JwtService,
  ) {}

  public async login(
    dto: LoginDTO,
  ): Promise<{ accessToken: string; user: { name: string; email: string } }> {
    const user: User | null = await this.users.findForAuth(dto.email);

    // Same generic error for "no such email" and "wrong password" so a
    // caller can't enumerate which emails are registered.
    const invalid = new UnauthorizedException('Invalid email or password');
    if (!user) throw invalid;

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw invalid;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_TTL,
    });

    return {
      accessToken,
      user: { name: user.name, email: user.email },
    };
  }
}
