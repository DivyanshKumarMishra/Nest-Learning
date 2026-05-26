import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDTO, UpdateUserDTO } from './dto/user.dto';
import { SanitizeUserPipe } from 'src/common/pipes/sanitize-user.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { AuthUser } from 'src/types/user';

// Minimal shape — same approach as the guard. Avoid Express's full
// Request type (it taints downstream types with `any`).
type RequestWithAuth = { user: AuthUser };

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UsePipes(SanitizeUserPipe)
  createUser(@Body() user: CreateUserDTO) {
    return this.userService.createUser(user);
  }

  // @UseGuards runs JwtAuthGuard before this handler. Guard reads the
  // access_token cookie, verifies the JWT, and attaches req.user. Any
  // failure throws 401 before we get here.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: RequestWithAuth): AuthUser {
    return req.user;
  }

  @Get(':id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getUser(id);
  }

  @Get()
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  @Patch(':id')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() user: UpdateUserDTO,
  ) {
    return this.userService.updateUser(id, user);
  }

  @Delete(':id')
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deleteUser(id);
  }
}
