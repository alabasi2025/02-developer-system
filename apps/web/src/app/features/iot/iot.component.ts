import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

import { ApiService } from '../../core/services/api.service';
import { IotDevice, IotData, PaginatedResponse } from '../../core/models';

@Component({
  selector: 'app-iot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    ChartModule,
    TabsModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-left"></p-toast>

    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">أجهزة IoT</h1>
          <p class="text-gray-500 mt-1">إدارة العدادات الذكية وأجهزة إنترنت الأشياء</p>
        </div>
        <button pButton pRipple 
                label="تسجيل جهاز" 
                icon="pi pi-plus"
                (click)="openDeviceDialog()">
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <i class="pi pi-microchip text-xl text-blue-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-blue-600">{{ totalDevices() }}</p>
              <p class="text-sm text-gray-500">إجمالي الأجهزة</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <i class="pi pi-wifi text-xl text-green-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-green-600">{{ onlineDevices() }}</p>
              <p class="text-sm text-gray-500">متصل</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <i class="pi pi-times-circle text-xl text-red-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-red-600">{{ offlineDevices() }}</p>
              <p class="text-sm text-gray-500">غير متصل</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <i class="pi pi-chart-line text-xl text-purple-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-purple-600">{{ todayReadings() | number }}</p>
              <p class="text-sm text-gray-500">قراءات اليوم</p>
            </div>
          </div>
        </p-card>
      </div>

      <!-- Tabs -->
      <p-tabs>
        <!-- Devices Tab -->
        <p-tabpanel header="الأجهزة">
          <p-table [value]="devices()" 
                   [loading]="loading()"
                   [paginator]="true" 
                   [rows]="10"
                   styleClass="p-datatable-striped mt-4">
            <ng-template pTemplate="header">
              <tr>
                <th>الجهاز</th>
                <th>النوع</th>
                <th>الشركة المصنعة</th>
                <th>الحالة</th>
                <th>آخر اتصال</th>
                <th>الإجراءات</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-device>
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                         [class.bg-green-100]="device.isOnline"
                         [class.bg-gray-100]="!device.isOnline">
                      <i class="pi pi-microchip"
                         [class.text-green-600]="device.isOnline"
                         [class.text-gray-400]="!device.isOnline">
                      </i>
                    </div>
                    <div>
                      <p class="font-medium">{{ device.nameAr || device.name }}</p>
                      <p class="text-xs text-gray-400 font-mono">{{ device.deviceId }}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p-tag [value]="getDeviceTypeLabel(device.deviceType)" severity="info"></p-tag>
                </td>
                <td class="text-sm text-gray-600">{{ device.manufacturer || '-' }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full"
                          [class.bg-green-500]="device.isOnline"
                          [class.bg-red-500]="!device.isOnline">
                    </span>
                    <span class="text-sm">{{ device.isOnline ? 'متصل' : 'غير متصل' }}</span>
                  </div>
                </td>
                <td class="text-sm text-gray-500">
                  {{ device.lastSeenAt ? (device.lastSeenAt | date:'short') : 'لم يتصل' }}
                </td>
                <td>
                  <div class="flex gap-2">
                    <button pButton pRipple 
                            icon="pi pi-chart-line" 
                            class="p-button-rounded p-button-text p-button-sm"
                            pTooltip="عرض البيانات"
                            (click)="viewDeviceData(device)">
                    </button>
                    <button pButton pRipple 
                            icon="pi pi-send" 
                            class="p-button-rounded p-button-text p-button-sm"
                            pTooltip="إرسال أمر"
                            (click)="openCommandDialog(device)">
                    </button>
                    <button pButton pRipple 
                            icon="pi pi-trash" 
                            class="p-button-rounded p-button-text p-button-danger p-button-sm"
                            pTooltip="حذف"
                            (click)="deleteDevice(device)">
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="text-center py-8">
                  <i class="pi pi-microchip text-4xl text-gray-300"></i>
                  <p class="text-gray-400 mt-2">لا توجد أجهزة مسجلة</p>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabpanel>

        <!-- Data Tab -->
        <p-tabpanel header="البيانات">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <p-card header="قراءات الاستهلاك" styleClass="shadow-sm">
              <p-chart type="line" [data]="consumptionChartData" [options]="chartOptions"></p-chart>
            </p-card>
            <p-card header="توزيع الأجهزة" styleClass="shadow-sm">
              <p-chart type="doughnut" [data]="deviceDistributionData" [options]="pieOptions"></p-chart>
            </p-card>
          </div>
        </p-tabpanel>

        <!-- Commands Tab -->
        <p-tabpanel header="الأوامر">
          <p-table [value]="commands()" 
                   [paginator]="true" 
                   [rows]="10"
                   styleClass="p-datatable-striped mt-4">
            <ng-template pTemplate="header">
              <tr>
                <th>الجهاز</th>
                <th>نوع الأمر</th>
                <th>البيانات</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-cmd>
              <tr>
                <td class="font-mono text-sm">{{ cmd.deviceId }}</td>
                <td>
                  <p-tag [value]="cmd.commandType" severity="info"></p-tag>
                </td>
                <td class="text-sm text-gray-600">{{ cmd.payload | json }}</td>
                <td>
                  <p-tag [value]="getCommandStatusLabel(cmd.status)"
                         [severity]="getCommandStatusSeverity(cmd.status)">
                  </p-tag>
                </td>
                <td class="text-sm text-gray-500">{{ cmd.createdAt | date:'short' }}</td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabpanel>
      </p-tabs>
    </div>

    <!-- Register Device Dialog -->
    <p-dialog [(visible)]="deviceDialogVisible" 
              header="تسجيل جهاز جديد"
              [modal]="true"
              [style]="{ width: '500px' }">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">معرف الجهاز *</label>
          <input pInputText [(ngModel)]="deviceForm.deviceId" class="w-full" placeholder="METER-001" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الاسم *</label>
          <input pInputText [(ngModel)]="deviceForm.name" class="w-full" placeholder="Smart Meter 001" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الاسم بالعربي</label>
          <input pInputText [(ngModel)]="deviceForm.nameAr" class="w-full" placeholder="عداد ذكي 001" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">النوع *</label>
          <p-select [options]="deviceTypeOptions"
                      [(ngModel)]="deviceForm.deviceType"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="اختر النوع"
                      styleClass="w-full">
          </p-select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الشركة المصنعة</label>
          <input pInputText [(ngModel)]="deviceForm.manufacturer" class="w-full" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton pRipple label="إلغاء" class="p-button-text" (click)="deviceDialogVisible = false"></button>
        <button pButton pRipple label="تسجيل" (click)="registerDevice()"></button>
      </ng-template>
    </p-dialog>

    <!-- Send Command Dialog -->
    <p-dialog [(visible)]="commandDialogVisible" 
              header="إرسال أمر"
              [modal]="true"
              [style]="{ width: '500px' }">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الجهاز</label>
          <input pInputText [value]="selectedDevice()?.name" class="w-full" disabled />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">نوع الأمر *</label>
          <p-select [options]="commandTypeOptions"
                      [(ngModel)]="commandForm.commandType"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="اختر نوع الأمر"
                      styleClass="w-full">
          </p-select>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton pRipple label="إلغاء" class="p-button-text" (click)="commandDialogVisible = false"></button>
        <button pButton pRipple label="إرسال" (click)="sendCommand()"></button>
      </ng-template>
    </p-dialog>
  `,
})
export class IotComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly messageService = inject(MessageService);

  loading = signal(true);
  devices = signal<IotDevice[]>([]);
  commands = signal<any[]>([]);
  selectedDevice = signal<IotDevice | null>(null);

  totalDevices = signal(0);
  onlineDevices = signal(0);
  offlineDevices = signal(0);
  todayReadings = signal(1250);

  deviceDialogVisible = false;
  commandDialogVisible = false;

  deviceForm = {
    deviceId: '',
    name: '',
    nameAr: '',
    deviceType: '',
    manufacturer: '',
  };

  commandForm = {
    commandType: '',
  };

  deviceTypeOptions = [
    { label: 'عداد كهرباء', value: 'electricity_meter' },
    { label: 'عداد مياه', value: 'water_meter' },
    { label: 'عداد غاز', value: 'gas_meter' },
    { label: 'مستشعر', value: 'sensor' },
    { label: 'محول', value: 'transformer' },
  ];

  commandTypeOptions = [
    { label: 'قراءة فورية', value: 'read_now' },
    { label: 'إعادة تشغيل', value: 'restart' },
    { label: 'تحديث البرنامج', value: 'firmware_update' },
    { label: 'فصل', value: 'disconnect' },
    { label: 'توصيل', value: 'connect' },
  ];

  consumptionChartData = {
    labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
    datasets: [
      {
        label: 'الاستهلاك (kWh)',
        data: [4500, 4200, 5100, 4800, 5500, 5200],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  deviceDistributionData = {
    labels: ['عدادات كهرباء', 'عدادات مياه', 'مستشعرات', 'أخرى'],
    datasets: [
      {
        data: [45, 25, 20, 10],
        backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#9ca3af'],
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
    this.loading.set(true);

    this.apiService.get<PaginatedResponse<IotDevice>>('/iot/devices').subscribe({
      next: (response) => {
        this.devices.set(response.data);
        this.totalDevices.set(response.meta.total);
        this.onlineDevices.set(response.data.filter(d => d.isOnline).length);
        this.offlineDevices.set(response.data.filter(d => !d.isOnline).length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  openDeviceDialog(): void {
    this.deviceForm = { deviceId: '', name: '', nameAr: '', deviceType: '', manufacturer: '' };
    this.deviceDialogVisible = true;
  }

  registerDevice(): void {
    if (!this.deviceForm.deviceId || !this.deviceForm.name || !this.deviceForm.deviceType) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى ملء الحقول المطلوبة' });
      return;
    }

    this.apiService.post('/iot/devices', this.deviceForm).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم تسجيل الجهاز' });
        this.deviceDialogVisible = false;
        this.loadData();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  viewDeviceData(device: IotDevice): void {
    // Navigate to device details or show data dialog
    this.messageService.add({ severity: 'info', summary: 'معلومات', detail: `عرض بيانات ${device.name}` });
  }

  openCommandDialog(device: IotDevice): void {
    this.selectedDevice.set(device);
    this.commandForm = { commandType: '' };
    this.commandDialogVisible = true;
  }

  sendCommand(): void {
    if (!this.commandForm.commandType) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى اختيار نوع الأمر' });
      return;
    }

    const device = this.selectedDevice();
    if (!device) return;

    this.apiService.post('/iot/commands', {
      deviceId: device.id,
      commandType: this.commandForm.commandType,
      payload: {},
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم إرسال الأمر' });
        this.commandDialogVisible = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  deleteDevice(device: IotDevice): void {
    this.apiService.delete(`/iot/devices/${device.id}`).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم حذف الجهاز' });
        this.loadData();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  getDeviceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'electricity_meter': 'عداد كهرباء',
      'water_meter': 'عداد مياه',
      'gas_meter': 'عداد غاز',
      'sensor': 'مستشعر',
      'transformer': 'محول',
    };
    return labels[type] || type;
  }

  getCommandStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'قيد الانتظار',
      'sent': 'تم الإرسال',
      'acknowledged': 'تم الاستلام',
      'executed': 'تم التنفيذ',
      'failed': 'فشل',
    };
    return labels[status] || status;
  }

  getCommandStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
    switch (status) {
      case 'executed': return 'success';
      case 'acknowledged': return 'info';
      case 'pending':
      case 'sent': return 'warn';
      case 'failed': return 'danger';
      default: return 'info';
    }
  }
}
