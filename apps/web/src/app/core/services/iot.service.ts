import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface IotDevice {
  id: string;
  deviceId: string;
  name: string;
  nameAr: string;
  type: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  status: string;
  lastSeen?: Date;
  location?: any;
  metadata: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IotData {
  id: string;
  deviceId: string;
  dataType: string;
  value: any;
  unit?: string;
  timestamp: Date;
  metadata: any;
  createdAt: Date;
}

export interface IotCommand {
  id: string;
  deviceId: string;
  command: string;
  parameters: any;
  status: string;
  response?: any;
  sentAt?: Date;
  executedAt?: Date;
  createdAt: Date;
}

export interface IotAlert {
  id: string;
  deviceId: string;
  alertType: string;
  severity: number;
  message: string;
  metadata: any;
  status: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface RegisterDeviceDto {
  deviceId: string;
  name: string;
  nameAr: string;
  type: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  location?: any;
  metadata?: any;
}

export interface IngestDataDto {
  deviceId: string;
  dataType: string;
  value: any;
  unit?: string;
  timestamp?: Date;
  metadata?: any;
}

export interface SendCommandDto {
  deviceId: string;
  command: string;
  parameters?: any;
}

@Injectable({
  providedIn: 'root'
})
export class IotService {
  private readonly api = inject(ApiService);

  // Devices
  getDevices(params?: any): Observable<{ data: IotDevice[]; meta: any }> {
    return this.api.get<{ data: IotDevice[]; meta: any }>('/iot/devices', params);
  }

  getDeviceById(id: string): Observable<IotDevice> {
    return this.api.get<IotDevice>(`/iot/devices/${id}`);
  }

  registerDevice(data: RegisterDeviceDto): Observable<IotDevice> {
    return this.api.post<IotDevice>('/iot/devices', data);
  }

  updateDevice(id: string, data: Partial<RegisterDeviceDto>): Observable<IotDevice> {
    return this.api.put<IotDevice>(`/iot/devices/${id}`, data);
  }

  deleteDevice(id: string): Observable<void> {
    return this.api.delete<void>(`/iot/devices/${id}`);
  }

  // Data
  getDeviceData(deviceId: string, params?: any): Observable<{ data: IotData[]; meta: any }> {
    return this.api.get<{ data: IotData[]; meta: any }>(`/iot/devices/${deviceId}/data`, params);
  }

  ingestData(data: IngestDataDto): Observable<IotData> {
    return this.api.post<IotData>('/iot/data', data);
  }

  // Commands
  getDeviceCommands(deviceId: string, params?: any): Observable<{ data: IotCommand[]; meta: any }> {
    return this.api.get<{ data: IotCommand[]; meta: any }>(`/iot/devices/${deviceId}/commands`, params);
  }

  sendCommand(data: SendCommandDto): Observable<IotCommand> {
    return this.api.post<IotCommand>('/iot/commands', data);
  }

  // Alerts
  getDeviceAlerts(deviceId: string, params?: any): Observable<{ data: IotAlert[]; meta: any }> {
    return this.api.get<{ data: IotAlert[]; meta: any }>(`/iot/devices/${deviceId}/alerts`, params);
  }

  acknowledgeAlert(alertId: string): Observable<IotAlert> {
    return this.api.put<IotAlert>(`/iot/alerts/${alertId}/acknowledge`, {});
  }

  resolveAlert(alertId: string): Observable<IotAlert> {
    return this.api.put<IotAlert>(`/iot/alerts/${alertId}/resolve`, {});
  }
}
