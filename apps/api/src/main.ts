/**
 * نظام المطور - Developer System
 * العمود الفقري للتكامل بين جميع أنظمة إدارة الكهرباء
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global prefix
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('نظام المطور - Developer System API')
    .setDescription(`
## نظام المطور - العمود الفقري للتكامل

نظام المطور هو النظام المركزي الذي يربط جميع أنظمة إدارة الكهرباء العشرة:
- النظام الأم (Core)
- نظام الأصول (Assets)
- العمليات الميدانية (Field Operations)
- نظام المراقبة (SCADA)
- نظام المخزون (Inventory)
- نظام الفوترة (Billing)
- الموارد البشرية (HR)
- نظام التقارير (Reports)
- نظام المشاريع (Projects)

### الميزات الرئيسية:
- **إدارة التكاملات**: تسجيل وإدارة التكاملات مع الأنظمة الداخلية والخارجية
- **مفاتيح API**: إنشاء وإدارة مفاتيح API مع صلاحيات دقيقة
- **نظام الأحداث**: نشر واستقبال الأحداث بين الأنظمة
- **بوابة API**: توجيه الطلبات وإدارة Rate Limiting
- **المراقبة**: مراقبة صحة الأنظمة والتنبيهات
- **المدفوعات**: تكامل مع بوابات الدفع المختلفة
- **الرسائل**: إرسال SMS/Email/Push
- **IoT**: إدارة أجهزة إنترنت الأشياء
- **الذكاء الاصطناعي**: تحليل البيانات والتنبؤ
    `)
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .addTag('التكاملات - Integrations', 'إدارة التكاملات مع الأنظمة')
    .addTag('مفاتيح API - API Keys', 'إدارة مفاتيح الوصول')
    .addTag('نظام الأحداث - Events', 'نشر واستقبال الأحداث')
    .addTag('بوابة API - Gateway', 'توجيه الطلبات')
    .addTag('المراقبة - Monitoring', 'مراقبة صحة الأنظمة')
    .addTag('المدفوعات - Payments', 'تكامل بوابات الدفع')
    .addTag('الرسائل - Messages', 'إرسال الرسائل')
    .addTag('إنترنت الأشياء - IoT', 'إدارة أجهزة IoT')
    .addTag('الذكاء الاصطناعي - AI', 'خدمات الذكاء الاصطناعي')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'نظام المطور - API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif }
    `,
  });

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(
    `🚀 نظام المطور يعمل على: http://localhost:${port}/${globalPrefix}`,
    'Bootstrap',
  );
  Logger.log(
    `📚 وثائق API متاحة على: http://localhost:${port}/docs`,
    'Bootstrap',
  );
}

bootstrap();
