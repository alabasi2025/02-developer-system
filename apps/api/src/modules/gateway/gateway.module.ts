import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { CacheService } from './services/cache.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule],
  controllers: [GatewayController],
  providers: [
    GatewayService,
    CacheService,
    CircuitBreakerService,
  ],
  exports: [
    GatewayService,
    CacheService,
    CircuitBreakerService,
  ],
})
export class GatewayModule {}
