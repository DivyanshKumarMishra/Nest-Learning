import { Injectable, PipeTransform } from '@nestjs/common';
import { CreateUserDTO } from 'src/users/dto/user.dto';

// CUSTOM PIPE — sanitizes incoming user data before it reaches the controller.
// Implements PipeTransform which requires a transform() method.
// Whatever transform() returns is what the controller receives.
//
// Applied on @Body() so it receives the full DTO and can sanitize multiple fields at once.
@Injectable()
export class SanitizeUserPipe implements PipeTransform<
  CreateUserDTO,
  CreateUserDTO
> {
  transform(value: CreateUserDTO): CreateUserDTO {
    return {
      ...value,
      // capitalize first letter of each word in name e.g. "john doe" → "John Doe"
      name: value.name
        .trim()
        .split(' ')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(' '),
      // lowercase and trim email e.g. "  John@Example.COM  " → "john@example.com"
      email: value.email.trim(),
    };
  }
}
