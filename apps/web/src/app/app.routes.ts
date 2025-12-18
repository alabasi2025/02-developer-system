import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout').then(m => m.MainLayout),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'لوحة التحكم - نظام المطور',
      },
      {
        path: 'integrations',
        loadComponent: () => import('./features/integrations/integrations.component').then(m => m.IntegrationsComponent),
        title: 'التكاملات - نظام المطور',
      },
      {
        path: 'api-keys',
        loadComponent: () => import('./features/api-keys/api-keys.component').then(m => m.ApiKeysComponent),
        title: 'مفاتيح API - نظام المطور',
      },
      {
        path: 'events',
        loadComponent: () => import('./features/events/events.component').then(m => m.EventsComponent),
        title: 'الأحداث - نظام المطور',
      },
      {
        path: 'monitoring',
        loadComponent: () => import('./features/monitoring/monitoring.component').then(m => m.MonitoringComponent),
        title: 'المراقبة - نظام المطور',
      },
      {
        path: 'payments',
        loadComponent: () => import('./features/payments/payments.component').then(m => m.PaymentsComponent),
        title: 'المدفوعات - نظام المطور',
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/messages/messages.component').then(m => m.MessagesComponent),
        title: 'الرسائل - نظام المطور',
      },
      {
        path: 'iot',
        loadComponent: () => import('./features/iot/iot.component').then(m => m.IotComponent),
        title: 'أجهزة IoT - نظام المطور',
      },
      {
        path: 'ai',
        loadComponent: () => import('./features/ai/ai.component').then(m => m.AiComponent),
        title: 'الذكاء الاصطناعي - نظام المطور',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
