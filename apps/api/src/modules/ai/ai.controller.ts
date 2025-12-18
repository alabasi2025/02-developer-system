import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AiService, AnalyzeDataDto, PredictDto, ChatDto, ExtractDataDto } from './ai.service';

@ApiTags('الذكاء الاصطناعي - AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'تحليل البيانات', description: 'تحليل البيانات باستخدام الذكاء الاصطناعي' })
  @ApiResponse({ status: 200, description: 'نتائج التحليل' })
  async analyzeData(@Body() dto: AnalyzeDataDto) {
    return this.aiService.analyzeData(dto);
  }

  @Post('predict')
  @ApiOperation({ summary: 'التنبؤ', description: 'التنبؤ باستخدام نماذج الذكاء الاصطناعي' })
  @ApiResponse({ status: 200, description: 'نتائج التنبؤ' })
  async predict(@Body() dto: PredictDto) {
    return this.aiService.predict(dto);
  }

  @Post('chat')
  @ApiOperation({ summary: 'المحادثة الذكية', description: 'التفاعل مع المساعد الذكي' })
  @ApiResponse({ status: 200, description: 'رد المساعد' })
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }

  @Post('extract')
  @ApiOperation({ summary: 'استخراج البيانات', description: 'استخراج البيانات من النصوص' })
  @ApiResponse({ status: 200, description: 'البيانات المستخرجة' })
  async extractData(@Body() dto: ExtractDataDto) {
    return this.aiService.extractData(dto);
  }

  @Post('sentiment')
  @ApiOperation({ summary: 'تحليل المشاعر', description: 'تحليل مشاعر النصوص' })
  @ApiResponse({ status: 200, description: 'نتائج التحليل' })
  async analyzeSentiment(@Body() data: { texts: string[] }) {
    return this.aiService.analyzeSentiment(data.texts);
  }

  @Post('classify')
  @ApiOperation({ summary: 'تصنيف المستندات', description: 'تصنيف المستندات إلى فئات' })
  @ApiResponse({ status: 200, description: 'نتيجة التصنيف' })
  async classifyDocument(@Body() data: { document: string; categories: string[] }) {
    return this.aiService.classifyDocument(data.document, data.categories);
  }

  @Get('usage')
  @ApiOperation({ summary: 'إحصائيات الاستخدام', description: 'جلب إحصائيات استخدام الذكاء الاصطناعي' })
  @ApiResponse({ status: 200, description: 'إحصائيات الاستخدام' })
  async getUsageStats(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.aiService.getUsageStats({ fromDate, toDate });
  }
}
