import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface PaymentProviderResult {
  externalId?: string;
  status: 'pending' | 'completed' | 'failed';
  redirectUrl?: string;
  response?: any;
  error?: string;
}

export interface PaymentRequest {
  transactionId: string;
  amount: number;
  currency: string;
  customerId?: string;
  invoiceId?: string;
  returnUrl?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentProvidersService {
  private readonly logger = new Logger(PaymentProvidersService.name);

  // ==================== Flooss (فلوس) ====================
  
  async processFlooss(
    credentials: { apiKey: string; merchantId: string; secretKey: string },
    request: PaymentRequest,
    apiUrl: string,
  ): Promise<PaymentProviderResult> {
    this.logger.log(`Processing Flooss payment: ${request.transactionId}`);

    try {
      const payload = {
        merchant_id: credentials.merchantId,
        amount: request.amount,
        currency: request.currency,
        reference: request.transactionId,
        customer_id: request.customerId,
        invoice_id: request.invoiceId,
        return_url: request.returnUrl,
        callback_url: request.callbackUrl,
        metadata: request.metadata,
      };

      const signature = this.generateFloossSignature(payload, credentials.secretKey);

      const response = await axios.post(`${apiUrl}/v1/payments`, payload, {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'X-Signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      return {
        externalId: response.data.payment_id,
        status: response.data.status === 'created' ? 'pending' : response.data.status,
        redirectUrl: response.data.checkout_url,
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(`Flooss payment failed: ${error.message}`);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  private generateFloossSignature(payload: any, secretKey: string): string {
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  }

  // ==================== Jawali (جوالي) ====================

  async processJawali(
    credentials: { apiKey: string; merchantId: string; pin: string },
    request: PaymentRequest,
    apiUrl: string,
  ): Promise<PaymentProviderResult> {
    this.logger.log(`Processing Jawali payment: ${request.transactionId}`);

    try {
      const payload = {
        merchantId: credentials.merchantId,
        pin: credentials.pin,
        amount: request.amount,
        currency: request.currency || 'YER',
        referenceNumber: request.transactionId,
        customerMobile: request.metadata?.mobile,
        description: request.metadata?.description || 'Payment',
      };

      const response = await axios.post(`${apiUrl}/api/v2/payment/initiate`, payload, {
        headers: {
          'X-API-Key': credentials.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      return {
        externalId: response.data.transactionId,
        status: response.data.status === 'INITIATED' ? 'pending' : response.data.status.toLowerCase(),
        redirectUrl: response.data.paymentUrl,
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(`Jawali payment failed: ${error.message}`);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== PayPal ====================

  async processPayPal(
    credentials: { clientId: string; clientSecret: string },
    request: PaymentRequest,
    apiUrl: string,
  ): Promise<PaymentProviderResult> {
    this.logger.log(`Processing PayPal payment: ${request.transactionId}`);

    try {
      // Get access token
      const tokenResponse = await axios.post(
        `${apiUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: credentials.clientId,
            password: credentials.clientSecret,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const accessToken = tokenResponse.data.access_token;

      // Create order
      const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: request.transactionId,
            amount: {
              currency_code: request.currency,
              value: request.amount.toFixed(2),
            },
            description: request.metadata?.description,
            invoice_id: request.invoiceId,
          },
        ],
        application_context: {
          return_url: request.returnUrl,
          cancel_url: request.callbackUrl,
          brand_name: 'Developer System',
          locale: 'ar-SA',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      };

      const orderResponse = await axios.post(`${apiUrl}/v2/checkout/orders`, orderPayload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const approveLink = orderResponse.data.links.find((l: any) => l.rel === 'approve');

      return {
        externalId: orderResponse.data.id,
        status: 'pending',
        redirectUrl: approveLink?.href,
        response: orderResponse.data,
      };
    } catch (error: any) {
      this.logger.error(`PayPal payment failed: ${error.message}`);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  // ==================== Webhook Verification ====================

  verifyFloossWebhook(payload: any, signature: string, secretKey: string): boolean {
    const expectedSignature = this.generateFloossSignature(payload, secretKey);
    return signature === expectedSignature;
  }

  verifyJawaliWebhook(payload: any, signature: string, apiKey: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto.createHmac('sha256', apiKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    return signature === expectedSignature;
  }

  verifyPayPalWebhook(payload: any, headers: Record<string, string>, webhookId: string): boolean {
    // PayPal webhook verification requires calling their API
    // This is a simplified version
    return true;
  }
}
