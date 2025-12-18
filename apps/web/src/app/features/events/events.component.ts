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
import { TabsModule } from 'primeng/tabs';
import { TimelineModule } from 'primeng/timeline';
import { MessageService } from 'primeng/api';

import { ApiService } from '../../core/services/api.service';
import { SystemEvent, EventSubscription, PaginatedResponse } from '../../core/models';

@Component({
  selector: 'app-events',
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
    TabsModule,
    TimelineModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-left"></p-toast>

    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">نظام الأحداث</h1>
          <p class="text-gray-500 mt-1">إدارة الأحداث والاشتراكات بين الأنظمة</p>
        </div>
        <button pButton pRipple 
                label="إضافة اشتراك" 
                icon="pi pi-plus"
                (click)="openSubscriptionDialog()">
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">{{ totalEvents() }}</p>
            <p class="text-sm text-gray-500 mt-1">إجمالي الأحداث</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">{{ deliveredEvents() }}</p>
            <p class="text-sm text-gray-500 mt-1">تم التسليم</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-yellow-600">{{ pendingEvents() }}</p>
            <p class="text-sm text-gray-500 mt-1">قيد الانتظار</p>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="text-center">
            <p class="text-3xl font-bold text-purple-600">{{ activeSubscriptions() }}</p>
            <p class="text-sm text-gray-500 mt-1">اشتراكات نشطة</p>
          </div>
        </p-card>
      </div>

      <!-- Tabs -->
      <p-tabs>
        <!-- Events Tab -->
        <p-tabpanel header="الأحداث">
          <p-table [value]="events()" 
                   [loading]="loading()"
                   [paginator]="true" 
                   [rows]="10"
                   styleClass="p-datatable-striped mt-4">
            <ng-template pTemplate="header">
              <tr>
                <th>النوع</th>
                <th>المصدر</th>
                <th>البيانات</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>الإجراءات</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-event>
              <tr>
                <td>
                  <div class="flex items-center gap-2">
                    <i [class]="getEventIcon(event.type) + ' text-gray-500'"></i>
                    <span class="font-mono text-sm">{{ event.type }}</span>
                  </div>
                </td>
                <td>
                  <p-tag [value]="event.source" severity="info"></p-tag>
                </td>
                <td>
                  <button pButton pRipple 
                          label="عرض" 
                          class="p-button-text p-button-sm"
                          (click)="viewEventPayload(event)">
                  </button>
                </td>
                <td>
                  <p-tag [value]="getStatusLabel(event.status)"
                         [severity]="getStatusSeverity(event.status)">
                  </p-tag>
                </td>
                <td class="text-sm text-gray-500">{{ event.createdAt | date:'short' }}</td>
                <td>
                  @if (event.status === 'failed') {
                    <button pButton pRipple 
                            icon="pi pi-refresh" 
                            class="p-button-rounded p-button-text p-button-sm"
                            pTooltip="إعادة المحاولة"
                            (click)="retryEvent(event)">
                    </button>
                  }
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="text-center py-8">
                  <i class="pi pi-bolt text-4xl text-gray-300"></i>
                  <p class="text-gray-400 mt-2">لا توجد أحداث</p>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabpanel>

        <!-- Subscriptions Tab -->
        <p-tabpanel header="الاشتراكات">
          <p-table [value]="subscriptions()" 
                   [paginator]="true" 
                   [rows]="10"
                   styleClass="p-datatable-striped mt-4">
            <ng-template pTemplate="header">
              <tr>
                <th>نوع الحدث</th>
                <th>النظام المشترك</th>
                <th>Webhook URL</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-sub>
              <tr>
                <td class="font-mono text-sm">{{ sub.eventType }}</td>
                <td>
                  <p-tag [value]="sub.subscriberSystem" severity="info"></p-tag>
                </td>
                <td class="text-sm text-gray-600 font-mono">{{ sub.webhookUrl || '-' }}</td>
                <td>
                  <p-tag [value]="sub.isActive ? 'نشط' : 'معطل'"
                         [severity]="sub.isActive ? 'success' : 'danger'">
                  </p-tag>
                </td>
                <td class="text-sm text-gray-500">{{ sub.createdAt | date:'shortDate' }}</td>
                <td>
                  <div class="flex gap-2">
                    <button pButton pRipple 
                            [icon]="sub.isActive ? 'pi pi-pause' : 'pi pi-play'" 
                            class="p-button-rounded p-button-text p-button-sm"
                            (click)="toggleSubscription(sub)">
                    </button>
                    <button pButton pRipple 
                            icon="pi pi-trash" 
                            class="p-button-rounded p-button-text p-button-danger p-button-sm"
                            (click)="deleteSubscription(sub)">
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabpanel>

        <!-- Timeline Tab -->
        <p-tabpanel header="الجدول الزمني">
          <div class="mt-4 max-w-2xl mx-auto">
            <p-timeline [value]="recentEvents()">
              <ng-template pTemplate="content" let-event>
                <p-card styleClass="shadow-sm">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center"
                         [class.bg-green-100]="event.status === 'delivered'"
                         [class.bg-yellow-100]="event.status === 'pending'"
                         [class.bg-red-100]="event.status === 'failed'">
                      <i [class]="getEventIcon(event.type)"
                         [class.text-green-600]="event.status === 'delivered'"
                         [class.text-yellow-600]="event.status === 'pending'"
                         [class.text-red-600]="event.status === 'failed'">
                      </i>
                    </div>
                    <div>
                      <p class="font-medium">{{ event.type }}</p>
                      <p class="text-sm text-gray-500">{{ event.source }}</p>
                    </div>
                  </div>
                </p-card>
              </ng-template>
              <ng-template pTemplate="opposite" let-event>
                <small class="text-gray-400">{{ event.createdAt | date:'shortTime' }}</small>
              </ng-template>
            </p-timeline>
          </div>
        </p-tabpanel>
      </p-tabs>
    </div>

    <!-- View Payload Dialog -->
    <p-dialog [(visible)]="payloadDialogVisible" 
              header="بيانات الحدث"
              [modal]="true"
              [style]="{ width: '600px' }">
      <pre class="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-sm">{{ selectedPayload() | json }}</pre>
    </p-dialog>

    <!-- Add Subscription Dialog -->
    <p-dialog [(visible)]="subscriptionDialogVisible" 
              header="إضافة اشتراك جديد"
              [modal]="true"
              [style]="{ width: '500px' }">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">نوع الحدث *</label>
          <p-select [options]="eventTypeOptions"
                      [(ngModel)]="subscriptionForm.eventType"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="اختر نوع الحدث"
                      styleClass="w-full">
          </p-select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">النظام المشترك *</label>
          <input pInputText [(ngModel)]="subscriptionForm.subscriberSystem" class="w-full" placeholder="core" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <input pInputText [(ngModel)]="subscriptionForm.webhookUrl" class="w-full" placeholder="https://..." />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton pRipple label="إلغاء" class="p-button-text" (click)="subscriptionDialogVisible = false"></button>
        <button pButton pRipple label="إضافة" (click)="createSubscription()"></button>
      </ng-template>
    </p-dialog>
  `,
})
export class EventsComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly messageService = inject(MessageService);

  loading = signal(true);
  events = signal<SystemEvent[]>([]);
  subscriptions = signal<EventSubscription[]>([]);
  recentEvents = signal<SystemEvent[]>([]);
  selectedPayload = signal<any>(null);

  totalEvents = signal(0);
  deliveredEvents = signal(0);
  pendingEvents = signal(0);
  activeSubscriptions = signal(0);

  payloadDialogVisible = false;
  subscriptionDialogVisible = false;

  subscriptionForm = {
    eventType: '',
    subscriberSystem: '',
    webhookUrl: '',
  };

  eventTypeOptions = [
    { label: 'customer.created', value: 'customer.created' },
    { label: 'customer.updated', value: 'customer.updated' },
    { label: 'meter.reading', value: 'meter.reading' },
    { label: 'bill.generated', value: 'bill.generated' },
    { label: 'payment.received', value: 'payment.received' },
    { label: 'alert.triggered', value: 'alert.triggered' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    // Load events
    this.apiService.get<PaginatedResponse<SystemEvent>>('/events').subscribe({
      next: (response) => {
        this.events.set(response.data);
        this.recentEvents.set(response.data.slice(0, 10));
        this.totalEvents.set(response.meta.total);
        this.deliveredEvents.set(response.data.filter(e => e.status === 'delivered').length);
        this.pendingEvents.set(response.data.filter(e => e.status === 'pending').length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });

    // Load subscriptions
    this.apiService.get<PaginatedResponse<EventSubscription>>('/events/subscriptions').subscribe({
      next: (response) => {
        this.subscriptions.set(response.data);
        this.activeSubscriptions.set(response.data.filter(s => s.isActive).length);
      }
    });
  }

  viewEventPayload(event: SystemEvent): void {
    this.selectedPayload.set(event.payload);
    this.payloadDialogVisible = true;
  }

  retryEvent(event: SystemEvent): void {
    this.apiService.post(`/events/${event.id}/retry`, {}).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم إعادة إرسال الحدث' });
        this.loadData();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  openSubscriptionDialog(): void {
    this.subscriptionForm = { eventType: '', subscriberSystem: '', webhookUrl: '' };
    this.subscriptionDialogVisible = true;
  }

  createSubscription(): void {
    if (!this.subscriptionForm.eventType || !this.subscriptionForm.subscriberSystem) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى ملء الحقول المطلوبة' });
      return;
    }

    this.apiService.post('/events/subscriptions', this.subscriptionForm).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم إضافة الاشتراك' });
        this.subscriptionDialogVisible = false;
        this.loadData();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'خطأ', detail: err.message });
      }
    });
  }

  toggleSubscription(sub: EventSubscription): void {
    this.apiService.patch(`/events/subscriptions/${sub.id}`, { isActive: !sub.isActive }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم تحديث الاشتراك' });
        this.loadData();
      }
    });
  }

  deleteSubscription(sub: EventSubscription): void {
    this.apiService.delete(`/events/subscriptions/${sub.id}`).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'نجاح', detail: 'تم حذف الاشتراك' });
        this.loadData();
      }
    });
  }

  getEventIcon(type: string): string {
    if (type.includes('customer')) return 'pi pi-user';
    if (type.includes('meter')) return 'pi pi-microchip';
    if (type.includes('bill')) return 'pi pi-file';
    if (type.includes('payment')) return 'pi pi-credit-card';
    if (type.includes('alert')) return 'pi pi-exclamation-triangle';
    return 'pi pi-bolt';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'قيد الانتظار',
      'delivered': 'تم التسليم',
      'failed': 'فشل',
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'warn' | 'danger' {
    switch (status) {
      case 'delivered': return 'success';
      case 'pending': return 'warn';
      case 'failed': return 'danger';
      default: return 'warn';
    }
  }
}
