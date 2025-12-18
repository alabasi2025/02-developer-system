import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 بدء إضافة البيانات التجريبية...');

  // 1. إضافة التكاملات
  console.log('📦 إضافة التكاملات...');
  
  const coreIntegration = await prisma.devIntegration.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Core System',
      nameAr: 'النظام الأساسي',
      type: 'internal',
      baseUrl: 'http://localhost:3001',
      status: 'active',
      healthEndpoint: '/health',
      description: 'النظام الأساسي لإدارة العملاء والفواتير',
    },
  });

  const assetsIntegration = await prisma.devIntegration.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Assets System',
      nameAr: 'نظام الأصول',
      type: 'internal',
      baseUrl: 'http://localhost:3002',
      status: 'active',
      healthEndpoint: '/health',
      description: 'نظام إدارة الأصول والمعدات',
    },
  });

  const billingIntegration = await prisma.devIntegration.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Billing System',
      nameAr: 'نظام الفوترة',
      type: 'internal',
      baseUrl: 'http://localhost:3003',
      status: 'active',
      healthEndpoint: '/health',
      description: 'نظام الفوترة والتحصيل',
    },
  });

  // 2. إضافة مفاتيح API
  console.log('🔑 إضافة مفاتيح API...');
  
  await prisma.devApiKey.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      integrationId: coreIntegration.id,
      systemId: 'core',
      name: 'Core System API Key',
      keyHash: 'hashed_key_core_123',
      keyPrefix: 'core_123',
      permissions: { read: true, write: true, admin: false },
      rateLimit: 1000,
      isActive: true,
    },
  });

  await prisma.devApiKey.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      integrationId: assetsIntegration.id,
      systemId: 'assets',
      name: 'Assets System API Key',
      keyHash: 'hashed_key_assets_456',
      keyPrefix: 'asst_456',
      permissions: { read: true, write: true, admin: false },
      rateLimit: 500,
      isActive: true,
    },
  });

  // 3. إضافة بوابات الدفع
  console.log('💳 إضافة بوابات الدفع...');
  
  await prisma.devPaymentGateway.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      name: 'STC Pay',
      provider: 'stcpay',
      apiUrl: 'https://api.stcpay.com.sa',
      credentials: { merchantId: 'stc_merchant_123', apiKey: 'encrypted_key' },
      isActive: true,
      config: { sandbox: true },
      supportedCurrencies: ['SAR'],
    },
  });

  await prisma.devPaymentGateway.upsert({
    where: { id: '00000000-0000-0000-0000-000000000202' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000202',
      name: 'Mada',
      provider: 'mada',
      apiUrl: 'https://api.mada.com.sa',
      credentials: { terminalId: 'mada_terminal_456', apiKey: 'encrypted_key' },
      isActive: true,
      config: { sandbox: true },
      supportedCurrencies: ['SAR'],
    },
  });

  // 4. إضافة مزودي الرسائل
  console.log('📧 إضافة مزودي الرسائل...');
  
  await prisma.devMessageProvider.upsert({
    where: { id: '00000000-0000-0000-0000-000000000301' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000301',
      name: 'Unifonic SMS',
      type: 'sms',
      provider: 'unifonic',
      apiUrl: 'https://api.unifonic.com',
      credentials: { apiKey: 'unifonic_api_key', senderId: 'ELECTRICITY' },
      isActive: true,
      config: { sandbox: true },
    },
  });

  await prisma.devMessageProvider.upsert({
    where: { id: '00000000-0000-0000-0000-000000000302' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000302',
      name: 'SendGrid Email',
      type: 'email',
      provider: 'sendgrid',
      apiUrl: 'https://api.sendgrid.com',
      credentials: { apiKey: 'sendgrid_api_key', fromEmail: 'noreply@electricity.sa' },
      isActive: true,
      config: { sandbox: true },
    },
  });

  // 5. إضافة أجهزة IoT
  console.log('📡 إضافة أجهزة IoT...');
  
  await prisma.devIotDevice.upsert({
    where: { id: '00000000-0000-0000-0000-000000000401' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000401',
      deviceId: 'METER-001',
      deviceType: 'smart_meter',
      name: 'عداد ذكي - حي النخيل',
      manufacturer: 'Acrel',
      model: 'ADL400',
      status: 'active',
      isOnline: true,
      lastSeenAt: new Date(),
      config: { readingInterval: 15 },
    },
  });

  await prisma.devIotDevice.upsert({
    where: { id: '00000000-0000-0000-0000-000000000402' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000402',
      deviceId: 'METER-002',
      deviceType: 'smart_meter',
      name: 'عداد ذكي - حي الورود',
      manufacturer: 'Acrel',
      model: 'ADL400',
      status: 'active',
      isOnline: true,
      lastSeenAt: new Date(),
      config: { readingInterval: 15 },
    },
  });

  // 6. إضافة نماذج AI
  console.log('🤖 إضافة نماذج الذكاء الاصطناعي...');
  
  await prisma.devAiModel.upsert({
    where: { id: '00000000-0000-0000-0000-000000000501' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000501',
      name: 'نموذج التنبؤ بالاستهلاك',
      type: 'prediction',
      version: '1.0.0',
      status: 'active',
      config: { algorithm: 'LSTM', epochs: 100 },
      metrics: { accuracy: 0.92, mse: 0.05 },
      lastTrainedAt: new Date(),
    },
  });

  await prisma.devAiModel.upsert({
    where: { id: '00000000-0000-0000-0000-000000000502' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000502',
      name: 'نموذج كشف الأعطال',
      type: 'anomaly_detection',
      version: '1.0.0',
      status: 'active',
      config: { algorithm: 'IsolationForest', contamination: 0.1 },
      metrics: { precision: 0.88, recall: 0.85 },
      lastTrainedAt: new Date(),
    },
  });

  // 7. إضافة تنبيهات
  console.log('🔔 إضافة التنبيهات...');
  
  await prisma.devAlert.upsert({
    where: { id: '00000000-0000-0000-0000-000000000601' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000601',
      alertType: 'warning',
      severity: 2,
      title: 'استهلاك مرتفع',
      message: 'تم اكتشاف استهلاك مرتفع في منطقة حي النخيل',
      source: 'ai_model',
      status: 'open',
    },
  });

  await prisma.devAlert.upsert({
    where: { id: '00000000-0000-0000-0000-000000000602' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000602',
      alertType: 'info',
      severity: 4,
      title: 'صيانة مجدولة',
      message: 'صيانة مجدولة للنظام يوم الجمعة القادم',
      source: 'system',
      status: 'open',
    },
  });

  console.log('✅ تم إضافة البيانات التجريبية بنجاح!');
}

main()
  .catch((e) => {
    console.error('❌ خطأ في إضافة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
