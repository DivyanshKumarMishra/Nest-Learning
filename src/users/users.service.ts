import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type User from 'src/types/user';
import type { CreateUserDTO, UpdateUserDTO } from './dto/user.dto';

@Injectable()
export class UserService {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map<string, User>();
  }

  public createUser(dto: CreateUserDTO): User {
    const uid = randomUUID();
    const user: User = { id: uid, ...dto };
    this.users.set(uid, user);
    return user;
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  public getAllUsers(): User[] | undefined {
    return Array.from(this.users.values());
  }

  public updateUser(id: string, dto: UpdateUserDTO): User | undefined {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated: User = { ...existing, ...dto };
    this.users.set(id, updated);
    return updated;
  }

  public deleteUser(id: string): string {
    this.users.delete(id);
    return 'User deleted successfully';
  }
}
