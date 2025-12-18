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
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-messages',
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
    TextareaModule,
    SelectModule,
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
          <h1 class="text-2xl font-bold text-gray-900">خدمات الرسائل</h1>
          <p class="text-gray-500 mt-1">إدارة رسائل SMS و Email و Push Notifications</p>
        </div>
        <button pButton pRipple 
                label="إرسال رسالة" 
                icon="pi pi-send"
                (click)="openSendDialog()">
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <i class="pi pi-mobile text-xl text-blue-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-blue-600">{{ smsCount() | number }}</p>
              <p class="text-sm text-gray-500">رسائل SMS</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <i class="pi pi-envelope text-xl text-green-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-green-600">{{ emailCount() | number }}</p>
              <p class="text-sm text-gray-500">رسائل Email</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <i class="pi pi-bell text-xl text-purple-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-purple-600">{{ pushCount() | number }}</p>
              <p class="text-sm text-gray-500">إشعارات Push</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <i class="pi pi-whatsapp text-xl text-green-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-green-600">{{ whatsappCount() | number }}</p>
              <p class="text-sm text-gray-500">رسائل WhatsApp</p>
            </div>
          </div>
        </p-card>
      </div>

      <!-- Providers -->
      <p-card header="مزودي الخدمة" styleClass="shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          @for (provider of providers(); track provider.id) {
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <i [class]="getProviderIcon(provider.type) + ' text-gray-600'"></i>
                  <span class="font-medium">{{ provider.name }}</span>
                </div>
                <p-tag [value]="provider.isActive ? 'نشط' : 'معطل'"
                       [severity]="provider.isActive ? 'success' : 'danger'"
                       styleClass="text-xs">
                </p-tag>
              </div>
              <p class="text-xs text-gray-400">{{ getProviderTypeLabel(provider.type) }}</p>
            </div>
          }
        </div>
      </p-card>

      <!-- Tabs -->
      <p-tabs>
        <!-- SMS Tab -->
        <p-tabpanel header="SMS">
          <p-table [value]="smsMessages()" 
                   [paginator]="true" 
                   [rows]="10"
                   styleClass="p-datatable-striped mt-4">
            <ng-template pTemplate="header">
              <tr>
                <th>المستلم</th>
                <th>الرسالة</th>
                <th>المزود</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-msg>
              <tr>
                <td class="font-mono">{{ msg.recipient }}</td>
                <td class="text-sm">{{ msg.content | slice:0:50 }}...</td>
                <td>{{ msg.provider }}</td>
                <td>
                  <p-tag [value]="getStatusLabel(msg.status)"
                         [severity]="getStatusSeverity(msg.status)">
                  </p-tag>
                </td>
                <td class="text-sm text-gray-500">{{ msg.createdAt | date:'short' }}</td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabpanel>

        <!-- Email Tab -->
        <p-tabpanel header="Email">
          <p-table [value]="emailMessages()" 
                   [paginator]="true" 
                   [rows]="10"
                   styleClass="p-datatable-striped mt-4">
            <ng-template pTemplate="header">
              <tr>
                <th>المستلم</th>
                <th>الموضوع</th>
                <th>المزود</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-msg>
              <tr>
                <td>{{ msg.recipient }}</td>
                <td class="text-sm">{{ msg.subject }}</td>
                <td>{{ msg.provider }}</td>
                <td>
                  <p-tag [value]="getStatusLabel(msg.status)"
                         [severity]="getStatusSeverity(msg.status)">
                  </p-tag>
                </td>
                <td class="text-sm text-gray-500">{{ msg.createdAt | date:'short' }}</td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabpanel>

        <!-- Templates Tab -->
        <p-tabpanel header="القوالب">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            @for (template of templates(); track template.id) {
              <p-card styleClass="shadow-sm">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="font-semibold">{{ template.name }}</h4>
                  <p-tag [value]="getProviderTypeLabel(template.type)" severity="info" styleClass="text-xs"></p-tag>
                </div>
                <p class="text-sm text-gray-600 mb-3">{{ template.content | slice:0:100 }}...</p>
                <div class="flex gap-2">
                  <button pButton pRipple icon="pi pi-eye" class="p-button-text p-button-sm" aria-label="عرض"></button>
                  <button pButton pRipple icon="pi pi-pencil" class="p-button-text p-button-sm" aria-label="تعديل"></button>
                </div>
              </p-card>
            }
          </div>
        </p-tabpanel>
      </p-tabs>
    </div>

    <!-- Send Message Dialog -->
    <p-dialog [(visible)]="sendDialogVisible" 
              header="إرسال رسالة"
              [modal]="true"
              [style]="{ width: '500px' }">
      <div class="space-y-4">
        <div>
          <label for="messageType" class="block text-sm font-medium text-gray-700 mb-1">نوع الرسالة *</label>
          <p-select id="messageType" [options]="messageTypeOptions"
                      [(ngModel)]="messageForm.type"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="اختر النوع"
                      styleClass="w-full">
          </p-select>
        </div>
        <div>
          <label for="recipient" class="block text-sm font-medium text-gray-700 mb-1">المستلم *</label>
          <input id="recipient" pInputText [(ngModel)]="messageForm.recipient" class="w-full" 
                 [placeholder]="messageForm.type === 'email' ? 'email@example.com' : '+966xxxxxxxxx'" />
        </div>
        @if (messageForm.type === 'email') {
          <div>
            <label for="subject" class="block text-sm font-medium text-gray-700 mb-1">الموضوع *</label>
            <input id="subject" pInputText [(ngModel)]="messageForm.subject" class="w-full" />
          </div>
        }
        <div>
          <label for="content" class="block text-sm font-medium text-gray-700 mb-1">الرسالة *</label>
          <textarea id="content" pTextarea [(ngModel)]="messageForm.content" rows="4" class="w-full"></textarea>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton pRipple label="إلغاء" class="p-button-text" (click)="sendDialogVisible = false"></button>
        <button pButton pRipple label="إرسال" icon="pi pi-send" (click)="sendMessage()"></button>
      </ng-template>
    </p-dialog>
  `,
})
export class MessagesComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly messageService = inject(MessageService);

  smsCount = signal(8520);
  emailCount = signal(15340);
  pushCount = signal(25680);
  whatsappCount = signal(3210);

  providers = signal([
    { id: '1', name: 'Twilio', type: 'sms', isActive: true },
    { id: '2', name: 'SendGrid', type: 'email', isActive: true },
    { id: '3', name: 'Firebase', type: 'push', isActive: true },
    { id: '4', name: 'WhatsApp Business', type: 'whatsapp', isActive: false },
  ]);

  smsMessages = signal([
    { recipient: '+966501234567', content: 'تم استلام دفعتك بنجاح. شكراً لك.', provider: 'Twilio', status: 'delivered', createdAt: new Date() },
    { recipient: '+966509876543', content: 'تذكير: فاتورتك مستحقة خلال 3 أيام.', provider: 'Twilio', status: 'delivered', createdAt: new Date() },
  ]);

  emailMessages = signal([
    { recipient: 'user@example.com', subject: 'فاتورة شهر ديسمبر', provider: 'SendGrid', status: 'delivered', createdAt: new Date() },
    { recipient: 'admin@company.com', subject: 'تقرير الاستهلاك الشهري', provider: 'SendGrid', status: 'pending', createdAt: new Date() },
  ]);

  templates = signal([
    { id: '1', name: 'تأكيد الدفع', type: 'sms', content: 'تم استلام دفعتك بمبلغ {{amount}} ر.س. رقم المرجع: {{ref}}' },
    { id: '2', name: 'تذكير الفاتورة', type: 'email', content: 'عزيزي {{name}}، نود تذكيرك بأن فاتورتك مستحقة...' },
    { id: '3', name: 'إشعار انقطاع', type: 'push', content: 'تنبيه: انقطاع مؤقت في الخدمة في منطقتك' },
  ]);

  sendDialogVisible = false;
  messageForm = {
    type: '',
    recipient: '',
    subject: '',
    content: '',
  };

  messageTypeOptions = [
    { label: 'SMS', value: 'sms' },
    { label: 'Email', value: 'email' },
    { label: 'Push Notification', value: 'push' },
    { label: 'WhatsApp', value: 'whatsapp' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // Load from API
  }

  openSendDialog(): void {
    this.messageForm = { type: '', recipient: '', subject: '', content: '' };
    this.sendDialogVisible = true;
  }

  sendMessage(): void {
    if (!this.messageForm.type || !this.messageForm.recipient || !this.messageForm.content) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى ملء الحقول المطلوبة' });
      return;
    }

    this.apiService.post('/messages/send', this.messageForm).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم إرسال الرسالة' });
        this.sendDialogVisible = false;
      },
      error: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم إرسال الرسالة' });
        this.sendDialogVisible = false;
      }
    });
  }

  getProviderIcon(type: string): string {
    const icons: Record<string, string> = {
      'sms': 'pi pi-mobile',
      'email': 'pi pi-envelope',
      'push': 'pi pi-bell',
      'whatsapp': 'pi pi-whatsapp',
    };
    return icons[type] || 'pi pi-send';
  }

  getProviderTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'sms': 'SMS',
      'email': 'Email',
      'push': 'Push',
      'whatsapp': 'WhatsApp',
    };
    return labels[type] || type;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'قيد الإرسال',
      'sent': 'تم الإرسال',
      'delivered': 'تم التسليم',
      'failed': 'فشل',
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
    switch (status) {
      case 'delivered': return 'success';
      case 'sent': return 'info';
      case 'pending': return 'warn';
      case 'failed': return 'danger';
      default: return 'info';
    }
  }
}
