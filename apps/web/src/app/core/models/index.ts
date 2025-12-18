// Integration Models
export interface Integration {
  id: string;
  name: string;
  nameAr?: string;
  type: 'internal' | 'external' | 'iot' | 'payment' | 'sms' | 'email';
  baseUrl?: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  config?: Record<string, any>;
  healthEndpoint?: string;
  lastHealthCheck?: Date;
  lastHealthStatus?: string;
  retryCount: number;
  timeout: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Key Models
export interface ApiKey {
  id: string;
  name: string;
  key?: string;
  systemId: string;
  permissions: string[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  rateLimit?: number;
  createdAt: Date;
}

// Event Models
export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed';
  createdAt: Date;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  subscriberSystem: string;
  webhookUrl?: string;
  isActive: boolean;
  createdAt: Date;
}

// Monitoring Models
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  services: Record<string, { status: string }>;
}

export interface SystemMetric {
  id: string;
  systemId: string;
  metricType: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  systemId?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
}

// IoT Models
export interface IotDevice {
  id: string;
  deviceId: string;
  deviceType: string;
  name: string;
  nameAr?: string;
  manufacturer?: string;
  model?: string;
  status: 'registered' | 'active' | 'offline' | 'error';
  isOnline: boolean;
  lastSeenAt?: Date;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  createdAt: Date;
}

export interface IotData {
  id: string;
  deviceId: string;
  dataType: string;
  value: any;
  unit?: string;
  timestamp: Date;
}

// Payment Models
export interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  supportedCurrencies: string[];
  createdAt: Date;
}

export interface PaymentTransaction {
  id: string;
  gatewayId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  type: 'payment' | 'refund';
  createdAt: Date;
}

// Message Models
export interface MessageProvider {
  id: string;
  name: string;
  type: 'sms' | 'email' | 'whatsapp' | 'push';
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  sentCount: number;
  createdAt: Date;
}

export interface Message {
  id: string;
  type: string;
  recipient: string;
  subject?: string;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  createdAt: Date;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
