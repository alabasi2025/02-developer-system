import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface MessageProviderResult {
  success: boolean;
  externalId?: string;
  error?: string;
  response?: any;
}

export interface MessageRequest {
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class MessageProvidersService {
  private readonly logger = new Logger(MessageProvidersService.name);

  // ==================== Twilio SMS ====================

  async sendTwilioSMS(
    credentials: { accountSid: string; authToken: string; fromNumber: string },
    request: MessageRequest,
  ): Promise<MessageProviderResult> {
    this.logger.log(`Sending SMS via Twilio to ${request.recipient}`);

    try {
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
        new URLSearchParams({
          To: request.recipient,
          From: credentials.fromNumber,
          Body: request.body,
        }),
        {
          auth: {
            username: credentials.accountSid,
            password: credentials.authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
        },
      );

      return {
        success: true,
        externalId: response.data.sid,
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(`Twilio SMS failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== WhatsApp Business API ====================

  async sendWhatsApp(
    credentials: { accessToken: string; phoneNumberId: string },
    request: MessageRequest,
  ): Promise<MessageProviderResult> {
    this.logger.log(`Sending WhatsApp message to ${request.recipient}`);

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: request.recipient.replace(/\D/g, ''), // Remove non-digits
        type: 'text',
        text: {
          body: request.body,
        },
      };

      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${credentials.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      return {
        success: true,
        externalId: response.data.messages?.[0]?.id,
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(`WhatsApp message failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== WhatsApp Template Message ====================

  async sendWhatsAppTemplate(
    credentials: { accessToken: string; phoneNumberId: string },
    request: MessageRequest & { templateName: string; templateLanguage: string; components?: any[] },
  ): Promise<MessageProviderResult> {
    this.logger.log(`Sending WhatsApp template to ${request.recipient}`);

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: request.recipient.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: request.templateName,
          language: {
            code: request.templateLanguage || 'ar',
          },
          components: request.components || [],
        },
      };

      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${credentials.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      return {
        success: true,
        externalId: response.data.messages?.[0]?.id,
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(`WhatsApp template failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== SendGrid Email ====================

  async sendSendGridEmail(
    credentials: { apiKey: string; fromEmail: string; fromName?: string },
    request: MessageRequest,
  ): Promise<MessageProviderResult> {
    this.logger.log(`Sending email via SendGrid to ${request.recipient}`);

    try {
      const payload = {
        personalizations: [
          {
            to: [{ email: request.recipient }],
            subject: request.subject,
          },
        ],
        from: {
          email: credentials.fromEmail,
          name: credentials.fromName || 'Developer System',
        },
        content: [
          {
            type: 'text/html',
            value: request.body,
          },
        ],
      };

      const response = await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      return {
        success: true,
        externalId: response.headers['x-message-id'],
        response: { statusCode: response.status },
      };
    } catch (error: any) {
      this.logger.error(`SendGrid email failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== Firebase Cloud Messaging (FCM) ====================

  async sendFCMPush(
    credentials: { serverKey: string },
    request: MessageRequest & { title: string; deviceToken: string; data?: Record<string, string> },
  ): Promise<MessageProviderResult> {
    this.logger.log(`Sending FCM push notification`);

    try {
      const payload = {
        to: request.deviceToken,
        notification: {
          title: request.title,
          body: request.body,
        },
        data: request.data || {},
      };

      const response = await axios.post(
        'https://fcm.googleapis.com/fcm/send',
        payload,
        {
          headers: {
            'Authorization': `key=${credentials.serverKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      return {
        success: response.data.success === 1,
        externalId: response.data.message_id,
        response: response.data,
        error: response.data.results?.[0]?.error,
      };
    } catch (error: any) {
      this.logger.error(`FCM push failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== FCM v1 API (HTTP v1) ====================

  async sendFCMv1Push(
    credentials: { projectId: string; accessToken: string },
    request: MessageRequest & { title: string; deviceToken: string; data?: Record<string, string> },
  ): Promise<MessageProviderResult> {
    this.logger.log(`Sending FCM v1 push notification`);

    try {
      const payload = {
        message: {
          token: request.deviceToken,
          notification: {
            title: request.title,
            body: request.body,
          },
          data: request.data || {},
        },
      };

      const response = await axios.post(
        `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      return {
        success: true,
        externalId: response.data.name,
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(`FCM v1 push failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== Unifonic SMS ====================

  async sendUnifonicSMS(
    credentials: { appSid: string; senderId: string },
    request: MessageRequest,
  ): Promise<MessageProviderResult> {
    this.logger.log(`Sending SMS via Unifonic to ${request.recipient}`);

    try {
      const payload = {
        AppSid: credentials.appSid,
        SenderID: credentials.senderId,
        Recipient: request.recipient,
        Body: request.body,
      };

      const response = await axios.post(
        'https://el.cloud.unifonic.com/rest/SMS/messages',
        new URLSearchParams(payload as any),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
        },
      );

      return {
        success: response.data.success === 'true',
        externalId: response.data.MessageID,
        response: response.data,
        error: response.data.errorCode ? `Error: ${response.data.errorCode}` : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Unifonic SMS failed: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        response: error.response?.data,
      };
    }
  }
}
