import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    ButtonModule,
    AvatarModule,
    RippleModule,
    BadgeModule,
    TooltipModule,
  ],
  template: `
    <div class="min-h-screen bg-gray-50" dir="rtl">
      <!-- Top Navigation -->
      <header class="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-4">
            <button pButton pRipple 
                    icon="pi pi-bars" 
                    class="p-button-text p-button-rounded"
                    (click)="sidebarVisible = !sidebarVisible">
            </button>
            <div class="flex items-center gap-2">
              <i class="pi pi-code text-2xl text-primary-600"></i>
              <span class="text-xl font-bold text-gray-800">نظام المطور</span>
            </div>
          </div>
          
          <div class="flex items-center gap-3">
            <button pButton pRipple 
                    icon="pi pi-bell" 
                    class="p-button-text p-button-rounded"
                    pBadge value="3" severity="danger">
            </button>
            <p-avatar icon="pi pi-user" 
                      styleClass="bg-primary-100 text-primary-600"
                      shape="circle">
            </p-avatar>
          </div>
        </div>
      </header>

      <!-- Sidebar -->
      <aside class="fixed top-16 right-0 h-[calc(100vh-4rem)] w-64 bg-white shadow-lg border-l border-gray-200 overflow-y-auto transition-transform duration-300"
             [class.translate-x-full]="!sidebarVisible"
             [class.translate-x-0]="sidebarVisible">
        <nav class="p-4">
          <ul class="space-y-1">
            @for (item of menuItems; track item.label) {
              <li>
                <a [routerLink]="item.routerLink"
                   routerLinkActive="bg-primary-50 text-primary-700 border-r-4 border-primary-600"
                   class="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
                  <i [class]="item.icon + ' text-lg'"></i>
                  <span class="font-medium">{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="mr-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {{ item.badge }}
                    </span>
                  }
                </a>
              </li>
            }
          </ul>
          
          <div class="mt-8 pt-4 border-t border-gray-200">
            <h3 class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              الأنظمة المتصلة
            </h3>
            <ul class="space-y-1">
              @for (system of connectedSystems; track system.name) {
                <li class="flex items-center gap-3 px-4 py-2 text-sm text-gray-600">
                  <span class="w-2 h-2 rounded-full"
                        [class.bg-green-500]="system.status === 'online'"
                        [class.bg-red-500]="system.status === 'offline'"
                        [class.bg-yellow-500]="system.status === 'degraded'">
                  </span>
                  <span>{{ system.name }}</span>
                </li>
              }
            </ul>
          </div>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="pt-16 transition-all duration-300"
            [class.mr-64]="sidebarVisible"
            [class.mr-0]="!sidebarVisible">
        <div class="p-6">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .translate-x-full {
      transform: translateX(100%);
    }
    .translate-x-0 {
      transform: translateX(0);
    }
    .h-\\[calc\\(100vh-4rem\\)\\] {
      height: calc(100vh - 4rem);
    }
    .top-16 {
      top: 4rem;
    }
    .z-50 {
      z-index: 50;
    }
    .mr-64 {
      margin-right: 16rem;
    }
    .mr-0 {
      margin-right: 0;
    }
    .border-r-4 {
      border-right-width: 4px;
    }
    .border-primary-600 {
      border-color: #4f46e5;
    }
    .bg-primary-50 {
      background-color: #eef2ff;
    }
    .text-primary-700 {
      color: #4338ca;
    }
    .text-primary-600 {
      color: #4f46e5;
    }
    .bg-primary-100 {
      background-color: #e0e7ff;
    }
    .tracking-wider {
      letter-spacing: 0.05em;
    }
    .uppercase {
      text-transform: uppercase;
    }
    .duration-300 {
      transition-duration: 300ms;
    }
    .py-0\\.5 {
      padding-top: 0.125rem;
      padding-bottom: 0.125rem;
    }
  `]
})
export class MainLayout {
  sidebarVisible = true;

  menuItems: MenuItem[] = [
    { label: 'لوحة التحكم', icon: 'pi pi-home', routerLink: '/dashboard' },
    { label: 'التكاملات', icon: 'pi pi-link', routerLink: '/integrations' },
    { label: 'مفاتيح API', icon: 'pi pi-key', routerLink: '/api-keys' },
    { label: 'الأحداث', icon: 'pi pi-bolt', routerLink: '/events', badge: '12' },
    { label: 'المراقبة', icon: 'pi pi-chart-line', routerLink: '/monitoring' },
    { label: 'المدفوعات', icon: 'pi pi-credit-card', routerLink: '/payments' },
    { label: 'الرسائل', icon: 'pi pi-envelope', routerLink: '/messages' },
    { label: 'أجهزة IoT', icon: 'pi pi-microchip', routerLink: '/iot' },
    { label: 'الذكاء الاصطناعي', icon: 'pi pi-sparkles', routerLink: '/ai' },
  ];

  connectedSystems = [
    { name: 'النظام الأم', status: 'online' },
    { name: 'نظام الأصول', status: 'online' },
    { name: 'نظام الفوترة', status: 'degraded' },
    { name: 'نظام المخزون', status: 'offline' },
  ];
}
