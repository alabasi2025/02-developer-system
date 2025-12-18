import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ApiKey {
  id: string;
  integrationId?: string;
  systemId?: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  isActive: boolean;
  ipWhitelist: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyDto {
  integrationId?: string;
  systemId?: string;
  name: string;
  permissions: string[];
  rateLimit?: number;
  expiresAt?: Date;
  ipWhitelist?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiKeysService {
  private readonly api = inject(ApiService);

  getAll(params?: any): Observable<{ data: ApiKey[]; meta: any }> {
    return this.api.get<{ data: ApiKey[]; meta: any }>('/api-keys', params);
  }

  getById(id: string): Observable<ApiKey> {
    return this.api.get<ApiKey>(`/api-keys/${id}`);
  }

  create(data: CreateApiKeyDto): Observable<{ apiKey: ApiKey; rawKey: string }> {
    return this.api.post<{ apiKey: ApiKey; rawKey: string }>('/api-keys', data);
  }

  update(id: string, data: Partial<CreateApiKeyDto>): Observable<ApiKey> {
    return this.api.put<ApiKey>(`/api-keys/${id}`, data);
  }

  revoke(id: string, revokedBy: string): Observable<ApiKey> {
    return this.api.post<ApiKey>(`/api-keys/${id}/revoke`, { revokedBy });
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/api-keys/${id}`);
  }

  validate(key: string): Observable<{ valid: boolean; apiKey?: ApiKey }> {
    return this.api.post<{ valid: boolean; apiKey?: ApiKey }>('/api-keys/validate', { key });
  }
}
