import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import OpenAI from 'openai';

export interface AnalyzeDataDto {
  dataType: 'consumption' | 'billing' | 'outages' | 'maintenance' | 'customer';
  data: any[];
  options?: {
    includeForecasting?: boolean;
    includeTrends?: boolean;
    includeAnomalies?: boolean;
    forecastPeriods?: number;
  };
}

export interface PredictDto {
  modelType: 'consumption' | 'demand' | 'outage' | 'maintenance' | 'churn';
  inputData: Record<string, any>;
  options?: {
    horizon?: number;
    confidence?: number;
  };
}

export interface ChatDto {
  message: string;
  context?: {
    systemId?: string;
    customerId?: string;
    previousMessages?: Array<{ role: string; content: string }>;
  };
  options?: {
    language?: 'ar' | 'en';
    maxTokens?: number;
  };
}

export interface ExtractDataDto {
  text: string;
  extractionType: 'customer_info' | 'meter_reading' | 'complaint' | 'invoice' | 'general';
  schema?: Record<string, any>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // ==================== Data Analysis ====================

  async analyzeData(dto: AnalyzeDataDto) {
    this.logger.log(`Analyzing ${dto.dataType} data with ${dto.data.length} records`);

    const startTime = Date.now();
    const options = dto.options || {};

    // Prepare analysis prompt
    const systemPrompt = this.getAnalysisSystemPrompt(dto.dataType);
    const userPrompt = this.buildAnalysisPrompt(dto);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      const processingTime = Date.now() - startTime;

      // Log the analysis
      await this.logAiRequest({
        requestType: 'analysis',
        model: 'gpt-4.1-mini',
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        processingTime,
        metadata: { dataType: dto.dataType, recordCount: dto.data.length },
      });

      return {
        dataType: dto.dataType,
        recordCount: dto.data.length,
        analysis: result,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Analysis failed: ${error.message}`);
      throw new BadRequestException(`فشل التحليل: ${error.message}`);
    }
  }

  private getAnalysisSystemPrompt(dataType: string): string {
    const prompts: Record<string, string> = {
      consumption: `أنت محلل بيانات متخصص في استهلاك الكهرباء. قم بتحليل البيانات المقدمة واستخرج:
- الأنماط والاتجاهات
- القيم الشاذة
- التوقعات المستقبلية
- التوصيات لتحسين الكفاءة
أجب بصيغة JSON.`,
      billing: `أنت محلل بيانات متخصص في الفوترة. قم بتحليل البيانات المقدمة واستخرج:
- إحصائيات الفواتير
- أنماط الدفع
- المتأخرات والمخاطر
- التوصيات
أجب بصيغة JSON.`,
      outages: `أنت محلل بيانات متخصص في انقطاعات الكهرباء. قم بتحليل البيانات واستخرج:
- أنماط الانقطاعات
- المناطق الأكثر تأثراً
- الأسباب الرئيسية
- التوصيات للوقاية
أجب بصيغة JSON.`,
      maintenance: `أنت محلل بيانات متخصص في صيانة الشبكات الكهربائية. قم بتحليل البيانات واستخرج:
- حالة المعدات
- جداول الصيانة المقترحة
- التنبؤ بالأعطال
- التوصيات
أجب بصيغة JSON.`,
      customer: `أنت محلل بيانات متخصص في خدمة العملاء. قم بتحليل البيانات واستخرج:
- رضا العملاء
- أنماط الشكاوى
- فرص التحسين
- التوصيات
أجب بصيغة JSON.`,
    };

    return prompts[dataType] || prompts.customer;
  }

  private buildAnalysisPrompt(dto: AnalyzeDataDto): string {
    const options = dto.options || {};
    let prompt = `قم بتحليل البيانات التالية:\n\n${JSON.stringify(dto.data.slice(0, 100), null, 2)}`;

    if (options.includeForecasting) {
      prompt += `\n\nقم بتضمين توقعات لـ ${options.forecastPeriods || 7} فترات قادمة.`;
    }
    if (options.includeTrends) {
      prompt += '\n\nقم بتحديد الاتجاهات الرئيسية.';
    }
    if (options.includeAnomalies) {
      prompt += '\n\nقم بتحديد القيم الشاذة.';
    }

    return prompt;
  }

  // ==================== Predictions ====================

  async predict(dto: PredictDto) {
    this.logger.log(`Making prediction for ${dto.modelType}`);

    const startTime = Date.now();
    const options = dto.options || {};

    const systemPrompt = this.getPredictionSystemPrompt(dto.modelType);
    const userPrompt = `قم بالتنبؤ بناءً على البيانات التالية:\n${JSON.stringify(dto.inputData, null, 2)}
    
الأفق الزمني: ${options.horizon || 30} يوم
مستوى الثقة المطلوب: ${options.confidence || 0.95}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      const processingTime = Date.now() - startTime;

      await this.logAiRequest({
        requestType: 'prediction',
        model: 'gpt-4.1-mini',
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        processingTime,
        metadata: { modelType: dto.modelType },
      });

      return {
        modelType: dto.modelType,
        prediction: result,
        confidence: options.confidence || 0.95,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Prediction failed: ${error.message}`);
      throw new BadRequestException(`فشل التنبؤ: ${error.message}`);
    }
  }

  private getPredictionSystemPrompt(modelType: string): string {
    const prompts: Record<string, string> = {
      consumption: `أنت نموذج تنبؤ باستهلاك الكهرباء. قم بتقديم:
- التنبؤ بالاستهلاك
- فترات الذروة المتوقعة
- عوامل التأثير
أجب بصيغة JSON.`,
      demand: `أنت نموذج تنبؤ بالطلب على الكهرباء. قم بتقديم:
- التنبؤ بالطلب
- أوقات الذروة
- التوصيات لإدارة الحمل
أجب بصيغة JSON.`,
      outage: `أنت نموذج تنبؤ بانقطاعات الكهرباء. قم بتقديم:
- احتمالية الانقطاع
- المناطق المعرضة للخطر
- التوصيات الوقائية
أجب بصيغة JSON.`,
      maintenance: `أنت نموذج تنبؤ بالصيانة. قم بتقديم:
- المعدات التي تحتاج صيانة
- الأولويات
- الجدول الزمني المقترح
أجب بصيغة JSON.`,
      churn: `أنت نموذج تنبؤ بتسرب العملاء. قم بتقديم:
- احتمالية التسرب
- العوامل المؤثرة
- استراتيجيات الاحتفاظ
أجب بصيغة JSON.`,
    };

    return prompts[modelType] || prompts.consumption;
  }

  // ==================== Chat / NLP ====================

  async chat(dto: ChatDto) {
    this.logger.log(`Processing chat message`);

    const startTime = Date.now();
    const options = dto.options || {};
    const context = dto.context || {};

    const systemPrompt = this.getChatSystemPrompt(options.language || 'ar');
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add previous messages if provided
    if (context.previousMessages) {
      for (const msg of context.previousMessages.slice(-10)) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    messages.push({ role: 'user', content: dto.message });

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages,
        temperature: 0.7,
        max_tokens: options.maxTokens || 1000,
      });

      const response = completion.choices[0].message.content || '';
      const processingTime = Date.now() - startTime;

      await this.logAiRequest({
        requestType: 'chat',
        model: 'gpt-4.1-mini',
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        processingTime,
        metadata: { language: options.language || 'ar' },
      });

      return {
        response,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Chat failed: ${error.message}`);
      throw new BadRequestException(`فشل المحادثة: ${error.message}`);
    }
  }

  private getChatSystemPrompt(language: string): string {
    if (language === 'ar') {
      return `أنت مساعد ذكي لشركة كهرباء. يمكنك المساعدة في:
- الاستفسارات عن الفواتير والاستهلاك
- الإبلاغ عن الأعطال
- معلومات عن الخدمات
- الدعم الفني
أجب بشكل مهني ومفيد باللغة العربية.`;
    }
    
    return `You are an intelligent assistant for an electricity company. You can help with:
- Billing and consumption inquiries
- Reporting outages
- Service information
- Technical support
Respond professionally and helpfully in English.`;
  }

  // ==================== Data Extraction ====================

  async extractData(dto: ExtractDataDto) {
    this.logger.log(`Extracting ${dto.extractionType} data from text`);

    const startTime = Date.now();
    const systemPrompt = this.getExtractionSystemPrompt(dto.extractionType, dto.schema);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dto.text },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      const processingTime = Date.now() - startTime;

      await this.logAiRequest({
        requestType: 'extraction',
        model: 'gpt-4.1-mini',
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        processingTime,
        metadata: { extractionType: dto.extractionType },
      });

      return {
        extractionType: dto.extractionType,
        extractedData: result,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Extraction failed: ${error.message}`);
      throw new BadRequestException(`فشل الاستخراج: ${error.message}`);
    }
  }

  private getExtractionSystemPrompt(extractionType: string, schema?: Record<string, any>): string {
    const basePrompts: Record<string, string> = {
      customer_info: `استخرج معلومات العميل من النص:
- الاسم
- رقم الهوية
- رقم الهاتف
- العنوان
- البريد الإلكتروني
أجب بصيغة JSON.`,
      meter_reading: `استخرج قراءة العداد من النص:
- رقم العداد
- القراءة الحالية
- تاريخ القراءة
- نوع القراءة
أجب بصيغة JSON.`,
      complaint: `استخرج تفاصيل الشكوى من النص:
- نوع الشكوى
- الوصف
- الموقع
- الأولوية
أجب بصيغة JSON.`,
      invoice: `استخرج تفاصيل الفاتورة من النص:
- رقم الفاتورة
- المبلغ
- تاريخ الاستحقاق
- فترة الفوترة
أجب بصيغة JSON.`,
      general: `استخرج المعلومات المهمة من النص وأجب بصيغة JSON.`,
    };

    let prompt = basePrompts[extractionType] || basePrompts.general;

    if (schema) {
      prompt += `\n\nاستخدم هذا المخطط للإخراج:\n${JSON.stringify(schema, null, 2)}`;
    }

    return prompt;
  }

  // ==================== Sentiment Analysis ====================

  async analyzeSentiment(texts: string[]) {
    this.logger.log(`Analyzing sentiment for ${texts.length} texts`);

    const startTime = Date.now();
    const systemPrompt = `قم بتحليل المشاعر للنصوص التالية. لكل نص، حدد:
- sentiment: positive, negative, neutral
- confidence: 0-1
- aspects: الجوانب المذكورة (الخدمة، السعر، الجودة، إلخ)
أجب بصيغة JSON مع مصفوفة results.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(texts) },
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      const processingTime = Date.now() - startTime;

      await this.logAiRequest({
        requestType: 'sentiment',
        model: 'gpt-4.1-mini',
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        processingTime,
        metadata: { textCount: texts.length },
      });

      return {
        results: result.results || [],
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Sentiment analysis failed: ${error.message}`);
      throw new BadRequestException(`فشل تحليل المشاعر: ${error.message}`);
    }
  }

  // ==================== Document Classification ====================

  async classifyDocument(document: string, categories: string[]) {
    this.logger.log(`Classifying document into ${categories.length} categories`);

    const startTime = Date.now();
    const systemPrompt = `قم بتصنيف المستند إلى إحدى الفئات التالية:
${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

أجب بصيغة JSON مع:
- category: الفئة المختارة
- confidence: مستوى الثقة (0-1)
- reasoning: سبب التصنيف`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: document },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      const processingTime = Date.now() - startTime;

      await this.logAiRequest({
        requestType: 'classification',
        model: 'gpt-4.1-mini',
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        processingTime,
        metadata: { categoryCount: categories.length },
      });

      return {
        ...result,
        processingTime,
      };
    } catch (error: any) {
      this.logger.error(`Classification failed: ${error.message}`);
      throw new BadRequestException(`فشل التصنيف: ${error.message}`);
    }
  }

  // ==================== Logging ====================

  private async logAiRequest(data: {
    requestType: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    processingTime: number;
    metadata?: Record<string, any>;
  }) {
    try {
      await this.prisma.devAiRequest.create({
        data: {
          requestType: data.requestType,
          model: data.model,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          totalTokens: data.inputTokens + data.outputTokens,
          processingTime: data.processingTime,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log AI request: ${error}`);
    }
  }

  // ==================== Usage Statistics ====================

  async getUsageStats(query: { fromDate?: string; toDate?: string }) {
    const where: any = {};
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const [
      totalRequests,
      totalTokens,
      avgProcessingTime,
      requestsByType,
    ] = await Promise.all([
      this.prisma.devAiRequest.count({ where }),
      this.prisma.devAiRequest.aggregate({
        where,
        _sum: { totalTokens: true },
      }),
      this.prisma.devAiRequest.aggregate({
        where,
        _avg: { processingTime: true },
      }),
      this.prisma.devAiRequest.groupBy({
        by: ['requestType'],
        where,
        _count: true,
        _sum: { totalTokens: true },
      }),
    ]);

    return {
      totalRequests,
      totalTokens: totalTokens._sum.totalTokens || 0,
      avgProcessingTime: Math.round(avgProcessingTime._avg.processingTime || 0),
      requestsByType: requestsByType.map(r => ({
        type: r.requestType,
        count: r._count,
        tokens: r._sum.totalTokens || 0,
      })),
    };
  }
}
