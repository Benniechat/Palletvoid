/**
 * Inventory Reservation and Order Transaction Processing Service
 * Provides atomic transactions, prevents overselling, supports idempotent checkout
 */
import { db } from '../database.js';

export function checkAndReserveInventory(items) {
  // Run inside an immediate transaction to eliminate race conditions
  const reserveTx = db.transaction((orderItems) => {
    for (const item of orderItems) {
      const product = db.prepare('SELECT id, stock_quantity, is_made_to_order, name FROM products WHERE id = ?').get(item.productId);
      
      if (!product) {
        throw new Error(`Product ID ${item.productId} does not exist.`);
      }

      if (!product.is_made_to_order) {
        if (product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, requested: ${item.quantity}.`);
        }
        
        // Decrement stock
        const newQty = product.stock_quantity - item.quantity;
        db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newQty, product.id);

        // Record movement
        db.prepare(`
          INSERT INTO inventory_movements (product_id, change_quantity, new_quantity, reason)
          VALUES (?, ?, ?, 'purchase_reservation')
        `).run(product.id, -item.quantity, newQty);
      }
    }
  });

  reserveTx(items);
}

export function restoreInventory(orderId, reason = 'order_cancellation') {
  const restoreTx = db.transaction((id) => {
    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);
    for (const item of items) {
      const product = db.prepare('SELECT id, stock_quantity, is_made_to_order FROM products WHERE id = ?').get(item.product_id);
      if (product && !product.is_made_to_order) {
        const newQty = product.stock_quantity + item.quantity;
        db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newQty, product.id);

        db.prepare(`
          INSERT INTO inventory_movements (product_id, change_quantity, new_quantity, reason, reference_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(product.id, item.quantity, newQty, reason, id.toString());
      }
    }
  });

  restoreTx(orderId);
}

export function createOrder({
  userId,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
  shippingCity,
  shippingState,
  deliveryNotes,
  items,
  shippingFeeKobo,
  discountKobo = 0,
  paymentMethod,
  idempotencyKey
}) {
  // Idempotency check: if key already exists, return the existing order
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  // Calculate totals
  const subtotalKobo = items.reduce((sum, item) => sum + (item.priceKobo * item.quantity), 0);
  const totalKobo = subtotalKobo + shippingFeeKobo - discountKobo;
  const orderNumber = 'PV' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);

  const orderTx = db.transaction(() => {
    // 1. Reserve Inventory atomically
    checkAndReserveInventory(items);

    // 2. Insert Order
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, customer_email, customer_name, customer_phone,
        shipping_address, shipping_city, shipping_state, delivery_notes,
        subtotal_kobo, shipping_fee_kobo, discount_kobo, total_kobo,
        payment_method, payment_status, fulfilment_status, idempotency_key
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, 'pending', 'pending', ?
      )
    `);

    const result = insertOrder.run(
      orderNumber,
      userId || null,
      customerEmail,
      customerName,
      customerPhone,
      shippingAddress,
      shippingCity,
      shippingState,
      deliveryNotes || '',
      subtotalKobo,
      shippingFeeKobo,
      discountKobo,
      totalKobo,
      paymentMethod,
      idempotencyKey || null
    );

    const orderId = result.lastInsertRowid;

    // 3. Insert Order Items
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, sku, variation_details, unit_price_kobo, quantity, line_total_kobo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        orderId,
        item.productId,
        item.name,
        item.sku,
        item.variation || '',
        item.priceKobo,
        item.quantity,
        item.priceKobo * item.quantity
      );
    }

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });

  return orderTx();
}

export function markOrderAsPaid(orderId, paymentReference, provider = 'paystack', actorId = null) {
  const tx = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Order not found');

    if (order.payment_status === 'paid') {
      return order; // Idempotent check
    }

    db.prepare(`
      UPDATE orders
      SET payment_status = 'paid', fulfilment_status = 'confirmed', payment_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(paymentReference, orderId);

    // Record payment transaction
    db.prepare(`
      INSERT INTO payment_transactions (order_id, reference, provider, amount_kobo, status, verified_by_actor_id)
      VALUES (?, ?, ?, ?, 'successful', ?)
    `).run(orderId, paymentReference, provider, order.total_kobo, actorId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
      VALUES (?, 'MARK_ORDER_PAID', 'orders', ?, ?)
    `).run(actorId, orderId.toString(), `Order ${order.order_number} marked as paid via ${provider} with ref ${paymentReference}`);

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });

  return tx();
}
