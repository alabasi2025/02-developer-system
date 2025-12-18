import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { AcrelCommandService } from '../services/acrel-command.service';
import {
  DisconnectCommandDto,
  ReconnectCommandDto,
  ReadMeterCommandDto,
  SetParameterCommandDto,
} from '../dto/acrel-command.dto';

@ApiTags('Acrel IoT Commands')
@Controller('api/v1/acrel/commands')
@ApiBearerAuth()
export class AcrelCommandsController {
  private readonly logger = new Logger(AcrelCommandsController.name);

  constructor(private readonly commandService: AcrelCommandService) {}

  /**
   * إرسال أمر فصل العداد
   */
  @Post('disconnect')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('acrel:disconnect')
  @ApiOperation({ summary: 'إرسال أمر فصل العداد' })
  @ApiResponse({ status: 202, description: 'تم إرسال أمر الفصل' })
  async sendDisconnectCommand(@Body() data: DisconnectCommandDto) {
    this.logger.log(`Sending disconnect command to device: ${data.deviceId}`);
    const result = await this.commandService.sendDisconnectCommand(data);
    return { status: 'command_sent', commandId: result.commandId };
  }

  /**
   * إرسال أمر وصل العداد
   */
  @Post('reconnect')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('acrel:reconnect')
  @ApiOperation({ summary: 'إرسال أمر وصل العداد' })
  @ApiResponse({ status: 202, description: 'تم إرسال أمر الوصل' })
  async sendReconnectCommand(@Body() data: ReconnectCommandDto) {
    this.logger.log(`Sending reconnect command to device: ${data.deviceId}`);
    const result = await this.commandService.sendReconnectCommand(data);
    return { status: 'command_sent', commandId: result.commandId };
  }

  /**
   * إرسال أمر قراءة العداد
   */
  @Post('read-meter')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('acrel:read')
  @ApiOperation({ summary: 'إرسال أمر قراءة العداد' })
  @ApiResponse({ status: 202, description: 'تم إرسال أمر القراءة' })
  async sendReadMeterCommand(@Body() data: ReadMeterCommandDto) {
    this.logger.log(`Sending read meter command to device: ${data.deviceId}`);
    const result = await this.commandService.sendReadMeterCommand(data);
    return { status: 'command_sent', commandId: result.commandId };
  }

  /**
   * إرسال أمر تعديل إعدادات العداد
   */
  @Post('set-parameter')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('acrel:configure')
  @ApiOperation({ summary: 'إرسال أمر تعديل إعدادات العداد' })
  @ApiResponse({ status: 202, description: 'تم إرسال أمر التعديل' })
  async sendSetParameterCommand(@Body() data: SetParameterCommandDto) {
    this.logger.log(`Sending set parameter command to device: ${data.deviceId}`);
    const result = await this.commandService.sendSetParameterCommand(data);
    return { status: 'command_sent', commandId: result.commandId };
  }

  /**
   * الحصول على حالة أمر
   */
  @Get('status/:commandId')
  @RequirePermissions('acrel:read')
  @ApiOperation({ summary: 'الحصول على حالة أمر' })
  @ApiResponse({ status: 200, description: 'حالة الأمر' })
  async getCommandStatus(@Param('commandId') commandId: string) {
    const status = await this.commandService.getCommandStatus(commandId);
    return { commandId, ...status };
  }

  /**
   * الحصول على قائمة الأوامر المعلقة
   */
  @Get('pending')
  @RequirePermissions('acrel:read')
  @ApiOperation({ summary: 'الحصول على قائمة الأوامر المعلقة' })
  @ApiResponse({ status: 200, description: 'قائمة الأوامر المعلقة' })
  async getPendingCommands() {
    const commands = await this.commandService.getPendingCommands();
    return { commands, count: commands.length };
  }
}
