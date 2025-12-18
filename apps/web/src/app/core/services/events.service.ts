import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface DevEvent {
  id: string;
  eventType: string;
  sourceSystem: string;
  targetSystem?: string;
  aggregateId?: string;
  aggregateType?: string;
  payload: any;
  metadata: any;
  status: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  processedAt?: Date;
  scheduledFor?: Date;
  createdAt: Date;
}

export interface EventSubscription {
  id: string;
  subscriberId: string;
  eventTypes: string[];
  webhookUrl: string;
  isActive: boolean;
  secret?: string;
  filters?: any;
  retryPolicy?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishEventDto {
  eventType: string;
  sourceSystem: string;
  targetSystem?: string;
  aggregateId?: string;
  aggregateType?: string;
  payload: any;
  metadata?: any;
  priority?: number;
  scheduledFor?: Date;
}

export interface CreateSubscriptionDto {
  subscriberId: string;
  eventTypes: string[];
  webhookUrl: string;
  secret?: string;
  filters?: any;
  retryPolicy?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private readonly api = inject(ApiService);

  // Events
  getEvents(params?: any): Observable<{ data: DevEvent[]; meta: any }> {
    return this.api.get<{ data: DevEvent[]; meta: any }>('/events', params);
  }

  getEventById(id: string): Observable<DevEvent> {
    return this.api.get<DevEvent>(`/events/${id}`);
  }

  publishEvent(data: PublishEventDto): Observable<DevEvent> {
    return this.api.post<DevEvent>('/events', data);
  }

  retryEvent(id: string): Observable<DevEvent> {
    return this.api.post<DevEvent>(`/events/${id}/retry`, {});
  }

  // Subscriptions
  getSubscriptions(params?: any): Observable<{ data: EventSubscription[]; meta: any }> {
    return this.api.get<{ data: EventSubscription[]; meta: any }>('/events/subscriptions', params);
  }

  getSubscriptionById(id: string): Observable<EventSubscription> {
    return this.api.get<EventSubscription>(`/events/subscriptions/${id}`);
  }

  createSubscription(data: CreateSubscriptionDto): Observable<EventSubscription> {
    return this.api.post<EventSubscription>('/events/subscriptions', data);
  }

  updateSubscription(id: string, data: Partial<CreateSubscriptionDto>): Observable<EventSubscription> {
    return this.api.put<EventSubscription>(`/events/subscriptions/${id}`, data);
  }

  deleteSubscription(id: string): Observable<void> {
    return this.api.delete<void>(`/events/subscriptions/${id}`);
  }
}
