import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { MessagesService, MessageProviderConfig, SendMessageDto, BulkMessageDto } from './messages.service';

@ApiTags('الرسائل - Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // ==================== Provider Management ====================

  @Post('providers')
  @ApiOperation({ summary: 'إنشاء مزود رسائل', description: 'إنشاء مزود رسائل جديد' })
  @ApiResponse({ status: 201, description: 'تم الإنشاء بنجاح' })
  async createProvider(@Body() data: MessageProviderConfig) {
    return this.messagesService.createProvider(data);
  }

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'جلب مزودي الرسائل', description: 'جلب قائمة مزودي الرسائل' })
  @ApiResponse({ status: 200, description: 'قائمة المزودين' })
  async findAllProviders(
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.messagesService.findAllProviders({
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('providers/:id')
  @Public()
  @ApiOperation({ summary: 'جلب مزود رسائل', description: 'جلب تفاصيل مزود رسائل' })
  @ApiParam({ name: 'id', description: 'معرف المزود' })
  @ApiResponse({ status: 200, description: 'تفاصيل المزود' })
  async findOneProvider(@Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.findOneProvider(id);
  }

  @Put('providers/:id')
  @ApiOperation({ summary: 'تحديث مزود رسائل', description: 'تحديث بيانات مزود رسائل' })
  @ApiParam({ name: 'id', description: 'معرف المزود' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  async updateProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: Partial<MessageProviderConfig>,
  ) {
    return this.messagesService.updateProvider(id, data);
  }

  @Delete('providers/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف مزود رسائل', description: 'تعطيل مزود رسائل' })
  @ApiParam({ name: 'id', description: 'معرف المزود' })
  @ApiResponse({ status: 200, description: 'تم التعطيل بنجاح' })
  async deleteProvider(@Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.deleteProvider(id);
  }

  // ==================== Message Sending ====================

  @Post('send')
  @ApiOperation({ summary: 'إرسال رسالة', description: 'إرسال رسالة SMS/Email/Push' })
  @ApiResponse({ status: 201, description: 'تم الإرسال بنجاح' })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(dto);
  }

  @Post('send/bulk')
  @ApiOperation({ summary: 'إرسال رسائل جماعية', description: 'إرسال رسائل لعدة مستلمين' })
  @ApiResponse({ status: 201, description: 'تم بدء الإرسال' })
  async sendBulkMessages(@Body() dto: BulkMessageDto) {
    return this.messagesService.sendBulkMessages(dto);
  }

  // ==================== Template Management ====================

  @Post('templates')
  @ApiOperation({ summary: 'إنشاء قالب رسالة', description: 'إنشاء قالب رسالة جديد' })
  @ApiResponse({ status: 201, description: 'تم الإنشاء بنجاح' })
  async createTemplate(@Body() data: {
    name: string;
    type: string;
    subject?: string;
    content: string;
    variables?: string[];
  }) {
    return this.messagesService.createTemplate(data);
  }

  @Get('templates')
  @Public()
  @ApiOperation({ summary: 'جلب قوالب الرسائل', description: 'جلب قائمة قوالب الرسائل' })
  @ApiResponse({ status: 200, description: 'قائمة القوالب' })
  async findAllTemplates(@Query('type') type?: string) {
    return this.messagesService.findAllTemplates({ type });
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'تحديث قالب رسالة', description: 'تحديث قالب رسالة' })
  @ApiParam({ name: 'id', description: 'معرف القالب' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: Partial<{
      name: string;
      subject: string;
      content: string;
      variables: string[];
      isActive: boolean;
    }>,
  ) {
    return this.messagesService.updateTemplate(id, data);
  }

  // ==================== Message Queries ====================

  @Get()
  @Public()
  @ApiOperation({ summary: 'جلب الرسائل', description: 'جلب قائمة الرسائل المرسلة' })
  @ApiResponse({ status: 200, description: 'قائمة الرسائل' })
  async findAllMessages(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('recipient') recipient?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.findAllMessages({
      type,
      status,
      recipient,
      fromDate,
      toDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'جلب رسالة', description: 'جلب تفاصيل رسالة محددة' })
  @ApiParam({ name: 'id', description: 'معرف الرسالة' })
  @ApiResponse({ status: 200, description: 'تفاصيل الرسالة' })
  async findOneMessage(@Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.findOneMessage(id);
  }
}
