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
import { EventsService } from './events.service';
import {
  PublishEventDto,
  EventResponseDto,
  EventQueryDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponseDto,
  SubscriptionQueryDto,
} from './dto/event.dto';

@ApiTags('نظام الأحداث - Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ==================== Event Endpoints ====================

  @Post('publish')
  @RequirePermissions('events:publish')
  @ApiOperation({ summary: 'نشر حدث جديد', description: 'نشر حدث جديد ليتم توزيعه على المشتركين' })
  @ApiResponse({ status: 201, description: 'تم نشر الحدث بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async publish(@Body() publishDto: PublishEventDto) {
    return this.eventsService.publish(publishDto);
  }

  @Get()
  @RequirePermissions('events:read')
  @ApiOperation({ summary: 'جلب جميع الأحداث', description: 'جلب قائمة بجميع الأحداث مع إمكانية الفلترة' })
  @ApiResponse({ status: 200, description: 'قائمة الأحداث' })
  async findAll(@Query() query: EventQueryDto) {
    return this.eventsService.findAllEvents(query);
  }

  // ==================== Subscription Endpoints (Static routes first) ====================

  @Post('subscribe')
  @RequirePermissions('events:subscribe')
  @ApiOperation({ summary: 'إنشاء اشتراك جديد', description: 'الاشتراك في نوع معين من الأحداث' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الاشتراك بنجاح', type: SubscriptionResponseDto })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة أو اشتراك موجود' })
  async subscribe(@Body() createDto: CreateSubscriptionDto) {
    return this.eventsService.createSubscription(createDto);
  }

  @Get('subscriptions')
  @RequirePermissions('events:read')
  @ApiOperation({ summary: 'جلب جميع الاشتراكات', description: 'جلب قائمة بجميع اشتراكات الأحداث' })
  @ApiResponse({ status: 200, description: 'قائمة الاشتراكات' })
  async findAllSubscriptions(@Query() query: SubscriptionQueryDto) {
    return this.eventsService.findAllSubscriptions(query);
  }

  @Post('retry-failed')
  @RequirePermissions('events:execute')
  @ApiOperation({ summary: 'إعادة محاولة التسليمات الفاشلة', description: 'إعادة محاولة تسليم الأحداث الفاشلة' })
  @ApiResponse({ status: 200, description: 'تم إعادة المحاولة' })
  async retryFailed() {
    return this.eventsService.retryFailedDeliveries();
  }

  // ==================== Dynamic routes (with :id parameter) ====================

  @Get('subscriptions/:id')
  @RequirePermissions('events:read')
  @ApiOperation({ summary: 'جلب اشتراك محدد', description: 'جلب تفاصيل اشتراك محدد' })
  @ApiParam({ name: 'id', description: 'معرف الاشتراك', type: 'string' })
  @ApiResponse({ status: 200, description: 'تفاصيل الاشتراك', type: SubscriptionResponseDto })
  @ApiResponse({ status: 404, description: 'الاشتراك غير موجود' })
  async findOneSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOneSubscription(id);
  }

  @Put('subscriptions/:id')
  @RequirePermissions('events:update')
  @ApiOperation({ summary: 'تحديث اشتراك', description: 'تحديث بيانات اشتراك موجود' })
  @ApiParam({ name: 'id', description: 'معرف الاشتراك', type: 'string' })
  @ApiResponse({ status: 200, description: 'تم تحديث الاشتراك بنجاح', type: SubscriptionResponseDto })
  @ApiResponse({ status: 404, description: 'الاشتراك غير موجود' })
  async updateSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSubscriptionDto,
  ) {
    return this.eventsService.updateSubscription(id, updateDto);
  }

  @Delete('unsubscribe/:id')
  @RequirePermissions('events:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إلغاء اشتراك', description: 'إلغاء اشتراك في الأحداث' })
  @ApiParam({ name: 'id', description: 'معرف الاشتراك', type: 'string' })
  @ApiResponse({ status: 200, description: 'تم إلغاء الاشتراك بنجاح' })
  @ApiResponse({ status: 404, description: 'الاشتراك غير موجود' })
  async unsubscribe(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.removeSubscription(id);
  }

  @Get(':id')
  @RequirePermissions('events:read')
  @ApiOperation({ summary: 'جلب حدث محدد', description: 'جلب تفاصيل حدث محدد مع حالة التسليم' })
  @ApiParam({ name: 'id', description: 'معرف الحدث', type: 'string' })
  @ApiResponse({ status: 200, description: 'تفاصيل الحدث', type: EventResponseDto })
  @ApiResponse({ status: 404, description: 'الحدث غير موجود' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOneEvent(id);
  }
}
