import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PaymentGateway {
  id: string;
  name: string;
  nameAr: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  supportedMethods: string[];
  config: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentTransaction {
  id: string;
  gatewayId: string;
  externalId?: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata: any;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessPaymentDto {
  gatewayId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: any;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreateGatewayDto {
  name: string;
  nameAr: string;
  provider: string;
  supportedMethods: string[];
  config: any;
  credentials: any;
  isDefault?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentsService {
  private readonly api = inject(ApiService);

  // Gateways
  getGateways(params?: any): Observable<{ data: PaymentGateway[]; meta: any }> {
    return this.api.get<{ data: PaymentGateway[]; meta: any }>('/payments/gateways', params);
  }

  getGatewayById(id: string): Observable<PaymentGateway> {
    return this.api.get<PaymentGateway>(`/payments/gateways/${id}`);
  }

  createGateway(data: CreateGatewayDto): Observable<PaymentGateway> {
    return this.api.post<PaymentGateway>('/payments/gateways', data);
  }

  updateGateway(id: string, data: Partial<CreateGatewayDto>): Observable<PaymentGateway> {
    return this.api.put<PaymentGateway>(`/payments/gateways/${id}`, data);
  }

  deleteGateway(id: string): Observable<void> {
    return this.api.delete<void>(`/payments/gateways/${id}`);
  }

  // Transactions
  getTransactions(params?: any): Observable<{ data: PaymentTransaction[]; meta: any }> {
    return this.api.get<{ data: PaymentTransaction[]; meta: any }>('/payments/transactions', params);
  }

  processPayment(data: ProcessPaymentDto): Observable<PaymentTransaction> {
    return this.api.post<PaymentTransaction>('/payments/process', data);
  }

  refundPayment(transactionId: string, amount?: number, reason?: string): Observable<PaymentTransaction> {
    return this.api.post<PaymentTransaction>(`/payments/refund/${transactionId}`, { amount, reason });
  }

  getTransactionStatus(transactionId: string): Observable<PaymentTransaction> {
    return this.api.get<PaymentTransaction>(`/payments/status/${transactionId}`);
  }
}
