import { IsEmail, IsString, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// WHAT IS A DTO?
// DTO (Data Transfer Object) defines the shape of data coming INTO the API.
// It is a CLASS (not an interface) because class-transformer needs to instantiate
// it at runtime. Interfaces are erased by TypeScript — they don't exist at runtime.
//
// WHAT IS A PIPE?
// A pipe runs between the incoming request and your controller method.
// It can do two things:
//   1. VALIDATE — reject the request if data is invalid (throws 400)
//   2. TRANSFORM — convert the data into a different type/shape
//
// HOW DTO + PIPE WORK TOGETHER:
//   1. JSON body arrives as a plain JS object
//   2. class-transformer instantiates CreateUserDTO from it (because transform: true)
//   3. class-validator runs the decorator rules on that instance
//   4. Fails? → ValidationPipe throws 400, controller never runs
//   5. Passes? → controller receives a clean, typed CreateUserDTO instance
//
// BUILT-IN PIPES (shipped with Nest, no install needed):
//   ParseIntPipe    — converts string "123" → number 123, throws 400 if not a number
//   ParseBoolPipe   — converts string "true" → boolean true
//   ParseUUIDPipe   — validates the value is a valid UUID
//   ParseArrayPipe  — parses a comma-separated string into an array
//   ValidationPipe  — validates + transforms using class-validator decorators (this file)
//
// CUSTOM PIPE (when built-ins aren't enough):
//   @Injectable()
//   export class UpperCasePipe implements PipeTransform {
//     transform(value: string): string {
//       return value.toUpperCase(); // return value is what controller receives
//     }
//   }
//   Usage: @Param('name', UpperCasePipe) name: string
//
// PIPE SCOPE:
//   Global  → app.useGlobalPipes() in main.ts — applies to every route
//   Route   → @UsePipes(new ValidationPipe()) on a controller method — one route only

export class CreateUserDTO {
  // @IsString() — value must be a string
  // @MinLength(2) — string must be at least 2 characters
  @IsString()
  @MinLength(2)
  name: string;

  // @IsEmail() — value must be a valid email format
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// PartialType copies all fields + decorators from CreateUserDTO
// and makes every field optional — so PATCH can send only the fields it wants to update.
// This avoids repeating the same decorators manually.
export class UpdateUserDTO extends PartialType(CreateUserDTO) {}
