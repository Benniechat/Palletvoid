/**
 * Payment Provider Abstraction Interface and Implementations
 * Supports: Paystack (Card, USSD, Bank), Direct Bank Transfer, and Conditional POD
 */
import crypto from 'crypto';

export class PaymentAdapter {
  constructor(name) {
    this.name = name;
  }

  async initializeTransaction(order, options = {}) {
    throw new Error('initializeTransaction() must be implemented.');
  }

  async verifyTransaction(reference) {
    throw new Error('verifyTransaction() must be implemented.');
  }

  verifyWebhookSignature(signature, rawBody) {
    throw new Error('verifyWebhookSignature() must be implemented.');
  }
}

/**
 * Paystack Implementation
 */
export class PaystackPaymentAdapter extends PaymentAdapter {
  constructor() {
    super('paystack');
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || 'pstk_test_secret_placeholder_key';
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY || 'pstk_test_public_placeholder_key';
    this.isTest = (process.env.PAYMENT_MODE || 'test') === 'test';
  }

  async initializeTransaction(order, options = {}) {
    // In production or test with real API key, calls https://api.paystack.co/transaction/initialize
    // If running in development with placeholder keys, provides safe fallback simulation with clear logging
    const reference = `PV_${order.order_number}_${Date.now()}`;
    const amountKobo = order.total_kobo; // Paystack expects amount in Kobo

    if (!this.secretKey || this.secretKey.includes('placeholder')) {
      console.log(`[Paystack Adapter (Test Fallback)] Initialized transaction for order ${order.order_number} (${amountKobo} kobo)`);
      return {
        status: true,
        reference,
        authorization_url: `/checkout/payment-redirect-test?reference=${reference}&order=${order.order_number}`,
        mode: 'test_fallback'
      };
    }

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: order.customer_email,
          amount: amountKobo,
          reference: reference,
          callback_url: `${process.env.APP_URL || 'http://localhost:5000'}/checkout/verify?reference=${reference}`,
          metadata: {
            order_number: order.order_number,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone
          }
        })
      });

      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message || 'Failed to initialize Paystack transaction');
      }

      return {
        status: true,
        reference,
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        mode: 'live_or_sandbox'
      };
    } catch (err) {
      console.error('[Paystack Init Error]', err);
      throw err;
    }
  }

  async verifyTransaction(reference) {
    if (!this.secretKey || this.secretKey.includes('placeholder')) {
      // Test mode mock verification
      return {
        status: true,
        data: {
          status: 'success',
          reference,
          gateway_response: 'Successful (Test Sandbox Verified)'
        }
      };
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });
      return await response.json();
    } catch (err) {
      console.error('[Paystack Verify Error]', err);
      throw err;
    }
  }

  verifyWebhookSignature(signature, rawBody) {
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || this.secretKey;
    const hash = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
    return hash === signature;
  }
}

/**
 * Direct Bank Transfer Adapter
 */
export class BankTransferPaymentAdapter extends PaymentAdapter {
  constructor() {
    super('bank_transfer');
  }

  async initializeTransaction(order) {
    const reference = `BT_${order.order_number}_${Date.now()}`;
    return {
      status: true,
      reference,
      instructions: {
        bank_name: process.env.BANK_NAME || 'UBA Bank',
        account_name: process.env.BANK_ACCOUNT_NAME || 'Palletvoid Global Resources',
        account_number: process.env.BANK_ACCOUNT_NUMBER || '1025214241',
        payment_policy: 'Payment before dispatch. Confirm receipt with admin.'
      }
    };
  }

  async verifyTransaction() {
    // Manual verification is handled strictly by authorized administrators
    return {
      status: false,
      message: 'Bank transfer requires authorized staff verification.'
    };
  }
}

/**
 * Payment on Delivery (POD) Adapter
 */
export class PODPaymentAdapter extends PaymentAdapter {
  constructor() {
    super('pod');
  }

  async initializeTransaction(order) {
    const reference = `POD_${order.order_number}_${Date.now()}`;
    return {
      status: true,
      reference,
      instructions: {
        note: 'Pay upon delivery via POS or direct transfer to the dispatch driver.'
      }
    };
  }
}

// Payment Manager Singleton
export const paymentAdapters = {
  paystack: new PaystackPaymentAdapter(),
  bank_transfer: new BankTransferPaymentAdapter(),
  pod: new PODPaymentAdapter()
};

export function getPaymentAdapter(method) {
  const adapter = paymentAdapters[method];
  if (!adapter) {
    throw new Error(`Unsupported payment method: ${method}`);
  }
  return adapter;
}
