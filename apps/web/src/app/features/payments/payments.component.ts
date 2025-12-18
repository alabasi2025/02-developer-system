import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';

import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    ToastModule,
    ChartModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-left"></p-toast>

    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">بوابات الدفع</h1>
          <p class="text-gray-500 mt-1">إدارة بوابات الدفع والمعاملات المالية</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">{{ totalAmount() | number:'1.2-2' }}</p>
            <p class="text-sm text-gray-500 mt-1">إجمالي المدفوعات (ر.س)</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">{{ successfulCount() }}</p>
            <p class="text-sm text-gray-500 mt-1">معاملات ناجحة</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-yellow-600">{{ pendingCount() }}</p>
            <p class="text-sm text-gray-500 mt-1">قيد المعالجة</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-red-600">{{ failedCount() }}</p>
            <p class="text-sm text-gray-500 mt-1">فاشلة</p>
          </div>
        </p-card>
      </div>

      <!-- Gateways -->
      <p-card header="بوابات الدفع المتاحة" styleClass="shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          @for (gateway of gateways(); track gateway.id) {
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <i [class]="getGatewayIcon(gateway.provider) + ' text-xl text-gray-600'"></i>
                  </div>
                  <div>
                    <p class="font-semibold">{{ gateway.name }}</p>
                    <p class="text-xs text-gray-400">{{ gateway.provider }}</p>
                  </div>
                </div>
                <p-tag [value]="gateway.isActive ? 'نشط' : 'معطل'"
                       [severity]="gateway.isActive ? 'success' : 'danger'">
                </p-tag>
              </div>
              <div class="text-sm text-gray-500">
                <p>العملات: {{ gateway.supportedCurrencies?.join(', ') || 'SAR' }}</p>
              </div>
            </div>
          }
        </div>
      </p-card>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <p-card header="المدفوعات الشهرية" styleClass="shadow-sm">
          <p-chart type="bar" [data]="monthlyChartData" [options]="chartOptions"></p-chart>
        </p-card>
        <p-card header="توزيع بوابات الدفع" styleClass="shadow-sm">
          <p-chart type="doughnut" [data]="gatewayDistributionData" [options]="pieOptions"></p-chart>
        </p-card>
      </div>

      <!-- Recent Transactions -->
      <p-card header="آخر المعاملات" styleClass="shadow-sm">
        <p-table [value]="transactions()" 
                 [paginator]="true" 
                 [rows]="10"
                 styleClass="p-datatable-striped">
          <ng-template pTemplate="header">
            <tr>
              <th>رقم المعاملة</th>
              <th>البوابة</th>
              <th>المبلغ</th>
              <th>العملة</th>
              <th>النوع</th>
              <th>الحالة</th>
              <th>التاريخ</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-tx>
            <tr>
              <td class="font-mono text-sm">{{ tx.id.substring(0, 8) }}...</td>
              <td>{{ tx.gatewayName }}</td>
              <td class="font-semibold">{{ tx.amount | number:'1.2-2' }}</td>
              <td>{{ tx.currency }}</td>
              <td>
                <p-tag [value]="tx.type === 'payment' ? 'دفع' : 'استرداد'"
                       [severity]="tx.type === 'payment' ? 'info' : 'warn'">
                </p-tag>
              </td>
              <td>
                <p-tag [value]="getStatusLabel(tx.status)"
                       [severity]="getStatusSeverity(tx.status)">
                </p-tag>
              </td>
              <td class="text-sm text-gray-500">{{ tx.createdAt | date:'short' }}</td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>
  `,
})
export class PaymentsComponent implements OnInit {
  private readonly apiService = inject(ApiService);

  totalAmount = signal(125450.50);
  successfulCount = signal(1250);
  pendingCount = signal(15);
  failedCount = signal(8);

  gateways = signal([
    { id: '1', name: 'STC Pay', provider: 'stc_pay', isActive: true, supportedCurrencies: ['SAR'] },
    { id: '2', name: 'مدى', provider: 'mada', isActive: true, supportedCurrencies: ['SAR'] },
    { id: '3', name: 'Stripe', provider: 'stripe', isActive: false, supportedCurrencies: ['SAR', 'USD'] },
  ]);

  transactions = signal([
    { id: 'tx-001-abc', gatewayName: 'STC Pay', amount: 150.00, currency: 'SAR', type: 'payment', status: 'completed', createdAt: new Date() },
    { id: 'tx-002-def', gatewayName: 'مدى', amount: 320.50, currency: 'SAR', type: 'payment', status: 'completed', createdAt: new Date() },
    { id: 'tx-003-ghi', gatewayName: 'STC Pay', amount: 85.00, currency: 'SAR', type: 'refund', status: 'pending', createdAt: new Date() },
  ]);

  monthlyChartData = {
    labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
    datasets: [
      {
        label: 'المدفوعات (ر.س)',
        data: [18500, 21000, 19500, 24000, 22500, 25000],
        backgroundColor: '#22c55e',
      }
    ]
  };

  gatewayDistributionData = {
    labels: ['STC Pay', 'مدى', 'Stripe'],
    datasets: [
      {
        data: [45, 40, 15],
        backgroundColor: ['#6366f1', '#22c55e', '#f59e0b'],
      }
    ]
  };

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  };

  pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // Load from API
  }

  getGatewayIcon(provider: string): string {
    const icons: Record<string, string> = {
      'stc_pay': 'pi pi-mobile',
      'mada': 'pi pi-credit-card',
      'stripe': 'pi pi-globe',
    };
    return icons[provider] || 'pi pi-credit-card';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'قيد المعالجة',
      'completed': 'مكتمل',
      'failed': 'فاشل',
      'refunded': 'مسترد',
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warn';
      case 'failed': return 'danger';
      case 'refunded': return 'info';
      default: return 'info';
    }
  }
}
