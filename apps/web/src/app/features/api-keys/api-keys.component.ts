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
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ClipboardModule, Clipboard } from '@angular/cdk/clipboard';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ApiService } from '../../core/services/api.service';
import { ApiKey, PaginatedResponse } from '../../core/models';

@Component({
  selector: 'app-api-keys',
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
    MultiSelectModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    ClipboardModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast position="top-left"></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">مفاتيح API</h1>
          <p class="text-gray-500 mt-1">إدارة مفاتيح الوصول للأنظمة المختلفة</p>
        </div>
        <button pButton pRipple 
                label="إنشاء مفتاح جديد" 
                icon="pi pi-plus"
                (click)="openDialog()">
        </button>
      </div>

      <!-- Warning Card -->
      <p-card styleClass="shadow-sm bg-yellow-50 border-yellow-200">
        <div class="flex items-center gap-3">
          <i class="pi pi-exclamation-triangle text-2xl text-yellow-600"></i>
          <div>
            <p class="font-medium text-yellow-800">تنبيه أمني</p>
            <p class="text-sm text-yellow-700">
              مفاتيح API حساسة للغاية. لا تشاركها مع أي شخص ولا تخزنها في الكود المصدري.
            </p>
          </div>
        </div>
      </p-card>

      <!-- Table -->
      <p-card styleClass="shadow-sm">
        <p-table [value]="apiKeys()" 
                 [loading]="loading()"
                 [paginator]="true" 
                 [rows]="10"
                 [showCurrentPageReport]="true"
                 currentPageReportTemplate="عرض {first} إلى {last} من {totalRecords}"
                 styleClass="p-datatable-striped">
          <ng-template pTemplate="header">
            <tr>
              <th>الاسم</th>
              <th>النظام</th>
              <th>الصلاحيات</th>
              <th>الحالة</th>
              <th>آخر استخدام</th>
              <th>تاريخ الانتهاء</th>
              <th>الإجراءات</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-key>
            <tr>
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <i class="pi pi-key text-purple-600"></i>
                  </div>
                  <div>
                    <p class="font-medium">{{ key.name }}</p>
                    <p class="text-xs text-gray-400 font-mono">{{ maskKey(key.key) }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span class="text-sm">{{ key.systemId }}</span>
              </td>
              <td>
                <div class="flex flex-wrap gap-1">
                  @for (perm of key.permissions?.slice(0, 3); track perm) {
                    <p-tag [value]="perm" severity="info" styleClass="text-xs"></p-tag>
                  }
                  @if (key.permissions?.length > 3) {
                    <p-tag [value]="'+' + (key.permissions.length - 3)" severity="secondary" styleClass="text-xs"></p-tag>
                  }
                </div>
              </td>
              <td>
                <p-tag [value]="key.isActive ? 'نشط' : 'معطل'" 
                       [severity]="key.isActive ? 'success' : 'danger'">
                </p-tag>
              </td>
              <td>
                <span class="text-sm text-gray-500">
                  {{ key.lastUsedAt ? (key.lastUsedAt | date:'short') : 'لم يستخدم' }}
                </span>
              </td>
              <td>
                <span class="text-sm" 
                      [class.text-red-500]="isExpired(key.expiresAt)"
                      [class.text-yellow-500]="isExpiringSoon(key.expiresAt)"
                      [class.text-gray-500]="!isExpired(key.expiresAt) && !isExpiringSoon(key.expiresAt)">
                  {{ key.expiresAt ? (key.expiresAt | date:'shortDate') : 'لا ينتهي' }}
                </span>
              </td>
              <td>
                <div class="flex gap-2">
                  <button pButton pRipple 
                          icon="pi pi-copy" 
                          class="p-button-rounded p-button-text p-button-sm"
                          pTooltip="نسخ المفتاح"
                          (click)="copyKey(key)">
                  </button>
                  <button pButton pRipple 
                          [icon]="key.isActive ? 'pi pi-ban' : 'pi pi-check'" 
                          class="p-button-rounded p-button-text p-button-sm"
                          [pTooltip]="key.isActive ? 'تعطيل' : 'تفعيل'"
                          (click)="toggleStatus(key)">
                  </button>
                  <button pButton pRipple 
                          icon="pi pi-trash" 
                          class="p-button-rounded p-button-text p-button-danger p-button-sm"
                          pTooltip="حذف"
                          (click)="confirmDelete(key)">
                  </button>
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="7" class="text-center py-8">
                <i class="pi pi-key text-4xl text-gray-300"></i>
                <p class="text-gray-400 mt-2">لا توجد مفاتيح API</p>
                <button pButton pRipple 
                        label="إنشاء أول مفتاح" 
                        class="p-button-text mt-2"
                        (click)="openDialog()">
                </button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>

    <!-- Create Dialog -->
    <p-dialog [(visible)]="dialogVisible" 
              header="إنشاء مفتاح API جديد"
              [modal]="true"
              [style]="{ width: '500px' }"
              [draggable]="false"
              [resizable]="false">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">اسم المفتاح *</label>
          <input pInputText [(ngModel)]="formData.name" class="w-full" placeholder="مفتاح النظام الأم" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">معرف النظام *</label>
          <input pInputText [(ngModel)]="formData.systemId" class="w-full" placeholder="core" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">الصلاحيات *</label>
          <p-multiSelect [options]="permissionOptions"
                         [(ngModel)]="formData.permissions"
                         optionLabel="label"
                         optionValue="value"
                         placeholder="اختر الصلاحيات"
                         styleClass="w-full">
          </p-multiSelect>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
          <p-datepicker [(ngModel)]="formData.expiresAt" 
                      [showIcon]="true"
                      [minDate]="minDate"
                      dateFormat="yy-mm-dd"
                      styleClass="w-full">
          </p-datepicker>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton pRipple 
                label="إلغاء" 
                class="p-button-text"
                (click)="dialogVisible = false">
        </button>
        <button pButton pRipple 
                label="إنشاء"
                [loading]="saving()"
                (click)="createApiKey()">
        </button>
      </ng-template>
    </p-dialog>

    <!-- Show Key Dialog -->
    <p-dialog [(visible)]="showKeyDialog" 
              header="مفتاح API الجديد"
              [modal]="true"
              [style]="{ width: '500px' }"
              [closable]="false"
              [draggable]="false">
      <div class="space-y-4">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex items-center gap-2 text-yellow-800 mb-2">
            <i class="pi pi-exclamation-triangle"></i>
            <span class="font-medium">هام جداً</span>
          </div>
          <p class="text-sm text-yellow-700">
            هذه هي المرة الوحيدة التي سترى فيها المفتاح. انسخه واحفظه في مكان آمن.
          </p>
        </div>
        <div class="bg-gray-100 rounded-lg p-4">
          <p class="text-xs text-gray-500 mb-1">المفتاح:</p>
          <p class="font-mono text-sm break-all">{{ newKey() }}</p>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton pRipple 
                label="نسخ المفتاح" 
                icon="pi pi-copy"
                (click)="copyNewKey()">
        </button>
        <button pButton pRipple 
                label="تم" 
                class="p-button-outlined"
                (click)="showKeyDialog = false">
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class ApiKeysComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly clipboard = inject(Clipboard);

  loading = signal(true);
  saving = signal(false);
  apiKeys = signal<ApiKey[]>([]);
  dialogVisible = false;
  showKeyDialog = false;
  newKey = signal('');

  minDate = new Date();

  formData = {
    name: '',
    systemId: '',
    permissions: [] as string[],
    expiresAt: null as Date | null,
  };

  permissionOptions = [
    { label: 'قراءة', value: 'read' },
    { label: 'كتابة', value: 'write' },
    { label: 'حذف', value: 'delete' },
    { label: 'إدارة', value: 'admin' },
    { label: 'تكاملات', value: 'integrations' },
    { label: 'أحداث', value: 'events' },
    { label: 'مراقبة', value: 'monitoring' },
  ];

  ngOnInit(): void {
    this.loadApiKeys();
  }

  loadApiKeys(): void {
    this.loading.set(true);
    this.apiService.get<PaginatedResponse<ApiKey>>('/api-keys').subscribe({
      next: (response) => {
        this.apiKeys.set(response.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
        this.loading.set(false);
      }
    });
  }

  openDialog(): void {
    this.formData = {
      name: '',
      systemId: '',
      permissions: [],
      expiresAt: null,
    };
    this.dialogVisible = true;
  }

  createApiKey(): void {
    if (!this.formData.name || !this.formData.systemId || this.formData.permissions.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى ملء الحقول المطلوبة' });
      return;
    }

    this.saving.set(true);
    this.apiService.post<ApiKey & { key: string }>('/api-keys', {
      ...this.formData,
      expiresAt: this.formData.expiresAt?.toISOString(),
    }).subscribe({
      next: (response) => {
        this.newKey.set(response.key || 'dev_' + Math.random().toString(36).substring(2, 34));
        this.dialogVisible = false;
        this.showKeyDialog = true;
        this.saving.set(false);
        this.loadApiKeys();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
        this.saving.set(false);
      }
    });
  }

  toggleStatus(key: ApiKey): void {
    this.apiService.patch(`/api-keys/${key.id}`, { isActive: !key.isActive }).subscribe({
      next: () => {
        this.messageService.add({ 
          severity: 'success', 
          summary: 'نجاح', 
          detail: key.isActive ? 'تم تعطيل المفتاح' : 'تم تفعيل المفتاح' 
        });
        this.loadApiKeys();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  confirmDelete(key: ApiKey): void {
    this.confirmationService.confirm({
      message: `هل أنت متأكد من حذف "${key.name}"؟`,
      header: 'تأكيد الحذف',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'نعم، احذف',
      rejectLabel: 'إلغاء',
      accept: () => {
        this.apiService.delete(`/api-keys/${key.id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم حذف المفتاح' });
            this.loadApiKeys();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
          }
        });
      }
    });
  }

  copyKey(key: ApiKey): void {
    if (key.key) {
      this.clipboard.copy(key.key);
      this.messageService.add({ severity: 'success', summary: 'تم النسخ', detail: 'تم نسخ المفتاح' });
    }
  }

  copyNewKey(): void {
    this.clipboard.copy(this.newKey());
    this.messageService.add({ severity: 'success', summary: 'تم النسخ', detail: 'تم نسخ المفتاح' });
  }

  maskKey(key?: string): string {
    if (!key) return '••••••••••••••••';
    return key.substring(0, 8) + '••••••••' + key.substring(key.length - 4);
  }

  isExpired(date?: Date): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  isExpiringSoon(date?: Date): boolean {
    if (!date) return false;
    const expiry = new Date(date);
    const now = new Date();
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  }
}
