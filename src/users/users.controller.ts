import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
} from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDTO, UpdateUserDTO } from './dto/user.dto';
import { SanitizeUserPipe } from 'src/common/pipes/sanitize-user.pipe';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UsePipes(SanitizeUserPipe)
  createUser(@Body() user: CreateUserDTO) {
    return this.userService.createUser(user);
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
