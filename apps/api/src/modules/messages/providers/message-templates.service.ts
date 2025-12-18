import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface MessageTemplate {
  id?: string;
  name: string;
  type: 'sms' | 'email' | 'push' | 'whatsapp';
  subject?: string;
  body: string;
  variables: string[];
  category?: string;
  isActive?: boolean;
}

@Injectable()
export class MessageTemplatesService {
  private readonly logger = new Logger(MessageTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * إنشاء قالب رسالة جديد
   */
  async createTemplate(data: MessageTemplate): Promise<MessageTemplate> {
    // Extract variables from body
    const variables = this.extractVariables(data.body);
    if (data.subject) {
      variables.push(...this.extractVariables(data.subject));
    }

    const template = await this.prisma.devMessageTemplate.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject,
        content: data.body,
        variables: [...new Set(variables)], // Remove duplicates
        isActive: data.isActive ?? true,
      },
    });

    return this.mapToTemplate(template);
  }

  /**
   * الحصول على جميع القوالب
   */
  async findAllTemplates(query: { type?: string; category?: string; isActive?: boolean }): Promise<MessageTemplate[]> {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const templates = await this.prisma.devMessageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return templates.map(t => this.mapToTemplate(t));
  }

  /**
   * الحصول على قالب بالاسم
   */
  async findTemplateByName(name: string): Promise<MessageTemplate | null> {
    const template = await this.prisma.devMessageTemplate.findFirst({
      where: { name, isActive: true },
    });

    return template ? this.mapToTemplate(template) : null;
  }

  /**
   * الحصول على قالب بالمعرف
   */
  async findTemplateById(id: string): Promise<MessageTemplate> {
    const template = await this.prisma.devMessageTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`القالب غير موجود: ${id}`);
    }

    return this.mapToTemplate(template);
  }

  /**
   * تحديث قالب
   */
  async updateTemplate(id: string, data: Partial<MessageTemplate>): Promise<MessageTemplate> {
    const existing = await this.prisma.devMessageTemplate.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`القالب غير موجود: ${id}`);
    }

    let variables = existing.variables as string[];
    if (data.body) {
      variables = this.extractVariables(data.body);
      if (data.subject) {
        variables.push(...this.extractVariables(data.subject));
      }
      variables = [...new Set(variables)];
    }

    const updated = await this.prisma.devMessageTemplate.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject,
        content: data.body,
        variables,
        isActive: data.isActive,
      },
    });

    return this.mapToTemplate(updated);
  }

  /**
   * حذف قالب
   */
  async deleteTemplate(id: string): Promise<void> {
    const existing = await this.prisma.devMessageTemplate.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`القالب غير موجود: ${id}`);
    }

    await this.prisma.devMessageTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * معالجة القالب مع البيانات
   */
  async processTemplate(templateName: string, data: Record<string, any>): Promise<{ subject?: string; body: string }> {
    const template = await this.findTemplateByName(templateName);
    
    if (!template) {
      throw new NotFoundException(`القالب غير موجود: ${templateName}`);
    }

    const body = this.replaceVariables(template.body, data);
    const subject = template.subject ? this.replaceVariables(template.subject, data) : undefined;

    return { subject, body };
  }

  /**
   * استخراج المتغيرات من النص
   */
  private extractVariables(text: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      variables.push(match[1]);
    }

    return variables;
  }

  /**
   * استبدال المتغيرات في النص
   */
  private replaceVariables(text: string, data: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] !== undefined ? String(data[variable]) : match;
    });
  }

  /**
   * التحقق من صحة البيانات للقالب
   */
  validateTemplateData(template: MessageTemplate, data: Record<string, any>): { valid: boolean; missing: string[] } {
    const missing = template.variables.filter(v => data[v] === undefined);
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * الحصول على القوالب الافتراضية
   */
  getDefaultTemplates(): MessageTemplate[] {
    return [
      {
        name: 'welcome_sms',
        type: 'sms',
        body: 'مرحباً {{name}}، شكراً لتسجيلك في نظامنا. رقم حسابك: {{accountNumber}}',
        variables: ['name', 'accountNumber'],
        category: 'welcome',
      },
      {
        name: 'payment_reminder',
        type: 'sms',
        body: 'عزيزي {{name}}، نذكرك بموعد سداد فاتورتك رقم {{invoiceNumber}} بمبلغ {{amount}} ريال. الموعد النهائي: {{dueDate}}',
        variables: ['name', 'invoiceNumber', 'amount', 'dueDate'],
        category: 'billing',
      },
      {
        name: 'payment_confirmation',
        type: 'sms',
        body: 'تم استلام دفعتك بمبلغ {{amount}} ريال بنجاح. رقم المعاملة: {{transactionId}}. شكراً لك.',
        variables: ['amount', 'transactionId'],
        category: 'billing',
      },
      {
        name: 'service_outage',
        type: 'sms',
        body: 'عزيزي {{name}}، نعتذر عن انقطاع الخدمة في منطقتك. سيتم إصلاح العطل خلال {{estimatedTime}}.',
        variables: ['name', 'estimatedTime'],
        category: 'notification',
      },
      {
        name: 'welcome_email',
        type: 'email',
        subject: 'مرحباً بك في نظامنا',
        body: `
          <h1>مرحباً {{name}}</h1>
          <p>شكراً لتسجيلك في نظامنا.</p>
          <p>رقم حسابك: <strong>{{accountNumber}}</strong></p>
          <p>يمكنك الآن الوصول إلى جميع خدماتنا.</p>
        `,
        variables: ['name', 'accountNumber'],
        category: 'welcome',
      },
      {
        name: 'invoice_email',
        type: 'email',
        subject: 'فاتورتك الشهرية - {{invoiceNumber}}',
        body: `
          <h1>فاتورتك الشهرية</h1>
          <p>عزيزي {{name}}،</p>
          <p>نرفق لك فاتورتك الشهرية:</p>
          <ul>
            <li>رقم الفاتورة: {{invoiceNumber}}</li>
            <li>المبلغ: {{amount}} ريال</li>
            <li>تاريخ الاستحقاق: {{dueDate}}</li>
          </ul>
          <p>يرجى السداد قبل الموعد المحدد.</p>
        `,
        variables: ['name', 'invoiceNumber', 'amount', 'dueDate'],
        category: 'billing',
      },
    ];
  }

  /**
   * تهيئة القوالب الافتراضية
   */
  async seedDefaultTemplates(): Promise<number> {
    const defaults = this.getDefaultTemplates();
    let created = 0;

    for (const template of defaults) {
      const existing = await this.prisma.devMessageTemplate.findFirst({
        where: { name: template.name },
      });

      if (!existing) {
        await this.createTemplate(template);
        created++;
      }
    }

    return created;
  }

  private mapToTemplate(record: any): MessageTemplate {
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      subject: record.subject,
      body: record.content,
      variables: record.variables as string[],
      isActive: record.isActive,
    };
  }
}
