import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventProcessorService } from './services/event-processor.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { RetryManagerService } from './services/retry-manager.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
  ],
  controllers: [EventsController],
  providers: [
    EventsService,
    EventProcessorService,
    WebhookDispatcherService,
    RetryManagerService,
  ],
  exports: [
    EventsService,
    EventProcessorService,
    WebhookDispatcherService,
    RetryManagerService,
  ],
})
export class EventsModule {}
