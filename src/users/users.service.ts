import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import type { PublicUser, User } from 'src/types/user';
import type { CreateUserDTO, UpdateUserDTO } from './dto/user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  public async createUser(dto: CreateUserDTO): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        omit: { passwordHash: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  public async getUser(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  public getAllUsers(): Promise<PublicUser[]> {
    return this.prisma.user.findMany({ omit: { passwordHash: true } });
  }

  // Returns the full row INCLUDING passwordHash. Only AuthService should
  // call this — needed to verify a password at login. Never expose the
  // return value to the API layer.
  public findForAuth(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  public async updateUser(id: string, dto: UpdateUserDTO): Promise<PublicUser> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        omit: { passwordHash: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') {
          throw new NotFoundException(`User ${id} not found`);
        }
        if (e.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
      }
      throw e;
    }
  }

  public async deleteUser(id: string): Promise<{ message: string }> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { message: 'User deleted successfully' };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException(`User ${id} not found`);
      }
      throw e;
    }
  }
}
