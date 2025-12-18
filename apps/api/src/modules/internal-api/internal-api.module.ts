import { Module } from '@nestjs/common';
import { InternalApiService } from './internal-api.service';
import { InternalApiController } from './internal-api.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InternalApiController],
  providers: [InternalApiService],
  exports: [InternalApiService],
})
export class InternalApiModule {}
