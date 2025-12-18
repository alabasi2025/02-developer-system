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
import { ApiKeysService } from './api-keys.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyCreatedResponseDto,
  ApiKeyQueryDto,
  RotateApiKeyResponseDto,
  ValidateApiKeyDto,
  ValidateApiKeyResponseDto,
} from './dto/api-key.dto';

@ApiTags('مفاتيح API - API Keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء مفتاح API جديد', description: 'إنشاء مفتاح API جديد لنظام معين' })
  @ApiResponse({ status: 201, description: 'تم إنشاء المفتاح بنجاح', type: ApiKeyCreatedResponseDto })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async create(@Body() createDto: CreateApiKeyDto) {
    return this.apiKeysService.create(createDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'جلب جميع مفاتيح API', description: 'جلب قائمة بجميع مفاتيح API مع إمكانية الفلترة' })
  @ApiResponse({ status: 200, description: 'قائمة مفاتيح API' })
  async findAll(@Query() query: ApiKeyQueryDto) {
    return this.apiKeysService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'جلب مفتاح API محدد', description: 'جلب تفاصيل مفتاح API محدد' })
  @ApiParam({ name: 'id', description: 'معرف المفتاح', type: 'string' })
  @ApiResponse({ status: 200, description: 'تفاصيل المفتاح', type: ApiKeyResponseDto })
  @ApiResponse({ status: 404, description: 'المفتاح غير موجود' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeysService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث مفتاح API', description: 'تحديث بيانات مفتاح API موجود' })
  @ApiParam({ name: 'id', description: 'معرف المفتاح', type: 'string' })
  @ApiResponse({ status: 200, description: 'تم تحديث المفتاح بنجاح', type: ApiKeyResponseDto })
  @ApiResponse({ status: 404, description: 'المفتاح غير موجود' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إلغاء مفتاح API', description: 'إلغاء مفتاح API (soft delete)' })
  @ApiParam({ name: 'id', description: 'معرف المفتاح', type: 'string' })
  @ApiResponse({ status: 200, description: 'تم إلغاء المفتاح بنجاح' })
  @ApiResponse({ status: 404, description: 'المفتاح غير موجود' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeysService.remove(id);
  }

  @Post(':id/rotate')
  @ApiOperation({ summary: 'تدوير مفتاح API', description: 'إنشاء مفتاح جديد وإلغاء القديم' })
  @ApiParam({ name: 'id', description: 'معرف المفتاح', type: 'string' })
  @ApiResponse({ status: 200, description: 'تم تدوير المفتاح بنجاح', type: RotateApiKeyResponseDto })
  @ApiResponse({ status: 404, description: 'المفتاح غير موجود' })
  async rotate(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeysService.rotate(id);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'التحقق من مفتاح API', description: 'التحقق من صحة مفتاح API وصلاحياته' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق', type: ValidateApiKeyResponseDto })
  async validate(@Body() validateDto: ValidateApiKeyDto) {
    return this.apiKeysService.validate(validateDto.apiKey, validateDto.requiredPermission);
  }
}
