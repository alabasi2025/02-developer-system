# نظام المطور - Developer System

## العمود الفقري للتكامل بين جميع أنظمة إدارة الكهرباء

نظام المطور هو النظام المركزي الذي يربط جميع أنظمة إدارة الكهرباء العشرة ويوفر البنية التحتية للتكامل والتواصل بينها.

## الأنظمة المتكاملة

| # | النظام | الرمز | الوصف |
|---|--------|-------|-------|
| 1 | النظام الأم | core | إدارة العملاء والعدادات |
| 2 | نظام الأصول | assets | إدارة المحولات والشبكات |
| 3 | العمليات الميدانية | field | إدارة الفرق والمهام |
| 4 | نظام المراقبة | scada | مراقبة الشبكة في الوقت الفعلي |
| 5 | نظام المخزون | inventory | إدارة المواد والمستودعات |
| 6 | نظام الفوترة | billing | الفواتير والتحصيل |
| 7 | الموارد البشرية | hr | إدارة الموظفين |
| 8 | نظام التقارير | reports | التقارير والتحليلات |
| 9 | نظام المشاريع | projects | إدارة المشاريع |

## الميزات الرئيسية

### 1. إدارة التكاملات (Integrations)
- تسجيل وإدارة التكاملات الداخلية والخارجية
- فحص صحة الأنظمة المتصلة
- إعدادات مخصصة لكل تكامل

### 2. مفاتيح API (API Keys)
- إنشاء وإدارة مفاتيح الوصول
- صلاحيات دقيقة لكل مفتاح
- تتبع الاستخدام وRate Limiting

### 3. نظام الأحداث (Event System)
- نشر الأحداث بين الأنظمة
- اشتراكات مخصصة للأحداث
- Webhooks للتكاملات الخارجية

### 4. بوابة API (API Gateway)
- توجيه الطلبات للأنظمة المستهدفة
- Rate Limiting وحماية من الإساءة
- تسجيل جميع الطلبات

### 5. المراقبة (Monitoring)
- مراقبة صحة جميع الأنظمة
- تنبيهات تقنية
- مقاييس الأداء

### 6. المدفوعات (Payments)
- تكامل مع بوابات الدفع (STC Pay, Mada, إلخ)
- معالجة المدفوعات والاستردادات
- Webhooks لإشعارات الدفع

### 7. الرسائل (Messages)
- إرسال SMS, Email, WhatsApp, Push
- قوالب رسائل قابلة للتخصيص
- إرسال جماعي

### 8. إنترنت الأشياء (IoT)
- إدارة أجهزة العدادات الذكية
- استقبال البيانات في الوقت الفعلي
- إرسال الأوامر للأجهزة
- تنبيهات ذكية

### 9. الذكاء الاصطناعي (AI)
- تحليل البيانات
- التنبؤ بالاستهلاك والأعطال
- معالجة اللغة الطبيعية
- تصنيف المستندات

## البنية التقنية

```
apps/
├── api/                    # Backend NestJS
│   └── src/
│       ├── app/           # App module
│       ├── prisma/        # Prisma service
│       └── modules/       # Feature modules
│           ├── integrations/
│           ├── api-keys/
│           ├── events/
│           ├── gateway/
│           ├── monitoring/
│           ├── payments/
│           ├── messages/
│           ├── iot/
│           └── ai/
├── web/                    # Frontend Angular
└── mobile/                 # Mobile app (future)

prisma/
└── schema.prisma          # Database schema

generated/
└── prisma/                # Generated Prisma client
```

## التثبيت والتشغيل

### المتطلبات
- Node.js 18+
- PostgreSQL 14+
- pnpm

### التثبيت

```bash
# استنساخ المستودع
git clone https://github.com/alabasi2025/systems-blueprint.git
cd 02-developer-system

# تثبيت الاعتماديات
pnpm install

# إعداد قاعدة البيانات
npx prisma db push
npx prisma generate

# تشغيل التطبيق
npx nx serve api
```

### متغيرات البيئة

```env
DATABASE_URL="postgresql://user:password@localhost:5432/developer_system"
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=your-api-key
JWT_SECRET=your-secret
```

## API Documentation

بعد تشغيل التطبيق، يمكن الوصول لوثائق API على:
```
http://localhost:3000/docs
```

## نقاط النهاية الرئيسية

| المسار | الوصف |
|--------|-------|
| `POST /api/v1/integrations` | إنشاء تكامل جديد |
| `POST /api/v1/api-keys` | إنشاء مفتاح API |
| `POST /api/v1/events/publish` | نشر حدث |
| `POST /api/v1/gateway/proxy` | توجيه طلب |
| `GET /api/v1/monitoring/health` | فحص صحة الأنظمة |
| `POST /api/v1/payments/process` | معالجة دفعة |
| `POST /api/v1/messages/send` | إرسال رسالة |
| `POST /api/v1/iot/data` | استقبال بيانات IoT |
| `POST /api/v1/ai/analyze` | تحليل بيانات |

## المساهمة

نرحب بالمساهمات! يرجى قراءة دليل المساهمة قبل البدء.

## الترخيص

MIT License

---

**نظام المطور** - جزء من مشروع أنظمة إدارة الكهرباء المتكاملة
