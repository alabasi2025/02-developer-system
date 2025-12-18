# 📚 توثيق API نظام المطور

## نظرة عامة

نظام المطور هو العمود الفقري للتكامل بين جميع أنظمة إدارة الكهرباء. يوفر واجهات برمجية موحدة للتواصل بين الأنظمة الداخلية والخارجية.

**Base URL:** `http://localhost:3000/api/v1`

**Swagger Documentation:** `http://localhost:3000/docs`

---

## 🔐 المصادقة

### API Keys
جميع الطلبات تتطلب مفتاح API في الـ Header:

```http
Authorization: Bearer <api_key>
X-API-Key: <api_key>
```

### أنواع الصلاحيات
| الصلاحية | الوصف |
|----------|-------|
| `read` | قراءة البيانات |
| `write` | إنشاء وتعديل البيانات |
| `delete` | حذف البيانات |
| `admin` | صلاحيات كاملة |

---

## 📊 نقاط النهاية

### 1. المراقبة (Monitoring)

#### فحص صحة النظام
```http
GET /monitoring/health
```

**الاستجابة:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-18T06:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "database": { "status": "healthy" },
    "api": { "status": "healthy" }
  }
}
```

#### الحصول على المقاييس
```http
GET /monitoring/metrics
```

#### الحصول على السجلات
```http
GET /monitoring/logs?level=info&limit=100
```

#### إنشاء تنبيه
```http
POST /monitoring/alerts
Content-Type: application/json

{
  "title": "عنوان التنبيه",
  "message": "رسالة التنبيه",
  "severity": 3,
  "source": "system-name",
  "metadata": {}
}
```

#### تأكيد تنبيه
```http
PUT /monitoring/alerts/:id/acknowledge
Content-Type: application/json

{
  "acknowledgedBy": "user-id"
}
```

#### حل تنبيه
```http
PUT /monitoring/alerts/:id/resolve
Content-Type: application/json

{
  "resolvedBy": "user-id",
  "resolution": "تم حل المشكلة"
}
```

---

### 2. التكاملات (Integrations)

#### قائمة التكاملات
```http
GET /integrations?page=1&limit=10&type=internal
```

#### إنشاء تكامل
```http
POST /integrations
Content-Type: application/json

{
  "name": "Integration Name",
  "nameAr": "اسم التكامل",
  "type": "internal|external",
  "baseUrl": "http://service-url",
  "authType": "api_key|oauth2|basic",
  "authConfig": {},
  "headers": {},
  "timeout": 30000,
  "retryConfig": {
    "maxRetries": 3,
    "retryDelay": 1000
  }
}
```

#### تحديث تكامل
```http
PUT /integrations/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "status": "active|inactive|error"
}
```

#### حذف تكامل
```http
DELETE /integrations/:id
```

---

### 3. مفاتيح API (API Keys)

#### قائمة المفاتيح
```http
GET /api-keys?page=1&limit=10
```

#### إنشاء مفتاح
```http
POST /api-keys
Content-Type: application/json

{
  "name": "Key Name",
  "permissions": ["read", "write"],
  "rateLimit": 1000,
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "ipWhitelist": ["192.168.1.1"]
}
```

**الاستجابة:**
```json
{
  "apiKey": {
    "id": "uuid",
    "name": "Key Name",
    "keyPrefix": "dev_xxx",
    "permissions": ["read", "write"],
    "rateLimit": 1000
  },
  "rawKey": "dev_xxxxxxxxxxxxxxxxxxxx"
}
```

⚠️ **تحذير:** المفتاح الكامل يُعرض مرة واحدة فقط!

#### إلغاء مفتاح
```http
POST /api-keys/:id/revoke
Content-Type: application/json

{
  "revokedBy": "user-id"
}
```

#### التحقق من مفتاح
```http
POST /api-keys/validate
Content-Type: application/json

{
  "key": "dev_xxxxxxxxxxxxxxxxxxxx"
}
```

---

### 4. الأحداث (Events)

#### نشر حدث
```http
POST /events
Content-Type: application/json

{
  "eventType": "billing.invoice.created",
  "sourceSystem": "billing-system",
  "targetSystem": "notification-system",
  "aggregateId": "invoice-123",
  "aggregateType": "invoice",
  "payload": {
    "invoiceId": "123",
    "amount": 500.00
  },
  "metadata": {
    "correlationId": "xxx"
  },
  "priority": 1
}
```

#### قائمة الأحداث
```http
GET /events?eventType=billing.invoice.created&status=pending
```

#### إعادة محاولة حدث
```http
POST /events/:id/retry
```

#### إنشاء اشتراك
```http
POST /events/subscriptions
Content-Type: application/json

{
  "subscriberId": "service-id",
  "eventTypes": ["billing.*", "user.created"],
  "webhookUrl": "https://service/webhook",
  "secret": "webhook-secret",
  "filters": {
    "sourceSystem": "billing-system"
  },
  "retryPolicy": {
    "maxRetries": 5,
    "backoffMultiplier": 2
  }
}
```

#### قائمة الاشتراكات
```http
GET /events/subscriptions
```

---

### 5. المدفوعات (Payments)

#### قائمة بوابات الدفع
```http
GET /payments/gateways
```

#### إضافة بوابة دفع
```http
POST /payments/gateways
Content-Type: application/json

{
  "name": "STC Pay",
  "nameAr": "STC Pay",
  "provider": "stc_pay",
  "supportedMethods": ["wallet", "card"],
  "config": {
    "merchantId": "xxx"
  },
  "credentials": {
    "apiKey": "xxx",
    "secretKey": "xxx"
  }
}
```

#### معالجة دفعة
```http
POST /payments/process
Content-Type: application/json

{
  "gatewayId": "gateway-uuid",
  "amount": 100.00,
  "currency": "SAR",
  "paymentMethod": "card",
  "customerEmail": "customer@email.com",
  "customerPhone": "+966500000000",
  "metadata": {
    "orderId": "order-123"
  },
  "returnUrl": "https://site/success",
  "cancelUrl": "https://site/cancel"
}
```

#### استرداد دفعة
```http
POST /payments/refund/:transactionId
Content-Type: application/json

{
  "amount": 50.00,
  "reason": "سبب الاسترداد"
}
```

---

### 6. الرسائل (Messages)

#### قائمة مزودي الرسائل
```http
GET /messages/providers
```

#### إضافة مزود رسائل
```http
POST /messages/providers
Content-Type: application/json

{
  "name": "Unifonic",
  "nameAr": "يونيفونك",
  "type": "sms",
  "provider": "unifonic",
  "config": {
    "senderId": "COMPANY"
  },
  "credentials": {
    "appSid": "xxx",
    "appSecret": "xxx"
  }
}
```

#### إرسال رسالة
```http
POST /messages/send
Content-Type: application/json

{
  "type": "sms|email|whatsapp|push",
  "recipient": "+966500000000",
  "subject": "عنوان الرسالة",
  "content": "محتوى الرسالة",
  "templateId": "template-uuid",
  "variables": {
    "name": "أحمد",
    "code": "1234"
  }
}
```

#### قوالب الرسائل
```http
POST /messages/templates
Content-Type: application/json

{
  "name": "OTP Template",
  "nameAr": "قالب رمز التحقق",
  "type": "sms",
  "content": "رمز التحقق الخاص بك هو: {{code}}",
  "variables": ["code"]
}
```

---

### 7. أجهزة IoT

#### قائمة الأجهزة
```http
GET /iot/devices?type=smart_meter&status=online
```

#### تسجيل جهاز
```http
POST /iot/devices
Content-Type: application/json

{
  "deviceId": "SM-001",
  "name": "Smart Meter 001",
  "nameAr": "عداد ذكي 001",
  "type": "smart_meter",
  "manufacturer": "Landis+Gyr",
  "model": "E450",
  "firmwareVersion": "1.2.3",
  "location": {
    "latitude": 24.7136,
    "longitude": 46.6753
  }
}
```

#### إرسال بيانات
```http
POST /iot/data
Content-Type: application/json

{
  "deviceId": "device-uuid",
  "dataType": "energy_reading",
  "value": {
    "consumption": 150.5,
    "voltage": 220,
    "current": 10.5
  },
  "unit": "kWh",
  "timestamp": "2025-12-18T06:00:00.000Z"
}
```

#### إرسال أمر
```http
POST /iot/commands
Content-Type: application/json

{
  "deviceId": "device-uuid",
  "command": "disconnect",
  "parameters": {
    "reason": "non_payment"
  }
}
```

---

### 8. الذكاء الاصطناعي (AI)

#### تحليل البيانات
```http
POST /ai/analyze
Content-Type: application/json

{
  "data": {
    "readings": [100, 150, 200, 180, 220]
  },
  "type": "consumption_pattern",
  "options": {
    "detailed": true
  }
}
```

#### التنبؤ
```http
POST /ai/predict
Content-Type: application/json

{
  "data": {
    "historical": [100, 150, 200, 180, 220],
    "features": ["temperature", "day_of_week"]
  },
  "model": "consumption_forecast",
  "horizon": 7
}
```

#### المحادثة الذكية
```http
POST /ai/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "ما هو استهلاكي هذا الشهر؟" }
  ],
  "systemPrompt": "أنت مساعد ذكي لنظام إدارة الكهرباء",
  "model": "gpt-4.1-mini",
  "maxTokens": 500
}
```

#### تحليل المشاعر
```http
POST /ai/sentiment
Content-Type: application/json

{
  "text": "الخدمة ممتازة وسريعة جداً",
  "language": "ar"
}
```

#### تصنيف المستندات
```http
POST /ai/classify
Content-Type: application/json

{
  "text": "أريد الاستفسار عن فاتورتي",
  "categories": ["billing", "technical", "complaint", "general"]
}
```

#### استخراج البيانات
```http
POST /ai/extract
Content-Type: application/json

{
  "text": "اسمي أحمد محمد، رقم الحساب 123456، أريد الاستفسار عن فاتورة شهر ديسمبر",
  "entityTypes": ["name", "account_number", "date"]
}
```

#### إحصائيات الاستخدام
```http
GET /ai/usage
```

---

### 9. Internal APIs

#### قائمة الأنظمة الداخلية
```http
GET /internal/systems
```

#### فحص صحة الأنظمة
```http
GET /internal/health
```

#### استدعاء نظام داخلي
```http
POST /internal/call
Content-Type: application/json

{
  "systemId": "billing-system",
  "endpoint": "/invoices",
  "method": "GET",
  "data": {}
}
```

---

### 10. External APIs

#### قائمة التكاملات الخارجية
```http
GET /external/integrations
```

#### استدعاء API خارجي
```http
POST /external/call
Content-Type: application/json

{
  "integrationId": "integration-uuid",
  "endpoint": "/api/endpoint",
  "method": "POST",
  "data": {}
}
```

---

### 11. Gateway

#### قائمة الأنظمة المتاحة
```http
GET /gateway/systems
```

#### توجيه طلب
```http
POST /gateway/route
Content-Type: application/json

{
  "targetSystem": "billing-system",
  "path": "/invoices/123",
  "method": "GET",
  "headers": {},
  "body": {}
}
```

---

## 🔄 أكواد الاستجابة

| الكود | الوصف |
|-------|-------|
| 200 | نجاح |
| 201 | تم الإنشاء |
| 400 | طلب غير صالح |
| 401 | غير مصرح |
| 403 | ممنوع |
| 404 | غير موجود |
| 429 | تجاوز الحد المسموح |
| 500 | خطأ في الخادم |

---

## 📝 أنواع الأحداث

| النوع | الوصف |
|-------|-------|
| `billing.invoice.created` | إنشاء فاتورة |
| `billing.payment.received` | استلام دفعة |
| `user.created` | إنشاء مستخدم |
| `user.updated` | تحديث مستخدم |
| `meter.reading.received` | قراءة عداد |
| `meter.alert.triggered` | تنبيه عداد |
| `system.health.changed` | تغيير حالة النظام |

---

## 🛡️ Rate Limiting

- الحد الافتراضي: 1000 طلب/دقيقة
- يمكن تخصيص الحد لكل مفتاح API
- Headers الاستجابة:
  - `X-RateLimit-Limit`: الحد الأقصى
  - `X-RateLimit-Remaining`: المتبقي
  - `X-RateLimit-Reset`: وقت إعادة التعيين

---

## 📞 الدعم

للمساعدة التقنية، يرجى التواصل عبر:
- البريد الإلكتروني: support@electricity.sa
- الهاتف: 920000000
