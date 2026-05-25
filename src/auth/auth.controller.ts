import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, ACCESS_TOKEN_TTL_SECONDS } from './auth.service';
import { LoginDTO } from './dto/login.dto';

export const ACCESS_TOKEN_COOKIE = 'access_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // HttpCode override → login returns 200, not the default 201 for POST.
  // 201 means "resource created"; login doesn't create anything new.
  //
  // @Res({ passthrough: true }) → hand us the Express response so we can
  // set a cookie, but keep Nest in charge of serializing the return value
  // (without passthrough, returning JSON would silently do nothing).
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.auth.login(dto);

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      // httpOnly → cookie not readable from JS; defends against XSS
      //            stealing the token via document.cookie.
      httpOnly: true,
      // secure → only sent over HTTPS. Off in dev so localhost works;
      //          flip on in any non-dev env.
      secure: process.env.NODE_ENV !== 'dev',
      // sameSite: 'lax' → cookie sent on top-level navigation but not
      //                   cross-site POSTs/fetches. Reasonable default
      //                   for auth cookies; CSRF risk minimized.
      sameSite: 'lax',
      // maxAge is in ms here (express-style); JWT exp is in seconds.
      // Same wall-clock duration so cookie and token expire together.
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
      path: '/',
    });

    return user;
  }
}
