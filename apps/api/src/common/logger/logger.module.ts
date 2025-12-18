import { Module, Global } from '@nestjs/common';
import { JsonLoggerService } from './json-logger.service';

@Global()
@Module({
  providers: [JsonLoggerService],
  exports: [JsonLoggerService],
})
export class LoggerModule {}
