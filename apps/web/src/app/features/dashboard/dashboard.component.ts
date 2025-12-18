import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';

import { MonitoringService } from '../../core/services/monitoring.service';
import { IntegrationsService } from '../../core/services/integrations.service';
import { SystemHealth, Integration, Alert } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardModule,
    ButtonModule,
    ChartModule,
    TableModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    ProgressBarModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
          <p class="text-gray-500 mt-1">نظرة عامة على حالة النظام والتكاملات</p>
        </div>
        <button pButton pRipple 
                label="تحديث" 
                icon="pi pi-refresh"
                class="p-button-outlined"
                (click)="loadData()">
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        @if (loading()) {
          @for (i of [1,2,3,4]; track i) {
            <p-card styleClass="shadow-sm">
              <p-skeleton height="80px"></p-skeleton>
            </p-card>
          }
        } @else {
          <!-- System Health -->
          <p-card styleClass="shadow-sm border-r-4"
                  [style]="{'border-right-color': getHealthColor(health()?.status)}">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">حالة النظام</p>
                <p class="text-2xl font-bold mt-1" [style.color]="getHealthColor(health()?.status)">
                  {{ getHealthLabel(health()?.status) }}
                </p>
              </div>
              <div class="w-12 h-12 rounded-full flex items-center justify-center"
                   [style.background-color]="getHealthColor(health()?.status) + '20'">
                <i class="pi pi-heart-fill text-xl" [style.color]="getHealthColor(health()?.status)"></i>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">
              وقت التشغيل: {{ formatUptime(health()?.uptime || 0) }}
            </p>
          </p-card>

          <!-- Active Integrations -->
          <p-card styleClass="shadow-sm border-r-4 border-blue-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">التكاملات النشطة</p>
                <p class="text-2xl font-bold text-blue-600 mt-1">{{ activeIntegrations() }}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <i class="pi pi-link text-xl text-blue-600"></i>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">
              من أصل {{ totalIntegrations() }} تكامل
            </p>
          </p-card>

          <!-- API Requests Today -->
          <p-card styleClass="shadow-sm border-r-4 border-purple-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">طلبات API اليوم</p>
                <p class="text-2xl font-bold text-purple-600 mt-1">{{ apiRequests() | number }}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <i class="pi pi-server text-xl text-purple-600"></i>
              </div>
            </div>
            <p class="text-xs text-green-500 mt-2">
              <i class="pi pi-arrow-up"></i> 12% عن الأمس
            </p>
          </p-card>

          <!-- Active Alerts -->
          <p-card styleClass="shadow-sm border-r-4 border-orange-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">التنبيهات النشطة</p>
                <p class="text-2xl font-bold text-orange-600 mt-1">{{ activeAlerts() }}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <i class="pi pi-exclamation-triangle text-xl text-orange-600"></i>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">
              {{ criticalAlerts() }} حرجة
            </p>
          </p-card>
        }
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- API Traffic Chart -->
        <p-card header="حركة API" styleClass="shadow-sm">
          <p-chart type="line" [data]="trafficChartData" [options]="chartOptions"></p-chart>
        </p-card>

        <!-- Systems Status -->
        <p-card header="حالة الأنظمة" styleClass="shadow-sm">
          <div class="space-y-4">
            @for (system of systemsStatus(); track system.systemId) {
              <div class="flex items-center gap-4">
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium text-gray-700">{{ system.name }}</span>
                    <p-tag [value]="getStatusLabel(system.status)" 
                           [severity]="getStatusSeverity(system.status)">
                    </p-tag>
                  </div>
                  <p-progressBar [value]="system.responseTime ? Math.min(100, (500 - system.responseTime) / 5) : 0"
                                 [showValue]="false"
                                 styleClass="h-2">
                  </p-progressBar>
                  <p class="text-xs text-gray-400 mt-1">
                    وقت الاستجابة: {{ system.responseTime || 'N/A' }}ms
                  </p>
                </div>
              </div>
            }
          </div>
        </p-card>
      </div>

      <!-- Recent Events & Integrations -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Integrations -->
        <p-card header="التكاملات" styleClass="shadow-sm">
          <ng-template pTemplate="header">
            <div class="flex items-center justify-between p-4 border-b">
              <span class="font-semibold">التكاملات</span>
              <a routerLink="/integrations" class="text-primary-600 text-sm hover:underline">
                عرض الكل <i class="pi pi-arrow-left text-xs"></i>
              </a>
            </div>
          </ng-template>
          <p-table [value]="integrations()" [rows]="5" styleClass="p-datatable-sm">
            <ng-template pTemplate="body" let-integration>
              <tr>
                <td class="py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <i [class]="getIntegrationIcon(integration.type) + ' text-gray-600'"></i>
                    </div>
                    <div>
                      <p class="font-medium text-gray-800">{{ integration.nameAr || integration.name }}</p>
                      <p class="text-xs text-gray-400">{{ integration.type }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-left">
                  <p-tag [value]="getStatusLabel(integration.status)"
                         [severity]="getStatusSeverity(integration.status)">
                  </p-tag>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="2" class="text-center py-8 text-gray-400">
                  لا توجد تكاملات
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

        <!-- Recent Alerts -->
        <p-card styleClass="shadow-sm">
          <ng-template pTemplate="header">
            <div class="flex items-center justify-between p-4 border-b">
              <span class="font-semibold">التنبيهات الأخيرة</span>
              <a routerLink="/monitoring" class="text-primary-600 text-sm hover:underline">
                عرض الكل <i class="pi pi-arrow-left text-xs"></i>
              </a>
            </div>
          </ng-template>
          <div class="space-y-3 p-2">
            @for (alert of recentAlerts(); track alert.id) {
              <div class="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <div class="w-8 h-8 rounded-full flex items-center justify-center"
                     [class.bg-red-100]="alert.severity === 'critical'"
                     [class.bg-orange-100]="alert.severity === 'high'"
                     [class.bg-yellow-100]="alert.severity === 'medium'"
                     [class.bg-blue-100]="alert.severity === 'low'">
                  <i class="pi pi-exclamation-circle"
                     [class.text-red-600]="alert.severity === 'critical'"
                     [class.text-orange-600]="alert.severity === 'high'"
                     [class.text-yellow-600]="alert.severity === 'medium'"
                     [class.text-blue-600]="alert.severity === 'low'">
                  </i>
                </div>
                <div class="flex-1">
                  <p class="font-medium text-gray-800 text-sm">{{ alert.title }}</p>
                  <p class="text-xs text-gray-500 mt-1">{{ alert.message }}</p>
                  <p class="text-xs text-gray-400 mt-2">{{ alert.createdAt | date:'short' }}</p>
                </div>
              </div>
            } @empty {
              <div class="text-center py-8 text-gray-400">
                <i class="pi pi-check-circle text-4xl text-green-400"></i>
                <p class="mt-2">لا توجد تنبيهات</p>
              </div>
            }
          </div>
        </p-card>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly monitoringService = inject(MonitoringService);
  private readonly integrationsService = inject(IntegrationsService);

  loading = signal(true);
  health = signal<SystemHealth | null>(null);
  integrations = signal<Integration[]>([]);
  recentAlerts = signal<Alert[]>([]);
  systemsStatus = signal<any[]>([]);
  
  activeIntegrations = signal(0);
  totalIntegrations = signal(0);
  apiRequests = signal(15420);
  activeAlerts = signal(0);
  criticalAlerts = signal(0);

  Math = Math;

  trafficChartData = {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      {
        label: 'طلبات API',
        data: [1200, 800, 2100, 3500, 2800, 1900],
        fill: true,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
      }
    ]
  };

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f3f4f6'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    // Load health
    this.monitoringService.getHealth().subscribe({
      next: (health) => {
        this.health.set(health);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });

    // Load integrations
    this.integrationsService.getAll({ limit: 5 }).subscribe({
      next: (response) => {
        this.integrations.set(response.data);
        this.totalIntegrations.set(response.meta.total);
        this.activeIntegrations.set(response.data.filter(i => i.status === 'active').length);
      }
    });

    // Load alerts
    this.monitoringService.getAlerts({ status: 'active', limit: 5 }).subscribe({
      next: (response) => {
        this.recentAlerts.set(response.data);
        this.activeAlerts.set(response.meta.total);
        this.criticalAlerts.set(response.data.filter(a => a.severity === 'critical').length);
      }
    });

    // Fetch systems status from API
    this.monitoringService.getSystemsStatus().subscribe({
      next: (systems) => {
        this.systemsStatus.set(systems);
      },
      error: () => {
        // Set empty array on error
        this.systemsStatus.set([]);
      }
    });
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

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'active': 'نشط',
      'inactive': 'غير نشط',
      'error': 'خطأ',
      'maintenance': 'صيانة',
      'healthy': 'سليم',
      'degraded': 'متدهور',
      'unhealthy': 'معطل',
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active':
      case 'healthy':
        return 'success';
      case 'inactive':
        return 'secondary';
      case 'degraded':
      case 'maintenance':
        return 'warn';
      case 'error':
      case 'unhealthy':
        return 'danger';
      default:
        return 'info';
    }
  }

  getIntegrationIcon(type: string): string {
    const icons: Record<string, string> = {
      'internal': 'pi pi-server',
      'external': 'pi pi-globe',
      'iot': 'pi pi-microchip',
      'payment': 'pi pi-credit-card',
      'sms': 'pi pi-mobile',
      'email': 'pi pi-envelope',
    };
    return icons[type] || 'pi pi-link';
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
