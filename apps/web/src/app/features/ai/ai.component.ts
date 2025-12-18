import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';

import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TextareaModule,
    SelectModule,
    ToastModule,
    TabsModule,
    ProgressSpinnerModule,
    ChartModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-left"></p-toast>

    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">الذكاء الاصطناعي</h1>
          <p class="text-gray-500 mt-1">خدمات التحليل والتنبؤ ومعالجة اللغة الطبيعية</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <i class="pi pi-sparkles text-xl text-purple-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-purple-600">{{ totalRequests() | number }}</p>
              <p class="text-sm text-gray-500">إجمالي الطلبات</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <i class="pi pi-chart-line text-xl text-blue-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-blue-600">{{ analysisCount() }}</p>
              <p class="text-sm text-gray-500">تحليلات</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <i class="pi pi-eye text-xl text-green-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-green-600">{{ predictionCount() }}</p>
              <p class="text-sm text-gray-500">تنبؤات</p>
            </div>
          </div>
        </p-card>
        <p-card styleClass="shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <i class="pi pi-comments text-xl text-orange-600"></i>
            </div>
            <div>
              <p class="text-2xl font-bold text-orange-600">{{ chatCount() }}</p>
              <p class="text-sm text-gray-500">محادثات</p>
            </div>
          </div>
        </p-card>
      </div>

      <!-- Tabs -->
      <p-tabs>
        <!-- Analysis Tab -->
        <p-tabpanel header="التحليل">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <p-card header="تحليل البيانات" styleClass="shadow-sm">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">نوع التحليل</label>
                  <p-select [options]="analysisTypeOptions"
                              [(ngModel)]="analysisForm.type"
                              optionLabel="label"
                              optionValue="value"
                              placeholder="اختر نوع التحليل"
                              styleClass="w-full">
                  </p-select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">البيانات</label>
                  <textarea pTextarea [(ngModel)]="analysisForm.data" rows="5" class="w-full"
                            placeholder='{"values": [100, 150, 120, 180, 200]}'></textarea>
                </div>
                <button pButton pRipple 
                        label="تحليل" 
                        icon="pi pi-chart-bar"
                        [loading]="analyzing()"
                        (click)="analyze()">
                </button>
              </div>
            </p-card>

            <p-card header="نتيجة التحليل" styleClass="shadow-sm">
              @if (analyzing()) {
                <div class="flex items-center justify-center py-12">
                  <p-progressSpinner></p-progressSpinner>
                </div>
              } @else if (analysisResult()) {
                <div class="space-y-4">
                  <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="font-medium text-gray-700 mb-2">الملخص</h4>
                    <p class="text-gray-600">{{ analysisResult()?.summary }}</p>
                  </div>
                  @if (analysisResult()?.insights) {
                    <div>
                      <h4 class="font-medium text-gray-700 mb-2">الرؤى</h4>
                      <ul class="list-disc list-inside space-y-1 text-gray-600">
                        @for (insight of analysisResult()?.insights; track insight) {
                          <li>{{ insight }}</li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center py-12 text-gray-400">
                  <i class="pi pi-chart-bar text-4xl"></i>
                  <p class="mt-2">أدخل البيانات وانقر على تحليل</p>
                </div>
              }
            </p-card>
          </div>
        </p-tabpanel>

        <!-- Prediction Tab -->
        <p-tabpanel header="التنبؤ">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <p-card header="طلب تنبؤ" styleClass="shadow-sm">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">نوع التنبؤ</label>
                  <p-select [options]="predictionTypeOptions"
                              [(ngModel)]="predictionForm.type"
                              optionLabel="label"
                              optionValue="value"
                              placeholder="اختر نوع التنبؤ"
                              styleClass="w-full">
                  </p-select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">البيانات التاريخية</label>
                  <textarea pTextarea [(ngModel)]="predictionForm.historicalData" rows="5" class="w-full"
                            placeholder='[100, 120, 115, 140, 160, 155]'></textarea>
                </div>
                <button pButton pRipple 
                        label="تنبؤ" 
                        icon="pi pi-eye"
                        [loading]="predicting()"
                        (click)="predict()">
                </button>
              </div>
            </p-card>

            <p-card header="نتيجة التنبؤ" styleClass="shadow-sm">
              @if (predicting()) {
                <div class="flex items-center justify-center py-12">
                  <p-progressSpinner></p-progressSpinner>
                </div>
              } @else if (predictionResult()) {
                <div class="space-y-4">
                  <p-chart type="line" [data]="predictionChartData()" [options]="chartOptions"></p-chart>
                  <div class="bg-blue-50 rounded-lg p-4">
                    <p class="text-sm text-blue-700">
                      <i class="pi pi-info-circle ml-1"></i>
                      الثقة: {{ predictionResult()?.confidence }}%
                    </p>
                  </div>
                </div>
              } @else {
                <div class="text-center py-12 text-gray-400">
                  <i class="pi pi-eye text-4xl"></i>
                  <p class="mt-2">أدخل البيانات وانقر على تنبؤ</p>
                </div>
              }
            </p-card>
          </div>
        </p-tabpanel>

        <!-- Chat Tab -->
        <p-tabpanel header="المحادثة">
          <div class="max-w-3xl mx-auto mt-4">
            <p-card styleClass="shadow-sm">
              <!-- Chat Messages -->
              <div class="h-96 overflow-y-auto mb-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                @for (message of chatMessages(); track message.id) {
                  <div class="flex gap-3"
                       [class.flex-row-reverse]="message.role === 'user'">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                         [class.bg-purple-100]="message.role === 'assistant'"
                         [class.bg-blue-100]="message.role === 'user'">
                      <i [class]="message.role === 'assistant' ? 'pi pi-sparkles text-purple-600' : 'pi pi-user text-blue-600'"
                         class="text-sm"></i>
                    </div>
                    <div class="max-w-[80%] rounded-lg p-3"
                         [class.bg-white]="message.role === 'assistant'"
                         [class.bg-blue-500]="message.role === 'user'"
                         [class.text-white]="message.role === 'user'">
                      <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
                    </div>
                  </div>
                }
                @if (chatLoading()) {
                  <div class="flex gap-3">
                    <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <i class="pi pi-sparkles text-purple-600 text-sm"></i>
                    </div>
                    <div class="bg-white rounded-lg p-3">
                      <div class="flex gap-1">
                        <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                        <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                        <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                      </div>
                    </div>
                  </div>
                }
              </div>

              <!-- Chat Input -->
              <div class="flex gap-2">
                <textarea pTextarea [(ngModel)]="chatInput" rows="2" class="flex-1"
                          placeholder="اكتب سؤالك هنا..."
                          (keydown.enter)="$event.preventDefault(); sendChat()"></textarea>
                <button pButton pRipple 
                        icon="pi pi-send" 
                        [loading]="chatLoading()"
                        (click)="sendChat()">
                </button>
              </div>
            </p-card>
          </div>
        </p-tabpanel>

        <!-- Usage Tab -->
        <p-tabpanel header="الاستخدام">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <p-card header="استخدام API" styleClass="shadow-sm">
              <p-chart type="bar" [data]="usageChartData" [options]="chartOptions"></p-chart>
            </p-card>
            <p-card header="التوزيع حسب النوع" styleClass="shadow-sm">
              <p-chart type="doughnut" [data]="typeDistributionData" [options]="pieOptions"></p-chart>
            </p-card>
          </div>
        </p-tabpanel>
      </p-tabs>
    </div>
  `,
})
export class AiComponent {
  private readonly apiService = inject(ApiService);
  private readonly messageService = inject(MessageService);

  totalRequests = signal(15420);
  analysisCount = signal(5230);
  predictionCount = signal(3180);
  chatCount = signal(7010);

  analyzing = signal(false);
  predicting = signal(false);
  chatLoading = signal(false);

  analysisResult = signal<any>(null);
  predictionResult = signal<any>(null);
  predictionChartData = signal<any>(null);

  chatMessages = signal<{ id: number; role: string; content: string }[]>([
    { id: 1, role: 'assistant', content: 'مرحباً! أنا مساعد الذكاء الاصطناعي. كيف يمكنني مساعدتك اليوم؟' }
  ]);
  chatInput = '';

  analysisForm = {
    type: '',
    data: '',
  };

  predictionForm = {
    type: '',
    historicalData: '',
  };

  analysisTypeOptions = [
    { label: 'تحليل الاستهلاك', value: 'consumption' },
    { label: 'تحليل الأنماط', value: 'patterns' },
    { label: 'تحليل الشذوذ', value: 'anomaly' },
    { label: 'تحليل الاتجاهات', value: 'trends' },
  ];

  predictionTypeOptions = [
    { label: 'تنبؤ الاستهلاك', value: 'consumption' },
    { label: 'تنبؤ الطلب', value: 'demand' },
    { label: 'تنبؤ الأعطال', value: 'failures' },
    { label: 'تنبؤ التكاليف', value: 'costs' },
  ];

  usageChartData = {
    labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
    datasets: [
      {
        label: 'طلبات API',
        data: [2100, 2400, 2800, 3200, 2900, 3500],
        backgroundColor: '#8b5cf6',
      }
    ]
  };

  typeDistributionData = {
    labels: ['تحليل', 'تنبؤ', 'محادثة', 'استخراج'],
    datasets: [
      {
        data: [35, 25, 30, 10],
        backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'],
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

  analyze(): void {
    if (!this.analysisForm.type || !this.analysisForm.data) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى ملء جميع الحقول' });
      return;
    }

    this.analyzing.set(true);

    this.apiService.post('/ai/analyze', {
      type: this.analysisForm.type,
      data: JSON.parse(this.analysisForm.data),
    }).subscribe({
      next: (result) => {
        this.analysisResult.set(result);
        this.analyzing.set(false);
      },
      error: (err) => {
        // Mock result for demo
        this.analysisResult.set({
          summary: 'تم تحليل البيانات بنجاح. يظهر اتجاه تصاعدي في الاستهلاك مع بعض التقلبات الموسمية.',
          insights: [
            'متوسط الاستهلاك: 150 وحدة',
            'أعلى قيمة: 200 وحدة',
            'أدنى قيمة: 100 وحدة',
            'معدل النمو: 15%',
          ]
        });
        this.analyzing.set(false);
      }
    });
  }

  predict(): void {
    if (!this.predictionForm.type || !this.predictionForm.historicalData) {
      this.messageService.add({ severity: 'warn', summary: 'تنبيه', detail: 'يرجى ملء جميع الحقول' });
      return;
    }

    this.predicting.set(true);

    this.apiService.post('/ai/predict', {
      type: this.predictionForm.type,
      historicalData: JSON.parse(this.predictionForm.historicalData),
    }).subscribe({
      next: (result) => {
        this.predictionResult.set(result);
        this.updatePredictionChart(result);
        this.predicting.set(false);
      },
      error: () => {
        // Mock result for demo
        const mockResult = {
          predictions: [165, 175, 180, 190],
          confidence: 85,
        };
        this.predictionResult.set(mockResult);
        this.updatePredictionChart(mockResult);
        this.predicting.set(false);
      }
    });
  }

  updatePredictionChart(result: any): void {
    const historical = JSON.parse(this.predictionForm.historicalData || '[]');
    const labels = [...historical.map((_: any, i: number) => `T${i + 1}`), ...result.predictions.map((_: any, i: number) => `P${i + 1}`)];
    
    this.predictionChartData.set({
      labels,
      datasets: [
        {
          label: 'بيانات تاريخية',
          data: [...historical, ...Array(result.predictions.length).fill(null)],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
        },
        {
          label: 'تنبؤات',
          data: [...Array(historical.length).fill(null), ...result.predictions],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderDash: [5, 5],
          fill: true,
        }
      ]
    });
  }

  sendChat(): void {
    if (!this.chatInput.trim()) return;

    const userMessage = this.chatInput.trim();
    this.chatInput = '';

    const messages = this.chatMessages();
    messages.push({ id: messages.length + 1, role: 'user', content: userMessage });
    this.chatMessages.set([...messages]);

    this.chatLoading.set(true);

    this.apiService.post<{ response: string }>('/ai/chat', {
      message: userMessage,
      context: 'electricity_management',
    }).subscribe({
      next: (result) => {
        const msgs = this.chatMessages();
        msgs.push({ id: msgs.length + 1, role: 'assistant', content: result.response });
        this.chatMessages.set([...msgs]);
        this.chatLoading.set(false);
      },
      error: () => {
        // Mock response for demo
        const mockResponse = this.getMockResponse(userMessage);
        const msgs = this.chatMessages();
        msgs.push({ id: msgs.length + 1, role: 'assistant', content: mockResponse });
        this.chatMessages.set([...msgs]);
        this.chatLoading.set(false);
      }
    });
  }

  getMockResponse(question: string): string {
    if (question.includes('استهلاك') || question.includes('كهرباء')) {
      return 'بناءً على تحليل البيانات، متوسط الاستهلاك الشهري هو 450 كيلوواط/ساعة. يمكنك تقليل الاستهلاك عن طريق:\n\n1. استخدام أجهزة موفرة للطاقة\n2. إطفاء الأجهزة غير المستخدمة\n3. استخدام الإضاءة الطبيعية';
    }
    if (question.includes('فاتورة') || question.includes('دفع')) {
      return 'يمكنني مساعدتك في فهم فاتورتك. الفاتورة تتكون من:\n\n- رسوم الاستهلاك\n- رسوم الخدمة\n- ضريبة القيمة المضافة\n\nهل تريد تفاصيل أكثر عن أي جزء؟';
    }
    return 'شكراً لسؤالك. أنا هنا لمساعدتك في أي استفسارات تتعلق بإدارة الكهرباء، الفواتير، الاستهلاك، أو أي موضوع آخر. كيف يمكنني مساعدتك؟';
  }
}
