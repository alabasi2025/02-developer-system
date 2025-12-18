import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AcrelWebhooksController } from './controllers/acrel-webhooks.controller';
import { AcrelCommandsController } from './controllers/acrel-commands.controller';
import { AcrelWebhookService } from './services/acrel-webhook.service';
import { AcrelMqttService } from './services/acrel-mqtt.service';
import { AcrelCommandService } from './services/acrel-command.service';
import { AcrelSecurityService } from './services/acrel-security.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [AcrelWebhooksController, AcrelCommandsController],
  providers: [
    AcrelWebhookService,
    AcrelMqttService,
    AcrelCommandService,
    AcrelSecurityService,
    PrismaService,
  ],
  exports: [AcrelWebhookService, AcrelMqttService, AcrelCommandService],
})
export class AcrelModule {}
