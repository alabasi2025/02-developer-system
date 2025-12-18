import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';

describe('Developer System API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==================== Health Check Tests ====================
  describe('Monitoring Module', () => {
    it('/api/v1/monitoring/health (GET) - should return healthy status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/monitoring/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body.services).toBeDefined();
          expect(res.body.services.database).toBeDefined();
          expect(res.body.services.api).toBeDefined();
        });
    });

    it('/api/v1/monitoring/metrics (GET) - should return metrics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/monitoring/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeDefined();
        });
    });
  });

  // ==================== Integrations Tests ====================
  describe('Integrations Module', () => {
    let integrationId: string;

    it('/api/v1/integrations (POST) - should create integration', () => {
      return request(app.getHttpServer())
        .post('/api/v1/integrations')
        .send({
          name: 'Test Integration',
          nameAr: 'تكامل اختباري',
          type: 'internal',
          baseUrl: 'http://localhost:3001',
          authType: 'api_key',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.name).toBe('Test Integration');
          integrationId = res.body.id;
        });
    });

    it('/api/v1/integrations (GET) - should return integrations list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/integrations')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/api/v1/integrations/:id (GET) - should return single integration', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/integrations/${integrationId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(integrationId);
        });
    });
  });

  // ==================== API Keys Tests ====================
  describe('API Keys Module', () => {
    let apiKeyId: string;

    it('/api/v1/api-keys (POST) - should create API key', () => {
      return request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .send({
          name: 'Test API Key',
          permissions: ['read', 'write'],
          rateLimit: 1000,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.apiKey).toBeDefined();
          expect(res.body.rawKey).toBeDefined();
          apiKeyId = res.body.apiKey.id;
        });
    });

    it('/api/v1/api-keys (GET) - should return API keys list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  // ==================== Events Tests ====================
  describe('Events Module', () => {
    it('/api/v1/events (POST) - should publish event', () => {
      return request(app.getHttpServer())
        .post('/api/v1/events')
        .send({
          eventType: 'test.event',
          sourceSystem: 'test-system',
          payload: { test: true },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.eventType).toBe('test.event');
        });
    });

    it('/api/v1/events (GET) - should return events list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/events')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/api/v1/events/subscriptions (GET) - should return subscriptions', () => {
      return request(app.getHttpServer())
        .get('/api/v1/events/subscriptions')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  // ==================== Payments Tests ====================
  describe('Payments Module', () => {
    it('/api/v1/payments/gateways (GET) - should return payment gateways', () => {
      return request(app.getHttpServer())
        .get('/api/v1/payments/gateways')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  // ==================== Messages Tests ====================
  describe('Messages Module', () => {
    it('/api/v1/messages/providers (GET) - should return message providers', () => {
      return request(app.getHttpServer())
        .get('/api/v1/messages/providers')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('/api/v1/messages/templates (GET) - should return message templates', () => {
      return request(app.getHttpServer())
        .get('/api/v1/messages/templates')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  // ==================== IoT Tests ====================
  describe('IoT Module', () => {
    it('/api/v1/iot/devices (GET) - should return IoT devices', () => {
      return request(app.getHttpServer())
        .get('/api/v1/iot/devices')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  // ==================== AI Tests ====================
  describe('AI Module', () => {
    it('/api/v1/ai/usage (GET) - should return AI usage stats', () => {
      return request(app.getHttpServer())
        .get('/api/v1/ai/usage')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalRequests).toBeDefined();
          expect(res.body.totalTokens).toBeDefined();
        });
    });
  });

  // ==================== Internal API Tests ====================
  describe('Internal API Module', () => {
    it('/api/v1/internal/systems (GET) - should return systems list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/internal/systems')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  // ==================== External API Tests ====================
  describe('External API Module', () => {
    it('/api/v1/external/integrations (GET) - should return external integrations', () => {
      return request(app.getHttpServer())
        .get('/api/v1/external/integrations')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  // ==================== Gateway Tests ====================
  describe('Gateway Module', () => {
    it('/api/v1/gateway/systems (GET) - should return gateway systems', () => {
      return request(app.getHttpServer())
        .get('/api/v1/gateway/systems')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
