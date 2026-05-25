import type { User } from 'src/generated/prisma/client';

// Safe to return in API responses — passwordHash stripped.
export type PublicUser = Omit<User, 'passwordHash'>;

// Attached to req.user by AuthGuard. Only the fields a guard / controller
// needs for authorization decisions — not the full row.
export type AuthedUser = Pick<User, 'id' | 'email' | 'role'>;
