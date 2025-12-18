import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface MessageProvider {
  id: string;
  name: string;
  nameAr: string;
  type: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageTemplate {
  id: string;
  name: string;
  nameAr: string;
  type: string;
  subject?: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevMessage {
  id: string;
  providerId: string;
  type: string;
  recipient: string;
  subject?: string;
  content: string;
  status: string;
  externalId?: string;
  metadata: any;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface SendMessageDto {
  type: string;
  recipient: string;
  subject?: string;
  content?: string;
  templateId?: string;
  variables?: Record<string, string>;
  providerId?: string;
  metadata?: any;
}

export interface CreateProviderDto {
  name: string;
  nameAr: string;
  type: string;
  provider: string;
  config: any;
  credentials: any;
  isDefault?: boolean;
}

export interface CreateTemplateDto {
  name: string;
  nameAr: string;
  type: string;
  subject?: string;
  content: string;
  variables?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MessagesService {
  private readonly api = inject(ApiService);

  // Providers
  getProviders(params?: any): Observable<{ data: MessageProvider[]; meta: any }> {
    return this.api.get<{ data: MessageProvider[]; meta: any }>('/messages/providers', params);
  }

  getProviderById(id: string): Observable<MessageProvider> {
    return this.api.get<MessageProvider>(`/messages/providers/${id}`);
  }

  createProvider(data: CreateProviderDto): Observable<MessageProvider> {
    return this.api.post<MessageProvider>('/messages/providers', data);
  }

  updateProvider(id: string, data: Partial<CreateProviderDto>): Observable<MessageProvider> {
    return this.api.put<MessageProvider>(`/messages/providers/${id}`, data);
  }

  deleteProvider(id: string): Observable<void> {
    return this.api.delete<void>(`/messages/providers/${id}`);
  }

  // Templates
  getTemplates(params?: any): Observable<{ data: MessageTemplate[]; meta: any }> {
    return this.api.get<{ data: MessageTemplate[]; meta: any }>('/messages/templates', params);
  }

  getTemplateById(id: string): Observable<MessageTemplate> {
    return this.api.get<MessageTemplate>(`/messages/templates/${id}`);
  }

  createTemplate(data: CreateTemplateDto): Observable<MessageTemplate> {
    return this.api.post<MessageTemplate>('/messages/templates', data);
  }

  updateTemplate(id: string, data: Partial<CreateTemplateDto>): Observable<MessageTemplate> {
    return this.api.put<MessageTemplate>(`/messages/templates/${id}`, data);
  }

  deleteTemplate(id: string): Observable<void> {
    return this.api.delete<void>(`/messages/templates/${id}`);
  }

  // Messages
  getMessages(params?: any): Observable<{ data: DevMessage[]; meta: any }> {
    return this.api.get<{ data: DevMessage[]; meta: any }>('/messages', params);
  }

  sendMessage(data: SendMessageDto): Observable<DevMessage> {
    return this.api.post<DevMessage>('/messages/send', data);
  }

  getMessageStatus(id: string): Observable<DevMessage> {
    return this.api.get<DevMessage>(`/messages/${id}/status`);
  }
}
