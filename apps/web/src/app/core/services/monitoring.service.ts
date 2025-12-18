import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SystemHealth, SystemMetric, Alert, PaginatedResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private readonly api = inject(ApiService);
  private readonly endpoint = '/monitoring';

  getHealth(): Observable<SystemHealth> {
    return this.api.get<SystemHealth>(`${this.endpoint}/health`);
  }

  getMetrics(query?: { systemId?: string; type?: string; from?: string; to?: string }): Observable<SystemMetric[]> {
    return this.api.get<SystemMetric[]>(`${this.endpoint}/metrics`, query);
  }

  getAlerts(query?: { severity?: string; status?: string; page?: number; limit?: number }): Observable<PaginatedResponse<Alert>> {
    return this.api.get<PaginatedResponse<Alert>>(`${this.endpoint}/alerts`, query);
  }

  acknowledgeAlert(id: string): Observable<Alert> {
    return this.api.post<Alert>(`${this.endpoint}/alerts/${id}/acknowledge`, {});
  }

  resolveAlert(id: string): Observable<Alert> {
    return this.api.post<Alert>(`${this.endpoint}/alerts/${id}/resolve`, {});
  }

  getSystemsStatus(): Observable<{ systemId: string; name: string; status: string; responseTime?: number }[]> {
    return this.api.get(`${this.endpoint}/systems`);
  }
}
