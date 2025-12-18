import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Prisma Module
import { PrismaModule } from '../prisma/prisma.module';

// Feature Modules
import { IntegrationsModule } from '../modules/integrations/integrations.module';
import { ApiKeysModule } from '../modules/api-keys/api-keys.module';
import { EventsModule } from '../modules/events/events.module';
import { GatewayModule } from '../modules/gateway/gateway.module';
import { MonitoringModule } from '../modules/monitoring/monitoring.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { IotModule } from '../modules/iot/iot.module';
import { AiModule } from '../modules/ai/ai.module';

// Phase 2 Modules - APIs Layer
import { InternalApiModule } from '../modules/internal-api/internal-api.module';
import { ExternalApiModule } from '../modules/external-api/external-api.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Event Emitter
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // Database
    PrismaModule,

    // Feature Modules
    IntegrationsModule,
    ApiKeysModule,
    EventsModule,
    GatewayModule,
    MonitoringModule,
    PaymentsModule,
    MessagesModule,
    IotModule,
    AiModule,

    // Phase 2 - APIs Layer
    InternalApiModule,
    ExternalApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
