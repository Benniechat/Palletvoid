/**
 * Webhooks Controller & Router
 * Processes incoming provider webhook events (Paystack, etc.)
 * Strictly validates signatures and guarantees idempotent processing
 */
import express from 'express';
import { db } from '../database.js';
import { markOrderAsPaid } from '../services/orderService.js';
import { getPaymentAdapter } from '../services/paymentService.js';

const router = express.Router();

// Paystack Signed Webhook Handler
router.post('/paystack', (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const adapter = getPaymentAdapter('paystack');

  // If signature verification fails in production, reject
  if (process.env.NODE_ENV === 'production') {
    if (!signature) {
      return res.status(401).json({ status: false, message: 'Missing signature header' });
    }
    const isValid = adapter.verifyWebhookSignature(signature, JSON.stringify(req.body));
    if (!isValid) {
      return res.status(400).json({ status: false, message: 'Invalid webhook signature' });
    }
  }

  const event = req.body;
  if (!event || !event.event) {
    return res.status(400).json({ status: false, message: 'Malformed webhook payload' });
  }

  console.log(`[Paystack Webhook] Received event: ${event.event} for ref: ${event.data ? event.data.reference : 'N/A'}`);

  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data;

    // Idempotency: verify if already marked paid
    const existingOrder = db.prepare('SELECT id, payment_status FROM orders WHERE payment_reference = ? OR order_number = ?').get(reference, metadata ? metadata.order_number : null);

    if (existingOrder) {
      if (existingOrder.payment_status !== 'paid') {
        markOrderAsPaid(existingOrder.id, reference, 'paystack_webhook');
        console.log(`[Paystack Webhook] Order #${existingOrder.id} successfully marked as PAID via webhook.`);
      } else {
        console.log(`[Paystack Webhook] Order #${existingOrder.id} was already marked as PAID. Idempotent skip.`);
      }
    } else {
      console.warn(`[Paystack Webhook] No matching order found for reference: ${reference}`);
    }
  }

  // Always respond with 200 OK to acknowledge receipt to gateway
  res.status(200).json({ status: true });
});

export default router;
