// Hand-written mirrors of generated Prisma types. We don't re-export the
// generated types because the v7 client files carry `@ts-nocheck`, which
// makes typescript-eslint treat them as `any` and triggers no-unsafe-*.
// Keep these in sync with prisma/schema.prisma manually.

export type Role = 'USER' | 'ADMIN';

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

// Safe to return in API responses — passwordHash stripped.
export type PublicUser = Omit<User, 'passwordHash'>;

// Attached to req.user by AuthGuard. Only the fields a guard / controller
// needs for authorization decisions — not the full row.
export type AuthedUser = Pick<User, 'id' | 'email' | 'role'>;
