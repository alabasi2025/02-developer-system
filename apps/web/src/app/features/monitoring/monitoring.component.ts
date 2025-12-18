import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

import { MonitoringService } from '../../core/services/monitoring.service';
import { SystemHealth, Alert } from '../../core/models';

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    ChartModule,
    ProgressBarModule,
    ToastModule,
    TabsModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-left"></p-toast>

    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">مراقبة النظام</h1>
          <p class="text-gray-500 mt-1">مراقبة صحة وأداء جميع الأنظمة</p>
        </div>
        <div class="flex gap-2">
          <button pButton pRipple 
                  label="تحديث" 
                  icon="pi pi-refresh"
                  class="p-button-outlined"
                  (click)="loadData()">
          </button>
        </div>
      </div>

      <!-- Health Overview -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Health Card -->
        <p-card styleClass="shadow-sm lg:col-span-1">
          <div class="text-center py-4">
            <div class="w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-4"
                 [style.background-color]="getHealthColor(health()?.status) + '20'">
              <div class="w-24 h-24 rounded-full flex items-center justify-center"
                   [style.background-color]="getHealthColor(health()?.status) + '40'">
                <i class="pi pi-heart-fill text-5xl" [style.color]="getHealthColor(health()?.status)"></i>
              </div>
            </div>
            <h2 class="text-2xl font-bold" [style.color]="getHealthColor(health()?.status)">
              {{ getHealthLabel(health()?.status) }}
            </h2>
            <p class="text-gray-500 mt-2">حالة النظام العامة</p>
            <div class="mt-4 text-sm text-gray-400">
              <p>الإصدار: {{ health()?.version || '1.0.0' }}</p>
              <p>وقت التشغيل: {{ formatUptime(health()?.uptime || 0) }}</p>
            </div>
          </div>
        </p-card>

        <!-- Services Status -->
        <p-card header="حالة الخدمات" styleClass="shadow-sm lg:col-span-2">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            @for (service of services(); track service.name) {
              <div class="p-4 rounded-lg border"
                   [class.border-green-200]="service.status === 'healthy'"
                   [class.bg-green-50]="service.status === 'healthy'"
                   [class.border-yellow-200]="service.status === 'degraded'"
                   [class.bg-yellow-50]="service.status === 'degraded'"
                   [class.border-red-200]="service.status === 'unhealthy'"
                   [class.bg-red-50]="service.status === 'unhealthy'">
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-3 h-3 rounded-full"
                        [class.bg-green-500]="service.status === 'healthy'"
                        [class.bg-yellow-500]="service.status === 'degraded'"
                        [class.bg-red-500]="service.status === 'unhealthy'">
                  </span>
                  <span class="font-medium text-gray-700">{{ service.name }}</span>
                </div>
                <p class="text-xs text-gray-500">{{ getHealthLabel(service.status) }}</p>
              </div>
            }
          </div>
        </p-card>
      </div>

      <!-- Tabs -->
      <p-tabs>
        <!-- Systems Tab -->
        <p-tabpanel header="الأنظمة المتصلة">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            @for (system of systemsStatus(); track system.systemId) {
              <p-card styleClass="shadow-sm">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center"
                         [class.bg-green-100]="system.status === 'healthy'"
                         [class.bg-yellow-100]="system.status === 'degraded'"
                         [class.bg-red-100]="system.status === 'unhealthy'">
                      <i class="pi pi-server text-xl"
                         [class.text-green-600]="system.status === 'healthy'"
                         [class.text-yellow-600]="system.status === 'degraded'"
                         [class.text-red-600]="system.status === 'unhealthy'">
                      </i>
                    </div>
                    <div>
                      <p class="font-semibold text-gray-800">{{ system.name }}</p>
                      <p class="text-xs text-gray-400">{{ system.systemId }}</p>
                    </div>
                  </div>
                  <p-tag [value]="getHealthLabel(system.status)"
                         [severity]="getStatusSeverity(system.status)">
                  </p-tag>
                </div>
                <div class="space-y-3">
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-gray-500">وقت الاستجابة</span>
                      <span class="font-medium">{{ system.responseTime || 'N/A' }}ms</span>
                    </div>
                    <p-progressBar [value]="system.responseTime ? Math.min(100, (500 - system.responseTime) / 5) : 0"
                                   [showValue]="false"
                                   styleClass="h-2">
                    </p-progressBar>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500">آخر فحص</span>
                    <span>{{ system.lastCheck | date:'shortTime' }}</span>
                  </div>
                </div>
              </p-card>
            }
          </div>
        </p-tabpanel>

        <!-- Alerts Tab -->
        <p-tabpanel header="التنبيهات">
          <p-table [value]="alerts()" 
                   [paginator]="true" 
                   [rows]="10"
                   styleClass="p-datatable-striped mt-4">
            <ng-template pTemplate="header">
              <tr>
                <th>الخطورة</th>
                <th>العنوان</th>
                <th>الرسالة</th>
                <th>النظام</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>الإجراءات</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-alert>
              <tr>
                <td>
                  <p-tag [value]="getSeverityLabel(alert.severity)"
                         [severity]="getSeveritySeverity(alert.severity)">
                  </p-tag>
                </td>
                <td class="font-medium">{{ alert.title }}</td>
                <td class="text-sm text-gray-600">{{ alert.message }}</td>
                <td>{{ alert.systemId || '-' }}</td>
                <td>
                  <p-tag [value]="getAlertStatusLabel(alert.status)"
                         [severity]="getAlertStatusSeverity(alert.status)">
                  </p-tag>
                </td>
                <td class="text-sm text-gray-500">{{ alert.createdAt | date:'short' }}</td>
                <td>
                  @if (alert.status === 'active') {
                    <button pButton pRipple 
                            icon="pi pi-check" 
                            class="p-button-rounded p-button-text p-button-sm"
                            pTooltip="تأكيد"
                            (click)="acknowledgeAlert(alert)">
                    </button>
                  }
                  @if (alert.status === 'acknowledged') {
                    <button pButton pRipple 
                            icon="pi pi-check-circle" 
                            class="p-button-rounded p-button-text p-button-success p-button-sm"
                            pTooltip="حل"
                            (click)="resolveAlert(alert)">
                    </button>
                  }
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="7" class="text-center py-8">
                  <i class="pi pi-check-circle text-4xl text-green-400"></i>
                  <p class="text-gray-400 mt-2">لا توجد تنبيهات</p>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabpanel>

        <!-- Metrics Tab -->
        <p-tabpanel header="المقاييس">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <p-card header="طلبات API" styleClass="shadow-sm">
              <p-chart type="line" [data]="apiChartData" [options]="chartOptions"></p-chart>
            </p-card>
            <p-card header="استخدام الموارد" styleClass="shadow-sm">
              <p-chart type="bar" [data]="resourceChartData" [options]="chartOptions"></p-chart>
            </p-card>
          </div>
        </p-tabpanel>
      </p-tabs>
    </div>
  `,
})
export class MonitoringComponent implements OnInit, OnDestroy {
  private readonly monitoringService = inject(MonitoringService);
  private readonly messageService = inject(MessageService);
  private refreshInterval: any;

  Math = Math;

  health = signal<SystemHealth | null>(null);
  services = signal<{ name: string; status: string }[]>([]);
  systemsStatus = signal<any[]>([]);
  alerts = signal<Alert[]>([]);

  apiChartData = {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      {
        label: 'طلبات ناجحة',
        data: [1200, 800, 2100, 3500, 2800, 1900],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'طلبات فاشلة',
        data: [20, 15, 45, 30, 25, 18],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  resourceChartData = {
    labels: ['CPU', 'الذاكرة', 'القرص', 'الشبكة'],
    datasets: [
      {
        label: 'الاستخدام %',
        data: [45, 62, 38, 55],
        backgroundColor: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef'],
      }
    ]
  };

  chartOptions = {
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
    // Auto refresh every 30 seconds
    this.refreshInterval = setInterval(() => this.loadData(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadData(): void {
    // Load health
    this.monitoringService.getHealth().subscribe({
      next: (health) => {
        this.health.set(health);
        if (health.services) {
          this.services.set(
            Object.entries(health.services).map(([name, data]) => ({
              name: this.getServiceName(name),
              status: (data as any).status
            }))
          );
        }
      }
    });

    // Load alerts
    this.monitoringService.getAlerts({ limit: 50 }).subscribe({
      next: (response) => {
        this.alerts.set(response.data);
      }
    });

    // Set mock systems status
    this.systemsStatus.set([
      { systemId: 'core', name: 'النظام الأم', status: 'healthy', responseTime: 45, lastCheck: new Date() },
      { systemId: 'assets', name: 'نظام الأصول', status: 'healthy', responseTime: 62, lastCheck: new Date() },
      { systemId: 'billing', name: 'نظام الفوترة', status: 'degraded', responseTime: 250, lastCheck: new Date() },
      { systemId: 'inventory', name: 'نظام المخزون', status: 'unhealthy', responseTime: null, lastCheck: new Date() },
      { systemId: 'hr', name: 'نظام الموارد البشرية', status: 'healthy', responseTime: 78, lastCheck: new Date() },
      { systemId: 'reports', name: 'نظام التقارير', status: 'healthy', responseTime: 95, lastCheck: new Date() },
    ]);
  }

  acknowledgeAlert(alert: Alert): void {
    this.monitoringService.acknowledgeAlert(alert.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم تأكيد التنبيه' });
        this.loadData();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  resolveAlert(alert: Alert): void {
    this.monitoringService.resolveAlert(alert.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم حل التنبيه' });
        this.loadData();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  getServiceName(key: string): string {
    const names: Record<string, string> = {
      'database': 'قاعدة البيانات',
      'api': 'واجهة API',
      'cache': 'الذاكرة المؤقتة',
      'queue': 'قائمة الانتظار',
    };
    return names[key] || key;
  }

  getHealthColor(status?: string): string {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'degraded': return '#f59e0b';
      case 'unhealthy': return '#ef4444';
      default: return '#9ca3af';
    }
  }

  getHealthLabel(status?: string): string {
    switch (status) {
      case 'healthy': return 'سليم';
      case 'degraded': return 'متدهور';
      case 'unhealthy': return 'معطل';
      default: return 'غير معروف';
    }
  }

  getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warn';
      case 'unhealthy': return 'danger';
      default: return 'info';
    }
  }

  getSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      'critical': 'حرج',
      'high': 'عالي',
      'medium': 'متوسط',
      'low': 'منخفض',
    };
    return labels[severity] || severity;
  }

  getSeveritySeverity(severity: string): 'danger' | 'warn' | 'info' | 'secondary' {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'danger';
      case 'medium': return 'warn';
      case 'low': return 'info';
      default: return 'secondary';
    }
  }

  getAlertStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'active': 'نشط',
      'acknowledged': 'تم التأكيد',
      'resolved': 'تم الحل',
    };
    return labels[status] || status;
  }

  getAlertStatusSeverity(status: string): 'danger' | 'warn' | 'success' {
    switch (status) {
      case 'active': return 'danger';
      case 'acknowledged': return 'warn';
      case 'resolved': return 'success';
      default: return 'warn';
    }
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days} يوم ${hours} ساعة`;
    if (hours > 0) return `${hours} ساعة ${minutes} دقيقة`;
    return `${minutes} دقيقة`;
  }
}
