import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Integration, PaginatedResponse } from '../models';

export interface CreateIntegrationDto {
  name: string;
  nameAr?: string;
  type: 'internal' | 'external' | 'iot' | 'payment' | 'sms' | 'email';
  baseUrl?: string;
  status?: string;
  config?: Record<string, any>;
  credentials?: Record<string, any>;
  healthEndpoint?: string;
  retryCount?: number;
  timeout?: number;
  description?: string;
}

export interface IntegrationQuery {
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class IntegrationsService {
  private readonly api = inject(ApiService);
  private readonly endpoint = '/integrations';

  getAll(query?: IntegrationQuery): Observable<PaginatedResponse<Integration>> {
    return this.api.get<PaginatedResponse<Integration>>(this.endpoint, query);
  }

  getById(id: string): Observable<Integration> {
    return this.api.get<Integration>(`${this.endpoint}/${id}`);
  }

  create(data: CreateIntegrationDto): Observable<Integration> {
    return this.api.post<Integration>(this.endpoint, data);
  }

  update(id: string, data: Partial<CreateIntegrationDto>): Observable<Integration> {
    return this.api.put<Integration>(`${this.endpoint}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.endpoint}/${id}`);
  }

  test(id: string): Observable<{ success: boolean; responseTime: number; errorMessage?: string }> {
    return this.api.post(`${this.endpoint}/${id}/test`, {});
  }

  checkHealth(id: string): Observable<{ status: string; responseTime: number }> {
    return this.api.get(`${this.endpoint}/${id}/health`);
  }
}
