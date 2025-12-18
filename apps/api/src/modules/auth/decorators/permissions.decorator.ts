import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required permissions for a route
 * @param permissions - Array of permission names required to access the route
 * @example
 * @Permissions('integrations:read', 'integrations:write')
 * @Get('integrations')
 * getIntegrations() { ... }
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Common permission constants for Developer System
 */
export const Permission = {
  // Integrations
  INTEGRATIONS_READ: 'integrations:read',
  INTEGRATIONS_WRITE: 'integrations:write',
  INTEGRATIONS_DELETE: 'integrations:delete',
  
  // API Keys
  API_KEYS_READ: 'api_keys:read',
  API_KEYS_WRITE: 'api_keys:write',
  API_KEYS_DELETE: 'api_keys:delete',
  
  // Events
  EVENTS_READ: 'events:read',
  EVENTS_WRITE: 'events:write',
  EVENTS_DELETE: 'events:delete',
  
  // Payments
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  PAYMENTS_PROCESS: 'payments:process',
  
  // Messages
  MESSAGES_READ: 'messages:read',
  MESSAGES_WRITE: 'messages:write',
  MESSAGES_SEND: 'messages:send',
  
  // IoT
  IOT_READ: 'iot:read',
  IOT_WRITE: 'iot:write',
  IOT_COMMAND: 'iot:command',
  
  // AI
  AI_READ: 'ai:read',
  AI_WRITE: 'ai:write',
  AI_PREDICT: 'ai:predict',
  
  // Monitoring
  MONITORING_READ: 'monitoring:read',
  MONITORING_WRITE: 'monitoring:write',
  
  // Internal APIs
  INTERNAL_API_ACCESS: 'internal_api:access',
  
  // External APIs
  EXTERNAL_API_ACCESS: 'external_api:access',
  
  // Admin
  ADMIN_ALL: '*',
} as const;

export type PermissionType = typeof Permission[keyof typeof Permission];
