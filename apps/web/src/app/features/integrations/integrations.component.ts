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
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

import { IntegrationsService, CreateIntegrationDto } from '../../core/services/integrations.service';
import { Integration } from '../../core/models';

@Component({
  selector: 'app-integrations',
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
    TextareaModule,
    ToastModule,
    ConfirmDialogModule,
    SkeletonModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast position="top-left"></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">إدارة التكاملات</h1>
          <p class="text-gray-500 mt-1">إدارة التكاملات الداخلية والخارجية للنظام</p>
        </div>
        <button pButton pRipple 
                label="إضافة تكامل" 
                icon="pi pi-plus"
                (click)="openDialog()">
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">{{ totalCount() }}</p>
            <p class="text-sm text-gray-500 mt-1">إجمالي التكاملات</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">{{ activeCount() }}</p>
            <p class="text-sm text-gray-500 mt-1">نشط</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-yellow-600">{{ maintenanceCount() }}</p>
            <p class="text-sm text-gray-500 mt-1">صيانة</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-red-600">{{ errorCount() }}</p>
            <p class="text-sm text-gray-500 mt-1">خطأ</p>
          </div>
        </p-card>
      </div>

      <!-- Table -->
      <p-card styleClass="shadow-sm">
        <p-table [value]="integrations()" 
                 [loading]="loading()"
                 [paginator]="true" 
                 [rows]="10"
                 [showCurrentPageReport]="true"
                 currentPageReportTemplate="عرض {first} إلى {last} من {totalRecords}"
                 styleClass="p-datatable-striped">
          <ng-template pTemplate="header">
            <tr>
              <th>التكامل</th>
              <th>النوع</th>
              <th>الرابط</th>
              <th>الحالة</th>
              <th>آخر فحص</th>
              <th>الإجراءات</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-integration>
            <tr>
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <i [class]="getTypeIcon(integration.type) + ' text-gray-600'"></i>
                  </div>
                  <div>
                    <p class="font-medium">{{ integration.nameAr || integration.name }}</p>
                    <p class="text-xs text-gray-400">{{ integration.name }}</p>
                  </div>
                </div>
              </td>
              <td>
                <p-tag [value]="getTypeLabel(integration.type)" severity="info"></p-tag>
              </td>
              <td>
                <span class="text-sm text-gray-600 font-mono">{{ integration.baseUrl || '-' }}</span>
              </td>
              <td>
                <p-tag [value]="getStatusLabel(integration.status)" 
                       [severity]="getStatusSeverity(integration.status)">
                </p-tag>
              </td>
              <td>
                <span class="text-sm text-gray-500">
                  {{ integration.lastHealthCheck ? (integration.lastHealthCheck | date:'short') : 'لم يتم' }}
                </span>
              </td>
              <td>
                <div class="flex gap-2">
                  <button pButton pRipple 
                          icon="pi pi-refresh" 
                          class="p-button-rounded p-button-text p-button-sm"
                          pTooltip="فحص الاتصال"
                          (click)="testIntegration(integration)">
                  </button>
                  <button pButton pRipple 
                          icon="pi pi-pencil" 
                          class="p-button-rounded p-button-text p-button-sm"
                          pTooltip="تعديل"
                          (click)="editIntegration(integration)">
                  </button>
                  <button pButton pRipple 
                          icon="pi pi-trash" 
                          class="p-button-rounded p-button-text p-button-danger p-button-sm"
                          pTooltip="حذف"
                          (click)="confirmDelete(integration)">
                  </button>
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="6" class="text-center py-8">
                <i class="pi pi-link text-4xl text-gray-300"></i>
                <p class="text-gray-400 mt-2">لا توجد تكاملات</p>
                <button pButton pRipple 
                        label="إضافة أول تكامل" 
                        class="p-button-text mt-2"
                        (click)="openDialog()">
                </button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>

    <!-- Create/Edit Dialog -->
    <p-dialog [(visible)]="dialogVisible" 
              [header]="editMode() ? 'تعديل التكامل' : 'إضافة تكامل جديد'"
              [modal]="true"
              [style]="{ width: '500px' }"
              [draggable]="false"
              [resizable]="false">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الاسم (إنجليزي) *</label>
          <input pInputText [(ngModel)]="formData.name" class="w-full" placeholder="Core System" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الاسم (عربي)</label>
          <input pInputText [(ngModel)]="formData.nameAr" class="w-full" placeholder="النظام الأم" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">النوع *</label>
          <p-select [options]="typeOptions" 
                      [(ngModel)]="formData.type"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="اختر النوع"
                      styleClass="w-full">
          </p-select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">رابط API</label>
          <input pInputText [(ngModel)]="formData.baseUrl" class="w-full" placeholder="http://localhost:3001/api/v1" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">نقطة فحص الصحة</label>
          <input pInputText [(ngModel)]="formData.healthEndpoint" class="w-full" placeholder="/health" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
          <textarea pTextarea [(ngModel)]="formData.description" rows="3" class="w-full"></textarea>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton pRipple 
                label="إلغاء" 
                class="p-button-text"
                (click)="dialogVisible = false">
        </button>
        <button pButton pRipple 
                [label]="editMode() ? 'حفظ التعديلات' : 'إضافة'"
                [loading]="saving()"
                (click)="saveIntegration()">
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class IntegrationsComponent implements OnInit {
  private readonly integrationsService = inject(IntegrationsService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  loading = signal(true);
  saving = signal(false);
  integrations = signal<Integration[]>([]);
  editMode = signal(false);
  dialogVisible = false;

  totalCount = signal(0);
  activeCount = signal(0);
  maintenanceCount = signal(0);
  errorCount = signal(0);

  formData: CreateIntegrationDto = {
    name: '',
    nameAr: '',
    type: 'internal',
    baseUrl: '',
    healthEndpoint: '',
    description: '',
  };

  selectedId: string | null = null;

  typeOptions = [
    { label: 'داخلي', value: 'internal' },
    { label: 'خارجي', value: 'external' },
    { label: 'IoT', value: 'iot' },
    { label: 'دفع', value: 'payment' },
    { label: 'SMS', value: 'sms' },
    { label: 'بريد إلكتروني', value: 'email' },
  ];

  ngOnInit(): void {
    this.loadIntegrations();
  }

  loadIntegrations(): void {
    this.loading.set(true);
    this.integrationsService.getAll({ limit: 100 }).subscribe({
      next: (response) => {
        this.integrations.set(response.data);
        this.totalCount.set(response.meta.total);
        this.activeCount.set(response.data.filter(i => i.status === 'active').length);
        this.maintenanceCount.set(response.data.filter(i => i.status === 'maintenance').length);
        this.errorCount.set(response.data.filter(i => i.status === 'error').length);
        this.loading.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
        this.loading.set(false);
      }
    });
  }

  openDialog(): void {
    this.editMode.set(false);
    this.selectedId = null;
    this.formData = {
      name: '',
      nameAr: '',
      type: 'internal',
      baseUrl: '',
      healthEndpoint: '',
      description: '',
    };
    this.dialogVisible = true;
  }

  editIntegration(integration: Integration): void {
    this.editMode.set(true);
    this.selectedId = integration.id;
    this.formData = {
      name: integration.name,
      nameAr: integration.nameAr,
      type: integration.type as any,
      baseUrl: integration.baseUrl,
      healthEndpoint: integration.healthEndpoint,
      description: integration.description,
    };
    this.dialogVisible = true;
  }

  saveIntegration(): void {
    if (!this.formData.name || !this.formData.type) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى ملء الحقول المطلوبة' });
      return;
    }

    this.saving.set(true);

    const request = this.editMode() && this.selectedId
      ? this.integrationsService.update(this.selectedId, this.formData)
      : this.integrationsService.create(this.formData);

    request.subscribe({
      next: () => {
        this.messageService.add({ 
          severity: 'success', 
          summary: 'نجاح', 
          detail: this.editMode() ? 'تم تحديث التكامل' : 'تم إضافة التكامل' 
        });
        this.dialogVisible = false;
        this.saving.set(false);
        this.loadIntegrations();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
        this.saving.set(false);
      }
    });
  }

  testIntegration(integration: Integration): void {
    this.integrationsService.test(integration.id).subscribe({
      next: (result) => {
        if (result.success) {
          this.messageService.add({ 
            severity: 'success', 
            summary: 'نجاح', 
            detail: `الاتصال ناجح (${result.responseTime}ms)` 
          });
        } else {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'فشل', 
            detail: result.errorMessage || 'فشل الاتصال' 
          });
        }
        this.loadIntegrations();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  confirmDelete(integration: Integration): void {
    this.confirmationService.confirm({
      message: `هل أنت متأكد من حذف "${integration.nameAr || integration.name}"؟`,
      header: 'تأكيد الحذف',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'نعم، احذف',
      rejectLabel: 'إلغاء',
      accept: () => {
        this.integrationsService.delete(integration.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم حذف التكامل' });
            this.loadIntegrations();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
          }
        });
      }
    });
  }

  getTypeIcon(type: string): string {
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

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'internal': 'داخلي',
      'external': 'خارجي',
      'iot': 'IoT',
      'payment': 'دفع',
      'sms': 'SMS',
      'email': 'بريد',
    };
    return labels[type] || type;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'active': 'نشط',
      'inactive': 'غير نشط',
      'error': 'خطأ',
      'maintenance': 'صيانة',
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'secondary';
      case 'maintenance': return 'warn';
      case 'error': return 'danger';
      default: return 'info';
    }
  }
}
