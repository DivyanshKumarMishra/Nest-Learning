import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global → PrismaService is available app-wide without each feature
// module having to import PrismaModule. Trade-off: makes the dependency
// implicit. Acceptable here because the DB is a true cross-cutting
// concern — most features will touch it.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
