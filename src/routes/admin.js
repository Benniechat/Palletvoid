/**
 * Administrative Portal Router
 * Protected Dashboard, Product Management, Order Processing, Manual Bank Transfer Verification, Inventory Adjustments, Store Settings
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { markOrderAsPaid, restoreInventory } from '../services/orderService.js';
import { renderLayout, formatNaira } from '../views/layout.js';
import { setFlash } from '../server.js';

const router = express.Router();

// Middleware: Role-Based Access Control (Admin Guard)
router.use((req, res, next) => {
  if (!req.user) {
    setFlash(res, 'error', 'Administrative login required.');
    return res.redirect('/auth/login');
  }

  const staffRoles = ['superadmin', 'store_manager', 'order_manager', 'inventory_manager', 'content_manager'];
  if (!staffRoles.includes(req.user.role)) {
    setFlash(res, 'error', 'Access denied. You do not possess administrative permissions.');
    return res.redirect('/');
  }

  next();
});

// Helper Layout Wrapper for Admin
function renderAdminLayout(title, content, req) {
  const adminNav = `
    <div style="background: #1E1E1E; color: #FFFFFF; padding: 12px 0; border-bottom: 2px solid var(--pv-gold);">
      <div class="pv-container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
          <strong style="color: var(--pv-gold); font-size: 1.1rem;">Palletvoid Operations Hub</strong>
          <a href="/admin" style="color: #DDD; font-size: 0.9rem;">Dashboard</a>
          <a href="/admin/orders" style="color: #DDD; font-size: 0.9rem;">Orders</a>
          <a href="/admin/products" style="color: #DDD; font-size: 0.9rem;">Products &amp; Stock</a>
          <a href="/admin/categories" style="color: #DDD; font-size: 0.9rem;">Categories</a>
          <a href="/admin/enquiries" style="color: #DDD; font-size: 0.9rem;">Custom Enquiries</a>
          <a href="/admin/security" style="color: #DDD; font-size: 0.9rem; font-weight: 600; color: var(--pv-gold);">Security &amp; Password</a>
          <a href="/admin/settings" style="color: #DDD; font-size: 0.9rem;">Store Settings</a>
        </div>
        <div style="font-size: 0.85rem; color: #BBB;">
          Logged in as: <strong>${req.user.full_name}</strong> (${req.user.role}) | <a href="/auth/logout" style="color: var(--pv-danger);">Sign Out</a>
        </div>
      </div>
    </div>
  `;

  return renderLayout({
    title: `${title} — Palletvoid Admin`,
    content: adminNav + `<div style="background: #F4F1EA; min-height: 80vh; padding: 40px 0;"><div class="pv-container">${content}</div></div>`,
    user: req.user,
    req
  });
}

// 1. Dashboard Overview
router.get('/', (req, res) => {
  // Aggregate real statistics from database
  const totalOrders = db.prepare('SELECT count(*) as count FROM orders').get().count;
  const paidSales = db.prepare("SELECT COALESCE(SUM(total_kobo), 0) as total FROM orders WHERE payment_status = 'paid'").get().total;
  const pendingOrders = db.prepare("SELECT count(*) as count FROM orders WHERE payment_status = 'pending'").get().count;
  const lowStockCount = db.prepare('SELECT count(*) as count FROM products WHERE stock_quantity <= 5 AND is_made_to_order = 0').get().count;

  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 6').all();
  const lowStockProducts = db.prepare('SELECT * FROM products WHERE stock_quantity <= 5 AND is_made_to_order = 0 LIMIT 5').all();

  const content = `
    <div style="margin-bottom: 30px;">
      <h1 style="font-size: 2rem; margin-bottom: 8px;">Executive Control Dashboard</h1>
      <p style="color: var(--pv-text-muted);">Real-time performance indicators and operational workflows.</p>
    </div>

    <!-- Stat Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 35px;">
      <div style="background: #FFFFFF; padding: 25px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); box-shadow: var(--pv-shadow-sm);">
        <span style="font-size: 0.85rem; color: var(--pv-text-muted); text-transform: uppercase;">Total Orders Placed</span>
        <div style="font-size: 2.2rem; font-weight: bold; margin-top: 10px; color: var(--pv-black);">${totalOrders}</div>
      </div>

      <div style="background: #FFFFFF; padding: 25px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); box-shadow: var(--pv-shadow-sm);">
        <span style="font-size: 0.85rem; color: var(--pv-green); font-weight: 600; text-transform: uppercase;">Verified Paid Revenue</span>
        <div style="font-size: 2.2rem; font-weight: bold; margin-top: 10px; color: var(--pv-green);">${formatNaira(paidSales)}</div>
      </div>

      <div style="background: #FFFFFF; padding: 25px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); box-shadow: var(--pv-shadow-sm);">
        <span style="font-size: 0.85rem; color: var(--pv-gold); font-weight: 600; text-transform: uppercase;">Orders Awaiting Payment</span>
        <div style="font-size: 2.2rem; font-weight: bold; margin-top: 10px; color: var(--pv-gold);">${pendingOrders}</div>
      </div>

      <div style="background: #FFFFFF; padding: 25px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); box-shadow: var(--pv-shadow-sm);">
        <span style="font-size: 0.85rem; color: var(--pv-danger); font-weight: 600; text-transform: uppercase;">Low Stock Warnings</span>
        <div style="font-size: 2.2rem; font-weight: bold; margin-top: 10px; color: var(--pv-danger);">${lowStockCount}</div>
      </div>
    </div>

    <!-- Tables Grid -->
    <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 30px; align-items: flex-start;">
      <!-- Recent Orders Table -->
      <div style="background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); padding: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="font-size: 1.2rem;">Recent Store Orders</h3>
          <a href="/admin/orders" class="pv-btn pv-btn-outline pv-btn-sm">View All</a>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--pv-border); text-align: left; color: var(--pv-text-muted);">
              <th style="padding-bottom: 10px;">Order #</th>
              <th style="padding-bottom: 10px;">Customer</th>
              <th style="padding-bottom: 10px;">Amount</th>
              <th style="padding-bottom: 10px;">Payment</th>
              <th style="padding-bottom: 10px;">Fulfilment</th>
              <th style="padding-bottom: 10px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${recentOrders.map(o => `
              <tr style="border-bottom: 1px solid var(--pv-border);">
                <td style="padding: 12px 0; font-weight: bold;">${o.order_number}</td>
                <td style="padding: 12px 0;">${o.customer_name}</td>
                <td style="padding: 12px 0; font-weight: 600;">${formatNaira(o.total_kobo)}</td>
                <td style="padding: 12px 0;">
                  <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: ${o.payment_status === 'paid' ? 'var(--pv-green-light)' : '#FEF3C7'}; color: ${o.payment_status === 'paid' ? 'var(--pv-green)' : '#92400E'};">
                    ${o.payment_status.toUpperCase()}
                  </span>
                </td>
                <td style="padding: 12px 0;">
                  <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; background: var(--pv-surface-alt);">
                    ${o.fulfilment_status}
                  </span>
                </td>
                <td style="padding: 12px 0;">
                  <a href="/admin/orders/${o.id}" style="color: var(--pv-gold); font-weight: 600;">Manage &rarr;</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Low Stock Alert -->
      <div style="background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); padding: 25px;">
        <h3 style="font-size: 1.2rem; margin-bottom: 15px; color: var(--pv-danger);">Low Stock Products</h3>
        ${lowStockProducts.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${lowStockProducts.map(p => `
              <div style="padding: 12px; background: var(--pv-surface-alt); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>${p.name}</strong>
                  <div style="font-size: 0.8rem; color: var(--pv-text-muted);">SKU: ${p.sku}</div>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 1.1rem; font-weight: bold; color: var(--pv-danger);">${p.stock_quantity} left</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <p style="color: var(--pv-text-muted); font-size: 0.9rem;">All inventory levels are healthy.</p>
        `}
      </div>
    </div>
  `;

  res.send(renderAdminLayout('Dashboard', content, req));
});

// 2. Order Management List
router.get('/orders', (req, res) => {
  const { status, payment } = req.query;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND fulfilment_status = ?';
    params.push(status);
  }
  if (payment) {
    query += ' AND payment_status = ?';
    params.push(payment);
  }

  query += ' ORDER BY id DESC';
  const orders = db.prepare(query).all(...params);

  const content = `
    <div style="margin-bottom: 30px;">
      <h1 style="font-size: 2rem; margin-bottom: 8px;">Order Fulfilment Pipeline</h1>
      <p style="color: var(--pv-text-muted);">Inspect transactions, verify manual bank transfers, update dispatches, and process refunds.</p>
    </div>

    <!-- Filter Bar -->
    <div style="background: #FFFFFF; padding: 20px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); margin-bottom: 25px; display: flex; gap: 15px; flex-wrap: wrap;">
      <a href="/admin/orders" class="pv-btn pv-btn-outline pv-btn-sm">All Orders</a>
      <a href="/admin/orders?payment=paid" class="pv-btn pv-btn-outline pv-btn-sm">Paid Orders</a>
      <a href="/admin/orders?payment=pending" class="pv-btn pv-btn-outline pv-btn-sm">Awaiting Payment</a>
      <a href="/admin/orders?status=confirmed" class="pv-btn pv-btn-outline pv-btn-sm">Confirmed for Production</a>
      <a href="/admin/orders?status=shipped" class="pv-btn pv-btn-outline pv-btn-sm">Shipped</a>
    </div>

    <div style="background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); padding: 25px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
        <thead>
          <tr style="border-bottom: 2px solid var(--pv-border); text-align: left; color: var(--pv-text-muted);">
            <th style="padding-bottom: 12px;">Order #</th>
            <th style="padding-bottom: 12px;">Date</th>
            <th style="padding-bottom: 12px;">Customer</th>
            <th style="padding-bottom: 12px;">Method</th>
            <th style="padding-bottom: 12px;">Total</th>
            <th style="padding-bottom: 12px;">Payment</th>
            <th style="padding-bottom: 12px;">Fulfilment</th>
            <th style="padding-bottom: 12px; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr style="border-bottom: 1px solid var(--pv-border);">
              <td style="padding: 14px 0; font-weight: bold;">${o.order_number}</td>
              <td style="padding: 14px 0; font-size: 0.85rem; color: var(--pv-text-muted);">${new Date(o.created_at).toLocaleDateString('en-NG')}</td>
              <td style="padding: 14px 0;">${o.customer_name}<div style="font-size: 0.8rem; color: var(--pv-text-muted);">${o.customer_phone}</div></td>
              <td style="padding: 14px 0; text-transform: uppercase; font-size: 0.85rem;">${o.payment_method}</td>
              <td style="padding: 14px 0; font-weight: bold; color: var(--pv-black);">${formatNaira(o.total_kobo)}</td>
              <td style="padding: 14px 0;">
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: ${o.payment_status === 'paid' ? 'var(--pv-green-light)' : '#FEF3C7'}; color: ${o.payment_status === 'paid' ? 'var(--pv-green)' : '#92400E'};">
                  ${o.payment_status.toUpperCase()}
                </span>
              </td>
              <td style="padding: 14px 0;">
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; background: var(--pv-surface-alt);">
                  ${o.fulfilment_status}
                </span>
              </td>
              <td style="padding: 14px 0; text-align: right;">
                <a href="/admin/orders/${o.id}" class="pv-btn pv-btn-outline pv-btn-sm">Inspect &rarr;</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  res.send(renderAdminLayout('Order Management', content, req));
});

// 3. Single Order Inspection & Manual Actions
router.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.redirect('/admin/orders');

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const transactions = db.prepare('SELECT * FROM payment_transactions WHERE order_id = ?').all(order.id);
  const auditLogs = db.prepare("SELECT * FROM audit_logs WHERE entity_type = 'orders' AND entity_id = ?").all(order.id.toString());

  const content = `
    <div style="margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <a href="/admin/orders" style="color: var(--pv-gold); font-size: 0.9rem;">&larr; Back to Orders</a>
        <h1 style="font-size: 1.8rem; margin-top: 5px;">Order #${order.order_number}</h1>
      </div>
      <div>
        <button onclick="window.print()" class="pv-btn pv-btn-outline pv-btn-sm">Print Invoice / Work Order</button>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 30px; align-items: flex-start;">
      <!-- Details & Items -->
      <div>
        <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px; margin-bottom: 25px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 15px; border-bottom: 1px solid var(--pv-border); padding-bottom: 10px;">Ordered Items</h3>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 20px;">
            <thead>
              <tr style="text-align: left; color: var(--pv-text-muted); border-bottom: 1px solid var(--pv-border);">
                <th style="padding-bottom: 8px;">Product</th>
                <th style="padding-bottom: 8px;">SKU</th>
                <th style="padding-bottom: 8px;">Price</th>
                <th style="padding-bottom: 8px;">Qty</th>
                <th style="padding-bottom: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(i => `
                <tr style="border-bottom: 1px solid var(--pv-border);">
                  <td style="padding: 10px 0; font-weight: 600;">${i.product_name}</td>
                  <td style="padding: 10px 0;">${i.sku}</td>
                  <td style="padding: 10px 0;">${formatNaira(i.unit_price_kobo)}</td>
                  <td style="padding: 10px 0;">${i.quantity}</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold;">${formatNaira(i.line_total_kobo)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="text-align: right; font-size: 0.95rem; line-height: 1.8;">
            <div>Subtotal: <strong>${formatNaira(order.subtotal_kobo)}</strong></div>
            <div>Delivery Fee: <strong>${formatNaira(order.shipping_fee_kobo)}</strong></div>
            <div style="font-size: 1.2rem; font-weight: bold; color: var(--pv-gold);">Total: ${formatNaira(order.total_kobo)}</div>
          </div>
        </div>

        <!-- Audit & Payment History -->
        <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 15px;">Transaction History &amp; Audit Log</h3>
          ${transactions.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
              ${transactions.map(t => `
                <div style="font-size: 0.85rem; padding: 10px; background: var(--pv-surface-alt); border-radius: 4px;">
                  <strong>Provider:</strong> ${t.provider.toUpperCase()} | <strong>Ref:</strong> ${t.reference} | <strong>Status:</strong> ${t.status} (${t.created_at})
                </div>
              `).join('')}
            </div>
          ` : `<p style="font-size: 0.85rem; color: var(--pv-text-muted);">No payment gateway transactions recorded yet.</p>`}

          ${auditLogs.length > 0 ? `
            <div style="font-size: 0.85rem; border-top: 1px solid var(--pv-border); padding-top: 15px;">
              <strong>Admin Modifications:</strong>
              ${auditLogs.map(l => `<div style="color: var(--pv-text-muted); margin-top: 4px;">• ${l.details} (${l.created_at})</div>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Fulfilment Actions & Customer Info -->
      <div>
        <!-- Customer & Shipping Summary -->
        <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px; margin-bottom: 25px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 15px;">Delivery &amp; Customer</h3>
          <div style="font-size: 0.9rem; line-height: 1.7;">
            <div><strong>Customer:</strong> ${order.customer_name}</div>
            <div><strong>Email:</strong> ${order.customer_email}</div>
            <div><strong>Phone:</strong> <a href="tel:${order.customer_phone}">${order.customer_phone}</a></div>
            <div style="margin-top: 10px;"><strong>Address:</strong><br>${order.shipping_address}, ${order.shipping_city}, ${order.shipping_state}</div>
            ${order.delivery_notes ? `<div style="margin-top: 8px; color: var(--pv-text-muted);"><strong>Instructions:</strong> ${order.delivery_notes}</div>` : ''}
          </div>
          <div style="margin-top: 15px;">
            <a href="https://wa.me/${order.customer_phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(order.customer_name)},%20this%20is%20Palletvoid%20regarding%20order%20${order.order_number}" target="_blank" rel="noopener noreferrer" class="pv-btn pv-btn-secondary pv-btn-sm" style="width: 100%;">
              Message Customer on WhatsApp
            </a>
          </div>
        </div>

        <!-- Management Actions -->
        <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 15px;">Operational Actions</h3>

          <!-- Confirm Manual Bank Transfer Form -->
          ${order.payment_status !== 'paid' ? `
            <form action="/admin/orders/${order.id}/verify-payment" method="POST" style="margin-bottom: 20px; padding: 15px; background: var(--pv-gold-light); border-radius: 6px;" onsubmit="return confirm('Verify that the bank transfer has been received in Palletvoid account before proceeding?');">
              <strong style="color: var(--pv-gold); font-size: 0.95rem; display: block; margin-bottom: 8px;">Authorized Bank Transfer Verification</strong>
              <div class="pv-form-group">
                <input type="text" name="transferReference" class="pv-input" placeholder="Bank Session ID / Narration" required>
              </div>
              <button type="submit" class="pv-btn pv-btn-primary pv-btn-sm" style="width: 100%;">
                ✔ Confirm &amp; Mark as Paid
              </button>
            </form>
          ` : `
            <div style="padding: 12px; background: var(--pv-green-light); color: var(--pv-green); border-radius: 6px; font-weight: bold; margin-bottom: 20px;">
              ✔ Verified &amp; Paid (Ref: ${order.payment_reference || 'Confirmed'})
            </div>
          `}

          <!-- Update Fulfilment Status -->
          <form action="/admin/orders/${order.id}/update-status" method="POST">
            <div class="pv-form-group">
              <label class="pv-form-label">Fulfilment Status</label>
              <select name="fulfilmentStatus" class="pv-select">
                <option value="pending" ${order.fulfilment_status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="confirmed" ${order.fulfilment_status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="processing" ${order.fulfilment_status === 'processing' ? 'selected' : ''}>Processing</option>
                <option value="made_to_order" ${order.fulfilment_status === 'made_to_order' ? 'selected' : ''}>In Carpentry Milling (Made to Order)</option>
                <option value="ready_for_dispatch" ${order.fulfilment_status === 'ready_for_dispatch' ? 'selected' : ''}>Ready for Dispatch</option>
                <option value="shipped" ${order.fulfilment_status === 'shipped' ? 'selected' : ''}>Shipped / Dispatched</option>
                <option value="delivered" ${order.fulfilment_status === 'delivered' ? 'selected' : ''}>Delivered</option>
                <option value="cancelled" ${order.fulfilment_status === 'cancelled' ? 'selected' : ''}>Cancelled (Restores Stock)</option>
              </select>
            </div>
            <button type="submit" class="pv-btn pv-btn-dark pv-btn-sm" style="width: 100%;">
              Update Fulfilment Status
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  res.send(renderAdminLayout(`Order ${order.order_number}`, content, req));
});

// Action: Verify Manual Bank Payment
router.post('/orders/:id/verify-payment', (req, res) => {
  const { transferReference } = req.body;
  try {
    markOrderAsPaid(parseInt(req.params.id, 10), transferReference || 'MANUAL_BANK_TRANSFER', 'bank_transfer', req.user.id);
    setFlash(res, 'success', 'Order payment verified and recorded in audit log.');
  } catch (err) {
    setFlash(res, 'error', err.message);
  }
  res.redirect(`/admin/orders/${req.params.id}`);
});

// Action: Update Fulfilment Status
router.post('/orders/:id/update-status', (req, res) => {
  const { fulfilmentStatus } = req.body;
  const orderId = parseInt(req.params.id, 10);

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Order not found');

    if (fulfilmentStatus === 'cancelled' && order.fulfilment_status !== 'cancelled') {
      // Safe restoration of stock following cancellation
      restoreInventory(orderId, 'order_cancellation_admin');
    }

    db.prepare('UPDATE orders SET fulfilment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(fulfilmentStatus, orderId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
      VALUES (?, 'UPDATE_ORDER_STATUS', 'orders', ?, ?)
    `).run(req.user.id, orderId.toString(), `Order status set to ${fulfilmentStatus}`);

    setFlash(res, 'success', `Order status updated to ${fulfilmentStatus}.`);
  } catch (err) {
    setFlash(res, 'error', err.message);
  }
  res.redirect(`/admin/orders/${orderId}`);
});

// 4. Product Catalog & Inventory Operations
// 4. Products & Inventory Management
router.get('/products', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    ORDER BY p.id DESC
  `).all();

  const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1').all();

  const content = `
    <div style="margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
      <div>
        <h1 style="font-size: 2rem; margin-bottom: 8px;">Product Catalog &amp; New Arrivals Control</h1>
        <p style="color: var(--pv-text-muted);">Manage product pricing, custom tags, inventory, and configure position among New Arrivals on the landing page.</p>
      </div>
      <div>
        <a href="#new-product-modal" onclick="document.getElementById('new-product-form').style.display='block'" class="pv-btn pv-btn-primary">
          + Add New Craft / Product
        </a>
      </div>
    </div>

    <!-- Create Product Form (Expandable) -->
    <div id="new-product-form" style="display: none; background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 30px; margin-bottom: 30px; box-shadow: var(--pv-shadow-md);">
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <h3 style="font-size: 1.3rem;">Create New Store Product</h3>
        <button type="button" onclick="document.getElementById('new-product-form').style.display='none'" style="background: none; border: none; font-size: 1.3rem; cursor: pointer;">&times;</button>
      </div>

      <form action="/admin/products/create" method="POST">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Product Name *</label>
            <input type="text" name="name" class="pv-input" required placeholder="e.g. Airport Lounge Rustic Pallet Sofa Set">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">SKU *</label>
            <input type="text" name="sku" class="pv-input" required placeholder="PV-SF-010">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Category *</label>
            <select name="category_id" class="pv-select" required>
              ${categories.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Price (Naira) *</label>
            <input type="number" step="any" name="price" class="pv-input" placeholder="e.g. 19999 (Leave 0 for Price on Request)">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem;">0 or blank = "Price on Request" via WhatsApp</small>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Sale Price (Naira)</label>
            <input type="number" step="any" name="sale_price" class="pv-input" placeholder="Optional discount price">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Stock Quantity</label>
            <input type="number" name="stock_quantity" class="pv-input" value="5">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Product Type</label>
            <select name="product_type" class="pv-select">
              <option value="furniture">Furniture &amp; Décor</option>
              <option value="industrial">Industrial Supply</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Product Tags (comma-separated)</label>
            <input type="text" name="tags" class="pv-input" placeholder="e.g. Airport Lounge, Reclaimed Pine, Bestseller, Eco Wood">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem;">Add custom badges that appear on product cards</small>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">New Arrival on Landing Page?</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_new_arrival" value="1" checked>
                <span>Feature in New Arrivals</span>
              </label>
            </div>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">New Arrival Position (Order)</label>
            <input type="number" name="new_arrival_order" class="pv-input" value="1" min="1" max="99" placeholder="1 = First, 2 = Second...">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem;">Determines position on landing page</small>
          </div>
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Primary Image URL or Local Path</label>
          <input type="text" name="primary_image" class="pv-input" placeholder="e.g. /hero.jpg or /images/products/plastic-pallet-main.webp or web URL">
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Short Summary</label>
          <input type="text" name="short_description" class="pv-input" placeholder="Brief tagline for product cards">
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Full Description</label>
          <textarea name="description" class="pv-textarea" rows="3" placeholder="Wood provenance, hardware, specifications, dimensions..."></textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Dimensions</label>
            <input type="text" name="dimensions" class="pv-input" placeholder="e.g. 240cm x 160cm x 65cm">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Material</label>
            <input type="text" name="material" class="pv-input" placeholder="Reclaimed Solid Pine">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Finish</label>
            <input type="text" name="finish" class="pv-input" placeholder="Warm Walnut Satin">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Made to Order?</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_made_to_order" value="1">
                <span>Made to order</span>
              </label>
            </div>
          </div>
        </div>

        <div style="margin-top: 15px;">
          <button type="submit" class="pv-btn pv-btn-primary">Save &amp; Publish Product</button>
        </div>
      </form>
    </div>

    <!-- Products Table -->
    <div style="background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); padding: 25px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
        <thead>
          <tr style="border-bottom: 2px solid var(--pv-border); text-align: left; color: var(--pv-text-muted);">
            <th style="padding-bottom: 12px; width: 60px;">Image</th>
            <th style="padding-bottom: 12px;">SKU &amp; Name</th>
            <th style="padding-bottom: 12px;">Category</th>
            <th style="padding-bottom: 12px;">Tags</th>
            <th style="padding-bottom: 12px;">Price (NGN)</th>
            <th style="padding-bottom: 12px;">Stock</th>
            <th style="padding-bottom: 12px;">New Arrival Position</th>
            <th style="padding-bottom: 12px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
            const isPOR = !p.price_kobo || p.price_kobo <= 100;
            const tagList = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
            return `
            <tr style="border-bottom: 1px solid var(--pv-border); vertical-align: middle;">
              <td style="padding: 12px 0;">
                <img src="${p.primary_image || '/images/products/plastic-pallet-main.webp'}" alt="${p.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--pv-border);" onerror="this.src='/hero.jpg'">
              </td>
              <td style="padding: 12px 10px;">
                <div style="font-family: monospace; font-size: 0.8rem; color: var(--pv-text-muted);">${p.sku}</div>
                <strong><a href="/product/${p.slug}" target="_blank" style="color: var(--pv-black); text-decoration: none;">${p.name}</a></strong>
                ${p.is_made_to_order ? `<span style="font-size: 0.72rem; color: var(--pv-green); display: block;">[Made to Order]</span>` : ''}
              </td>
              <td style="padding: 12px 10px; font-size: 0.88rem;">${p.category_name}</td>
              <td style="padding: 12px 10px;">
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${tagList.length > 0 ? tagList.map(t => `<span class="pv-tag-badge">${t}</span>`).join('') : '<span style="color:#AAA; font-size:0.75rem;">None</span>'}
                </div>
              </td>
              <td style="padding: 12px 10px; font-weight: bold; white-space: nowrap;">
                ${isPOR ? '<span style="color: var(--pv-green); font-size: 0.85rem;">Price on Request</span>' : formatNaira(p.sale_price_kobo || p.price_kobo)}
                ${p.sale_price_kobo ? `<div style="font-size: 0.75rem; text-decoration: line-through; color: #888;">${formatNaira(p.price_kobo)}</div>` : ''}
              </td>
              <td style="padding: 12px 10px;">
                <span style="font-weight: bold; color: ${p.stock_quantity <= 5 && !p.is_made_to_order ? 'var(--pv-danger)' : 'var(--pv-black)'};">
                  ${p.is_made_to_order ? '—' : p.stock_quantity}
                </span>
              </td>
              <td style="padding: 12px 10px;">
                <form action="/admin/products/${p.id}/quick-arrival" method="POST" style="display: flex; align-items: center; gap: 6px; margin: 0;">
                  <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; cursor: pointer;">
                    <input type="checkbox" name="is_new_arrival" value="1" ${p.is_new_arrival ? 'checked' : ''} onchange="this.form.submit()">
                    <span>Show</span>
                  </label>
                  <input type="number" name="new_arrival_order" value="${p.new_arrival_order || 0}" min="0" max="99" style="width: 55px; padding: 4px 6px; font-size: 0.8rem; border: 1px solid var(--pv-border); border-radius: 4px; text-align: center;" title="Position in New Arrivals (1=First, 2=Second...)">
                  <button type="submit" class="pv-btn pv-btn-outline pv-btn-sm" style="padding: 2px 7px; font-size: 0.75rem;">Set #</button>
                </form>
              </td>
              <td style="padding: 12px 0; text-align: right; white-space: nowrap;">
                <a href="/admin/products/${p.id}/edit" class="pv-btn pv-btn-primary pv-btn-sm" style="padding: 5px 12px; margin-right: 6px;">Edit &amp; Price</a>
                <form action="/admin/products/${p.id}/adjust-stock" method="POST" style="display: inline-flex; gap: 4px; align-items: center;">
                  <input type="number" name="newStock" value="${p.stock_quantity}" style="width: 55px; padding: 4px 6px; border: 1px solid var(--pv-border); border-radius: 4px; text-align: center; font-size: 0.8rem;">
                  <button type="submit" class="pv-btn pv-btn-outline pv-btn-sm" style="padding: 4px 8px; font-size: 0.75rem;">Qty</button>
                </form>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  res.send(renderAdminLayout('Product Catalog & New Arrivals', content, req));
});

// Edit Product Form (Dedicated Page for Admin & Manager)
router.get('/products/:id/edit', (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    setFlash(res, 'error', 'Product not found.');
    return res.redirect('/admin/products');
  }

  const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1').all();

  const priceNaira = product.price_kobo > 100 ? (product.price_kobo / 100) : '';
  const salePriceNaira = product.sale_price_kobo ? (product.sale_price_kobo / 100) : '';

  const content = `
    <div style="margin-bottom: 25px;">
      <a href="/admin/products" style="color: var(--pv-gold); text-decoration: none; font-weight: 600;">&larr; Back to Product Catalog</a>
      <h1 style="font-size: 2rem; margin-top: 10px;">Edit Product: ${product.name}</h1>
      <p style="color: var(--pv-text-muted);">Configure pricing, tags, landing page new arrival order, and specifications.</p>
    </div>

    <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 35px; box-shadow: var(--pv-shadow-sm);">
      <form action="/admin/products/${product.id}/edit" method="POST">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Product Name *</label>
            <input type="text" name="name" class="pv-input" required value="${product.name}">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">SKU *</label>
            <input type="text" name="sku" class="pv-input" required value="${product.sku}">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Category *</label>
            <select name="category_id" class="pv-select" required>
              ${categories.map(c => `<option value="${c.id}" ${c.id === product.category_id ? 'selected' : ''}>${c.name} (${c.type})</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Price (Naira) *</label>
            <input type="number" step="any" name="price" class="pv-input" value="${priceNaira}" placeholder="Leave 0 for Price on Request">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem;">Enter 0 or leave blank for "Price on Request"</small>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Sale Price (Naira)</label>
            <input type="number" step="any" name="sale_price" class="pv-input" value="${salePriceNaira}" placeholder="Optional discounted price">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Stock Quantity</label>
            <input type="number" name="stock_quantity" class="pv-input" value="${product.stock_quantity}">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Product Type</label>
            <select name="product_type" class="pv-select">
              <option value="furniture" ${product.product_type === 'furniture' ? 'selected' : ''}>Furniture &amp; Décor</option>
              <option value="industrial" ${product.product_type === 'industrial' ? 'selected' : ''}>Industrial Supply</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; background: #F8F6F0; padding: 20px; border-radius: var(--pv-radius); margin-bottom: 20px; border: 1px solid var(--pv-border);">
          <div class="pv-form-group">
            <label class="pv-form-label">Product Tags (comma-separated badges)</label>
            <input type="text" name="tags" class="pv-input" value="${product.tags || ''}" placeholder="e.g. Airport Lounge, Handcrafted Pine, Bestseller">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem;">Tags appear as badges on the storefront and product cards</small>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Appear Among New Arrivals?</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_new_arrival" value="1" ${product.is_new_arrival ? 'checked' : ''}>
                <strong>Show in New Arrivals</strong>
              </label>
            </div>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">New Arrival Position (Order)</label>
            <input type="number" name="new_arrival_order" class="pv-input" value="${product.new_arrival_order || 0}" min="0" max="99">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem;">1 = 1st place on landing page, 2 = 2nd, etc.</small>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; align-items: flex-start;">
          <div class="pv-form-group">
            <label class="pv-form-label">Primary Image URL or Local Path</label>
            <input type="text" name="primary_image" id="product_primary_image_input" class="pv-input" value="${product.primary_image || ''}" placeholder="e.g. /hero.jpg or image URL" oninput="updateProductPreview(this.value)">
            <div style="margin-top: 10px; display: flex; align-items: center; gap: 12px;">
              <div id="product_preview_wrap" style="width: 70px; height: 70px; border-radius: 4px; overflow: hidden; border: 1px solid var(--pv-border); background: #FAFAFA; display: flex; align-items: center; justify-content: center;">
                <img id="product_preview_img" src="${product.primary_image || '/images/products/plastic-pallet-main.webp'}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/hero.jpg'">
              </div>
              <small style="color: var(--pv-text-muted); font-size: 0.78rem;">Live preview of product display image</small>
            </div>
            <script>
              function updateProductPreview(url) {
                var img = document.getElementById('product_preview_img');
                if (img) img.src = url.trim() || '/hero.jpg';
              }
            </script>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Featured on Homepage?</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_featured" value="1" ${product.is_featured ? 'checked' : ''}>
                <span>Show in Best Sellers</span>
              </label>
            </div>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Active Status</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_active" value="1" ${product.is_active ? 'checked' : ''}>
                <span>Published (Active)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Short Summary</label>
          <input type="text" name="short_description" class="pv-input" value="${product.short_description || ''}">
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Full Description</label>
          <textarea name="description" class="pv-textarea" rows="4">${product.description || ''}</textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Dimensions</label>
            <input type="text" name="dimensions" class="pv-input" value="${product.dimensions || ''}">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Material</label>
            <input type="text" name="material" class="pv-input" value="${product.material || ''}">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Finish</label>
            <input type="text" name="finish" class="pv-input" value="${product.finish || ''}">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Made to Order?</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_made_to_order" value="1" ${product.is_made_to_order ? 'checked' : ''}>
                <span>Made to order</span>
              </label>
            </div>
          </div>
        </div>

        <div style="margin-top: 25px; display: flex; gap: 15px;">
          <button type="submit" class="pv-btn pv-btn-primary">Save Changes &amp; Update Storefront</button>
          <a href="/admin/products" class="pv-btn pv-btn-outline">Cancel</a>
        </div>
      </form>
    </div>
  `;

  res.send(renderAdminLayout(`Edit ${product.name}`, content, req));
});

// Action: Edit Product (POST)
router.post('/products/:id/edit', (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const {
    name, sku, category_id, price, sale_price, stock_quantity, product_type,
    tags, is_new_arrival, new_arrival_order, is_featured, is_active,
    primary_image, short_description, description, dimensions, material, finish,
    is_made_to_order
  } = req.body;

  try {
    const rawPrice = parseFloat(price);
    const priceKobo = isNaN(rawPrice) || rawPrice <= 0 ? 100 : Math.round(rawPrice * 100);
    const salePriceKobo = sale_price && parseFloat(sale_price) > 0 ? Math.round(parseFloat(sale_price) * 100) : null;
    const isNewArrival = is_new_arrival === '1' ? 1 : 0;
    const arrivalOrder = parseInt(new_arrival_order, 10) || 0;
    const isFeatured = is_featured === '1' ? 1 : 0;
    const isActive = is_active === '1' ? 1 : 0;
    const isMadeToOrder = is_made_to_order === '1' ? 1 : 0;
    const stockQty = parseInt(stock_quantity, 10) || 0;

    db.prepare(`
      UPDATE products SET
        name = ?,
        sku = ?,
        category_id = ?,
        product_type = ?,
        price_kobo = ?,
        sale_price_kobo = ?,
        stock_quantity = ?,
        is_made_to_order = ?,
        tags = ?,
        is_new_arrival = ?,
        new_arrival_order = ?,
        is_featured = ?,
        is_active = ?,
        primary_image = ?,
        short_description = ?,
        description = ?,
        dimensions = ?,
        material = ?,
        finish = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name.trim(), sku.trim(), parseInt(category_id, 10), product_type || 'furniture',
      priceKobo, salePriceKobo, stockQty, isMadeToOrder,
      tags ? tags.trim() : null, isNewArrival, arrivalOrder, isFeatured, isActive,
      primary_image ? primary_image.trim() : null,
      short_description || '', description || '', dimensions || '', material || '', finish || '',
      productId
    );

    setFlash(res, 'success', `Product "${name}" updated successfully.`);
  } catch (err) {
    setFlash(res, 'error', `Failed to update product: ${err.message}`);
  }

  res.redirect('/admin/products');
});

// Action: Quick Toggle/Reorder New Arrival
router.post('/products/:id/quick-arrival', (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { is_new_arrival, new_arrival_order } = req.body;
  const isNewArrival = is_new_arrival === '1' ? 1 : 0;
  const arrivalOrder = parseInt(new_arrival_order, 10) || 0;

  try {
    db.prepare(`
      UPDATE products 
      SET is_new_arrival = ?, new_arrival_order = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(isNewArrival, arrivalOrder, productId);

    setFlash(res, 'success', 'Landing page New Arrival setting updated.');
  } catch (err) {
    setFlash(res, 'error', err.message);
  }

  res.redirect('/admin/products');
});

// Action: Create Product
router.post('/products/create', (req, res) => {
  const {
    name, sku, category_id, price, sale_price, stock_quantity, product_type,
    tags, is_new_arrival, new_arrival_order, primary_image,
    short_description, description, dimensions, material, finish, is_made_to_order
  } = req.body;

  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const rawPrice = parseFloat(price);
    const priceKobo = isNaN(rawPrice) || rawPrice <= 0 ? 100 : Math.round(rawPrice * 100);
    const salePriceKobo = sale_price && parseFloat(sale_price) > 0 ? Math.round(parseFloat(sale_price) * 100) : null;
    const isNewArrival = is_new_arrival === '1' ? 1 : 0;
    const arrivalOrder = parseInt(new_arrival_order, 10) || 0;
    const isMadeToOrder = is_made_to_order === '1' ? 1 : 0;

    db.prepare(`
      INSERT INTO products (
        sku, name, slug, category_id, product_type, short_description, description,
        price_kobo, sale_price_kobo, stock_quantity, is_made_to_order,
        tags, is_new_arrival, new_arrival_order, primary_image,
        dimensions, material, finish, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      sku.trim(), name.trim(), slug, parseInt(category_id, 10), product_type || 'furniture',
      short_description || '', description || '', priceKobo, salePriceKobo,
      parseInt(stock_quantity, 10) || 0, isMadeToOrder,
      tags ? tags.trim() : null, isNewArrival, arrivalOrder, primary_image ? primary_image.trim() : null,
      dimensions || '', material || '', finish || ''
    );

    setFlash(res, 'success', `Product "${name}" created successfully.`);
  } catch (err) {
    setFlash(res, 'error', err.message);
  }
  res.redirect('/admin/products');
});

// Action: Adjust Product Stock
router.post('/products/:id/adjust-stock', (req, res) => {
  const { newStock } = req.body;
  const productId = parseInt(req.params.id, 10);
  const qty = parseInt(newStock, 10);

  try {
    const prod = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(productId);
    if (!prod) throw new Error('Product not found');

    const change = qty - prod.stock_quantity;
    db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(qty, productId);

    // Record Movement Audit
    db.prepare(`
      INSERT INTO inventory_movements (product_id, change_quantity, new_quantity, reason, actor_id)
      VALUES (?, ?, ?, 'manual_adjustment', ?)
    `).run(productId, change, qty, req.user.id);

    setFlash(res, 'success', 'Inventory adjusted successfully.');
  } catch (err) {
    setFlash(res, 'error', err.message);
  }
  res.redirect('/admin/products');
});

// 5. Category Management & Editing (Admin & Store Manager)
router.get('/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.type ASC, c.sort_order ASC, c.name ASC
  `).all();

  const content = `
    <div style="margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
      <div>
        <h1 style="font-size: 2rem; margin-bottom: 8px;">Product Category Management</h1>
        <p style="color: var(--pv-text-muted);">Configure product categories, cover images, display order, and storefront visibility.</p>
      </div>
      <div>
        <a href="#new-category-box" class="pv-btn pv-btn-primary pv-btn-sm">+ Add New Category</a>
      </div>
    </div>

    <!-- Create New Category Card -->
    <div id="new-category-box" style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 30px; margin-bottom: 35px; box-shadow: var(--pv-shadow-sm);">
      <h3 style="font-size: 1.25rem; margin-bottom: 8px; color: var(--pv-black);">+ Create New Category</h3>
      <p style="font-size: 0.88rem; color: var(--pv-text-muted); margin-bottom: 20px;">Add a new category for furniture crafts or industrial logistics supplies.</p>

      <form action="/admin/categories/create" method="POST">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Category Name *</label>
            <input type="text" name="name" class="pv-input" placeholder="e.g. Conference Tables, Agro Crates" required>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Type *</label>
            <select name="type" class="pv-select" required>
              <option value="furniture">Furniture &amp; Décor</option>
              <option value="industrial">Industrial Supply</option>
            </select>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Sort Order</label>
            <input type="number" name="sort_order" class="pv-input" value="0" min="0" max="99">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Cover Image URL or Local Path</label>
            <input type="text" name="image_url" class="pv-input" placeholder="e.g. /hero.jpg or https://... image URL">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem;">Shown on homepage Curated Collections and category landing pages</small>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Visibility</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_active" value="1" checked>
                <span>Active (Visible on Storefront)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Category Description</label>
          <textarea name="description" class="pv-textarea" rows="2" placeholder="Brief summary of crafts or pallets in this category..."></textarea>
        </div>

        <div>
          <button type="submit" class="pv-btn pv-btn-primary">Save &amp; Publish Category</button>
        </div>
      </form>
    </div>

    <!-- Categories List Table -->
    <div style="background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); padding: 25px; overflow-x: auto;">
      <h3 style="font-size: 1.2rem; margin-bottom: 18px; color: var(--pv-black);">All Store Categories (${categories.length})</h3>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.92rem;">
        <thead>
          <tr style="border-bottom: 2px solid var(--pv-border); text-align: left; color: var(--pv-text-muted);">
            <th style="padding-bottom: 12px; width: 80px;">Cover Image</th>
            <th style="padding-bottom: 12px;">Category Name &amp; Slug</th>
            <th style="padding-bottom: 12px;">Type</th>
            <th style="padding-bottom: 12px;">Description</th>
            <th style="padding-bottom: 12px; text-align: center;">Order</th>
            <th style="padding-bottom: 12px; text-align: center;">Products</th>
            <th style="padding-bottom: 12px; text-align: center;">Status</th>
            <th style="padding-bottom: 12px; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map(c => `
            <tr style="border-bottom: 1px solid var(--pv-border); vertical-align: middle;">
              <td style="padding: 14px 8px 14px 0;">
                ${c.image_url ? `
                  <img src="${c.image_url}" alt="${c.name}" style="width: 65px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--pv-border);" onerror="this.outerHTML='<div style=\\'width:65px;height:50px;background:#EFECE6;display:flex;align-items:center;justify-content:center;font-size:1.3rem;border-radius:4px;\\'>🪵</div>'">
                ` : `
                  <div style="width: 65px; height: 50px; background: #EFECE6; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; border-radius: 4px;">🪵</div>
                `}
              </td>
              <td style="padding: 14px 10px;">
                <strong style="font-size: 1rem; color: var(--pv-black); display: block;">${c.name}</strong>
                <a href="/category/${c.slug}" target="_blank" style="font-size: 0.8rem; color: var(--pv-gold); text-decoration: none;">/category/${c.slug} &nearr;</a>
              </td>
              <td style="padding: 14px 10px;">
                <span style="font-size: 0.8rem; padding: 3px 8px; border-radius: 4px; font-weight: 600; background: ${c.type === 'furniture' ? 'var(--pv-gold-light)' : 'var(--pv-green-light)'}; color: ${c.type === 'furniture' ? 'var(--pv-gold)' : 'var(--pv-green)'};">
                  ${c.type === 'furniture' ? 'Furniture &amp; Décor' : 'Industrial Supply'}
                </span>
              </td>
              <td style="padding: 14px 10px; color: var(--pv-text-muted); font-size: 0.85rem; max-width: 280px;">
                ${c.description || '<span style="color:#CCC;">No description</span>'}
              </td>
              <td style="padding: 14px 10px; text-align: center; font-weight: bold;">
                ${c.sort_order}
              </td>
              <td style="padding: 14px 10px; text-align: center;">
                <span style="background: var(--pv-surface-alt); padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 0.82rem;">
                  ${c.product_count} item${c.product_count === 1 ? '' : 's'}
                </span>
              </td>
              <td style="padding: 14px 10px; text-align: center;">
                <span style="font-size: 0.8rem; font-weight: bold; color: ${c.is_active ? 'var(--pv-green)' : 'var(--pv-danger)'};">
                  ${c.is_active ? '✔ Active' : '✖ Inactive'}
                </span>
              </td>
              <td style="padding: 14px 0; text-align: right; white-space: nowrap;">
                <a href="/admin/categories/${c.id}/edit" class="pv-btn pv-btn-primary pv-btn-sm" style="padding: 6px 14px;">Edit &amp; Image</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  res.send(renderAdminLayout('Category Management', content, req));
});

// Action: Create Category (POST)
router.post('/categories/create', (req, res) => {
  const { name, type, sort_order, image_url, is_active, description } = req.body;

  try {
    if (!name || !name.trim()) throw new Error('Category name is required.');

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const isActive = is_active === '1' ? 1 : 0;
    const sortOrder = parseInt(sort_order, 10) || 0;

    db.prepare(`
      INSERT INTO categories (name, slug, type, description, image_url, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      slug,
      type || 'furniture',
      description ? description.trim() : null,
      image_url ? image_url.trim() : null,
      sortOrder,
      isActive
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
      VALUES (?, 'CREATE_CATEGORY', 'categories', ?, ?)
    `).run(req.user.id, slug, `Created category "${name}"`);

    setFlash(res, 'success', `Category "${name}" created successfully.`);
  } catch (err) {
    setFlash(res, 'error', `Failed to create category: ${err.message}`);
  }

  res.redirect('/admin/categories');
});

// Edit Category Page (Dedicated Form for Admin & Store Manager)
router.get('/categories/:id/edit', (req, res) => {
  const categoryId = parseInt(req.params.id, 10);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) {
    setFlash(res, 'error', 'Category not found.');
    return res.redirect('/admin/categories');
  }

  const content = `
    <div style="margin-bottom: 25px;">
      <a href="/admin/categories" style="color: var(--pv-gold); text-decoration: none; font-weight: 600;">&larr; Back to Categories</a>
      <h1 style="font-size: 2rem; margin-top: 10px;">Edit Category: ${category.name}</h1>
      <p style="color: var(--pv-text-muted);">Update category title, slug, cover image, sorting order, and storefront visibility.</p>
    </div>

    <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 35px; box-shadow: var(--pv-shadow-sm); max-width: 900px;">
      <form action="/admin/categories/${category.id}/edit" method="POST">
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Category Name *</label>
            <input type="text" name="name" class="pv-input" value="${category.name}" required>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">URL Slug *</label>
            <input type="text" name="slug" class="pv-input" value="${category.slug}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Category Group / Type *</label>
            <select name="type" class="pv-select" required>
              <option value="furniture" ${category.type === 'furniture' ? 'selected' : ''}>Furniture &amp; Décor</option>
              <option value="industrial" ${category.type === 'industrial' ? 'selected' : ''}>Industrial Supply</option>
            </select>
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Display Sort Order</label>
            <input type="number" name="sort_order" class="pv-input" value="${category.sort_order}" min="0" max="99">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Visibility Status</label>
            <div style="padding-top: 8px;">
              <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="is_active" value="1" ${category.is_active ? 'checked' : ''}>
                <strong>Published (Visible on Store)</strong>
              </label>
            </div>
          </div>
        </div>

        <!-- Cover Image with Live Preview -->
        <div style="background: #F8F6F0; padding: 22px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); margin-bottom: 22px;">
          <div class="pv-form-group" style="margin-bottom: 12px;">
            <label class="pv-form-label">Category Cover Image URL or Local Path</label>
            <input type="text" name="image_url" id="category_image_input" class="pv-input" value="${category.image_url || ''}" placeholder="e.g. /images/products/plastic-pallet-main.webp or https://..." oninput="updateCategoryPreview(this.value)">
            <small style="color: var(--pv-text-muted); font-size: 0.78rem; display: block; margin-top: 4px;">
              Supports local paths (e.g., <code>/hero.jpg</code>, <code>/images/products/...</code>) or external image URLs.
            </small>
          </div>

          <div style="margin-top: 15px; display: flex; align-items: center; gap: 18px;">
            <div id="category_preview_wrap" style="width: 120px; height: 90px; border-radius: 6px; overflow: hidden; border: 2px solid var(--pv-border); background: #FFFFFF; display: flex; align-items: center; justify-content: center;">
              ${category.image_url ? `
                <img id="category_preview_img" src="${category.image_url}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; document.getElementById('category_preview_fallback').style.display='flex';">
                <div id="category_preview_fallback" style="display: none; font-size: 1.5rem;">🪵</div>
              ` : `
                <div id="category_preview_fallback" style="font-size: 1.5rem;">🪵</div>
              `}
            </div>
            <div style="font-size: 0.85rem; color: var(--pv-text-muted);">
              <strong>Live Cover Preview:</strong>
              <div>This image appears in the "Shop by Category" card and header banners across Palletvoid.</div>
            </div>
          </div>
        </div>

        <script>
          function updateCategoryPreview(url) {
            var wrap = document.getElementById('category_preview_wrap');
            if (!url || !url.trim()) {
              wrap.innerHTML = '<div style="font-size: 1.5rem;">🪵</div>';
              return;
            }
            wrap.innerHTML = '<img src="' + url.trim() + '" alt="Preview" style="width:100%;height:100%;object-fit:cover;" onerror="this.outerHTML=\\'<div style=\\"font-size:1.5rem;\\">🪵</div>\\'">';
          }
        </script>

        <div class="pv-form-group">
          <label class="pv-form-label">Full Description</label>
          <textarea name="description" class="pv-textarea" rows="3">${category.description || ''}</textarea>
        </div>

        <div style="margin-top: 25px; display: flex; gap: 15px;">
          <button type="submit" class="pv-btn pv-btn-primary">Save Category Changes</button>
          <a href="/admin/categories" class="pv-btn pv-btn-outline">Cancel</a>
        </div>
      </form>
    </div>
  `;

  res.send(renderAdminLayout(`Edit ${category.name}`, content, req));
});

// Action: Edit Category (POST)
router.post('/categories/:id/edit', (req, res) => {
  const categoryId = parseInt(req.params.id, 10);
  const { name, slug, type, sort_order, image_url, is_active, description } = req.body;

  try {
    if (!name || !name.trim()) throw new Error('Category name is required.');

    const cleanSlug = (slug && slug.trim()) 
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const isActive = is_active === '1' ? 1 : 0;
    const sortOrder = parseInt(sort_order, 10) || 0;

    db.prepare(`
      UPDATE categories SET
        name = ?,
        slug = ?,
        type = ?,
        description = ?,
        image_url = ?,
        sort_order = ?,
        is_active = ?
      WHERE id = ?
    `).run(
      name.trim(),
      cleanSlug,
      type || 'furniture',
      description ? description.trim() : null,
      image_url ? image_url.trim() : null,
      sortOrder,
      isActive,
      categoryId
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
      VALUES (?, 'UPDATE_CATEGORY', 'categories', ?, ?)
    `).run(req.user.id, categoryId.toString(), `Updated category "${name}" (slug: ${cleanSlug})`);

    setFlash(res, 'success', `Category "${name}" updated successfully.`);
  } catch (err) {
    setFlash(res, 'error', `Failed to update category: ${err.message}`);
  }

  res.redirect('/admin/categories');
});

// 6. Custom Enquiries Management
router.get('/enquiries', (req, res) => {
  const enquiries = db.prepare('SELECT * FROM custom_enquiries ORDER BY id DESC').all();

  const content = `
    <div style="margin-bottom: 30px;">
      <h1 style="font-size: 2rem; margin-bottom: 8px;">Bespoke &amp; Custom Furniture Requests</h1>
      <p style="color: var(--pv-text-muted);">Incoming bespoke commissions and customer dimension specifications.</p>
    </div>

    <div style="background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); padding: 25px;">
      ${enquiries.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 20px;">
          ${enquiries.map(e => `
            <div style="padding: 20px; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); background: var(--pv-surface-alt);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <div>
                  <strong style="font-size: 1.1rem;">${e.name}</strong> (${e.email} | ${e.phone})
                  <div style="font-size: 0.85rem; color: var(--pv-text-muted);">${new Date(e.created_at).toLocaleString('en-NG')}</div>
                </div>
                <div>
                  <span style="padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; background: var(--pv-gold-light); color: var(--pv-gold);">
                    ${e.project_type}
                  </span>
                </div>
              </div>

              <div style="font-size: 0.9rem; line-height: 1.6; margin-bottom: 12px; background: #FFFFFF; padding: 12px; border-radius: 4px;">
                <div><strong>Dimensions:</strong> ${e.dimensions || 'None provided'} | <strong>Finish:</strong> ${e.wood_finish || 'Default'} | <strong>Budget:</strong> ${e.budget_range || 'Open'}</div>
                <div style="margin-top: 6px;"><strong>Description:</strong> ${e.description}</div>
              </div>

              <div>
                <a href="https://wa.me/${e.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(e.name)},%20this%20is%20Palletvoid%20carpentry%20workshop%20regarding%20your%20custom%20enquiry" target="_blank" rel="noopener noreferrer" class="pv-btn pv-btn-secondary pv-btn-sm">
                  Reply on WhatsApp
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `<p style="color: var(--pv-text-muted);">No custom enquiries received yet.</p>`}
    </div>
  `;

  res.send(renderAdminLayout('Custom Enquiries', content, req));
});

// 6. Operational Store Settings
router.get('/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM store_settings').all();
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  const content = `
    <div style="margin-bottom: 30px;">
      <h1 style="font-size: 2rem; margin-bottom: 8px;">Store &amp; Payment Configuration</h1>
      <p style="color: var(--pv-text-muted);">Adjust notification banners, bank transfer instructions, and POD thresholds.</p>
    </div>

    <div style="background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); padding: 35px; max-width: 800px;">
      <form action="/admin/settings" method="POST">
        <h3 style="font-size: 1.2rem; margin-bottom: 15px; border-bottom: 1px solid var(--pv-border); padding-bottom: 8px;">Announcement Banner</h3>
        
        <div class="pv-form-group">
          <label class="pv-form-label">Banner Message</label>
          <input type="text" name="announcement_bar_text" class="pv-input" value="${settingsMap.announcement_bar_text || ''}">
        </div>

        <div class="pv-form-group">
          <label style="display: flex; gap: 10px; align-items: center; cursor: pointer;">
            <input type="checkbox" name="announcement_bar_enabled" value="1" ${settingsMap.announcement_bar_enabled === '1' ? 'checked' : ''}>
            <span>Show Announcement Banner at Top of Store</span>
          </label>
        </div>

        <h3 style="font-size: 1.2rem; margin: 30px 0 15px; border-bottom: 1px solid var(--pv-border); padding-bottom: 8px;">Official Bank Transfer Beneficiary</h3>
        <p style="font-size: 0.85rem; color: var(--pv-text-muted); margin-bottom: 15px;">Configure the verified bank details displayed to customers during checkout.</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="pv-form-group">
            <label class="pv-form-label">Bank Name</label>
            <input type="text" name="bank_name" class="pv-input" value="${settingsMap.bank_name || 'UBA Bank'}">
          </div>
          <div class="pv-form-group">
            <label class="pv-form-label">Account Number</label>
            <input type="text" name="bank_account_number" class="pv-input" value="${settingsMap.bank_account_number || '1025214241'}">
          </div>
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Account Beneficiary Name</label>
          <input type="text" name="bank_account_name" class="pv-input" value="${settingsMap.bank_account_name || 'Palletvoid Global Resources'}">
        </div>

        <h3 style="font-size: 1.2rem; margin: 30px 0 15px; border-bottom: 1px solid var(--pv-border); padding-bottom: 8px;">Payment on Delivery (POD) Threshold</h3>
        <div class="pv-form-group">
          <label class="pv-form-label">Max Order Total for POD (in Kobo, e.g. 10000000 = &#8358;100,000)</label>
          <input type="number" name="pod_max_amount_kobo" class="pv-input" value="${settingsMap.pod_max_amount_kobo || '10000000'}">
        </div>

        <h3 style="font-size: 1.2rem; margin: 30px 0 15px; border-bottom: 1px solid var(--pv-border); padding-bottom: 8px;">
          <span style="color: var(--pv-green);">&#9679;</span> Google Reviews Integration (Real-Time)
        </h3>
        <p style="font-size: 0.85rem; color: var(--pv-text-muted); margin-bottom: 15px;">
          Connect your Google Business Profile to display real-time customer reviews on the landing page. 
          You need a <strong>Google Places API key</strong> and your <strong>Place ID</strong>.
        </p>

        <div class="pv-form-group">
          <label class="pv-form-label">Google Places API Key</label>
          <input type="text" name="google_places_api_key" class="pv-input" value="${settingsMap.google_places_api_key || ''}" placeholder="AIzaSy...">
          <small style="color: var(--pv-text-muted); font-size: 0.78rem; display: block; margin-top: 4px;">
            Get from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" style="color: var(--pv-gold);">Google Cloud Console</a> &rarr; Enable "Places API (New)" &rarr; Create API Key.
          </small>
        </div>

        <div class="pv-form-group">
          <label class="pv-form-label">Google Place ID</label>
          <input type="text" name="google_place_id" class="pv-input" value="${settingsMap.google_place_id || ''}" placeholder="ChIJ... or places/ChIJ...">
          <small style="color: var(--pv-text-muted); font-size: 0.78rem; display: block; margin-top: 4px;">
            Find your Place ID using the <a href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder" target="_blank" rel="noopener" style="color: var(--pv-gold);">Place ID Finder</a>. 
            Search for "Palletvoid Lagos" and copy the Place ID.
          </small>
        </div>

        <div style="background: var(--pv-surface-alt); padding: 15px 18px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); margin-bottom: 15px;">
          <strong style="font-size: 0.88rem; display: block; margin-bottom: 6px;">How it works:</strong>
          <ul style="font-size: 0.82rem; color: var(--pv-text-muted); line-height: 1.7; padding-left: 18px; margin: 0;">
            <li>Reviews are fetched live from Google Places API and cached for 1 hour.</li>
            <li>Up to 5 most recent reviews display on the homepage automatically.</li>
            <li>When a new Google review is posted, it appears on your site within 1 hour.</li>
            <li>If the API is unavailable, the last cached reviews are shown as fallback.</li>
          </ul>
        </div>

        <button type="submit" class="pv-btn pv-btn-primary" style="margin-top: 20px;">Save Configuration</button>
      </form>
    </div>
  `;

  res.send(renderAdminLayout('Store Settings', content, req));
});

router.post('/settings', (req, res) => {
  const updates = req.body;
  const updateSetting = db.prepare('INSERT INTO store_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  for (const [key, value] of Object.entries(updates)) {
    updateSetting.run(key, value.toString());
  }

  // Handle unchecked boolean checkboxes
  if (!updates.announcement_bar_enabled) {
    updateSetting.run('announcement_bar_enabled', '0');
  }

  setFlash(res, 'success', 'Store settings updated successfully.');
  res.redirect('/admin/settings');
});

// 7. Security & Password Management (Admin & Store Manager)
router.get('/security', (req, res) => {
  // Query staff accounts and recent security audits
  const staffUsers = db.prepare(`
    SELECT id, email, full_name, role, is_active, updated_at, created_at 
    FROM users 
    ORDER BY CASE WHEN role = 'superadmin' THEN 1 WHEN role = 'store_manager' THEN 2 ELSE 3 END ASC, id ASC
  `).all();

  const securityAudits = db.prepare(`
    SELECT a.*, u.full_name as actor_name, u.email as actor_email
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_id = u.id
    WHERE a.action IN ('CHANGE_PASSWORD', 'ADMIN_RESET_PASSWORD', 'LOGIN', 'LOGOUT')
    ORDER BY a.id DESC 
    LIMIT 8
  `).all();

  const isSuperadminOrManager = ['superadmin', 'store_manager'].includes(req.user.role);

  const content = `
    <div style="margin-bottom: 30px;">
      <h1 style="font-size: 2rem; margin-bottom: 8px;">Security &amp; Password Management</h1>
      <p style="color: var(--pv-text-muted);">Update your administrative credentials as often as desired. No limits, cooldowns, or expiration restrictions.</p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: flex-start;">
      <!-- Card 1: Change Personal Password -->
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 32px; box-shadow: var(--pv-shadow-sm);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: var(--pv-gold-light); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: var(--pv-gold);">
            🔒
          </div>
          <div>
            <h3 style="font-size: 1.25rem; margin: 0; color: var(--pv-black);">Change Your Password</h3>
            <span style="font-size: 0.82rem; color: var(--pv-text-muted);">Logged in as <strong>${req.user.full_name}</strong> (${req.user.role})</span>
          </div>
        </div>

        <p style="font-size: 0.88rem; color: var(--pv-text-muted); margin-bottom: 22px; line-height: 1.6;">
          You can change your password as many times as you want. Passwords must be at least 8 characters in length.
        </p>

        <form action="/admin/security/change-password" method="POST">
          <div class="pv-form-group">
            <label class="pv-form-label">Current Password *</label>
            <input type="password" name="currentPassword" class="pv-input" placeholder="Enter your current password" required autocomplete="current-password">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">New Password (min 8 characters) *</label>
            <input type="password" name="newPassword" class="pv-input" placeholder="Enter new strong password" required minlength="8" autocomplete="new-password">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Confirm New Password *</label>
            <input type="password" name="confirmPassword" class="pv-input" placeholder="Re-type new password" required minlength="8" autocomplete="new-password">
          </div>

          <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; padding: 13px;">
            Update My Password
          </button>
        </form>
      </div>

      <!-- Card 2: Staff & User Credential Management (Admin & Manager) -->
      <div>
        ${isSuperadminOrManager ? `
        <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 32px; box-shadow: var(--pv-shadow-sm); margin-bottom: 30px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 42px; height: 42px; border-radius: 50%; background: var(--pv-green-light); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: var(--pv-green);">
              🛡️
            </div>
            <div>
              <h3 style="font-size: 1.25rem; margin: 0; color: var(--pv-black);">Manage Account Passwords</h3>
              <span style="font-size: 0.82rem; color: var(--pv-green); font-weight: 600;">Authorized Role: ${req.user.role.toUpperCase()}</span>
            </div>
          </div>

          <p style="font-size: 0.88rem; color: var(--pv-text-muted); margin-bottom: 20px; line-height: 1.6;">
            Admins and managers can reset or set fresh passwords for any staff or customer account directly.
          </p>

          <form action="/admin/security/reset-user-password" method="POST" onsubmit="return confirm('Set a new password for the selected account?');">
            <div class="pv-form-group">
              <label class="pv-form-label">Select Target Account *</label>
              <select name="targetUserId" class="pv-select" required>
                ${staffUsers.map(u => `
                  <option value="${u.id}">
                    ${u.full_name} (${u.email}) — [${u.role.toUpperCase()}]
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="pv-form-group">
              <label class="pv-form-label">Set New Password *</label>
              <input type="password" name="newPassword" class="pv-input" placeholder="New password (min 8 characters)" required minlength="8">
            </div>

            <div class="pv-form-group">
              <label class="pv-form-label">Confirm New Password *</label>
              <input type="password" name="confirmPassword" class="pv-input" placeholder="Confirm new password" required minlength="8">
            </div>

            <button type="submit" class="pv-btn pv-btn-dark" style="width: 100%; padding: 13px;">
              Set User Password
            </button>
          </form>
        </div>
        ` : ''}

        <!-- Security & Audit Trail -->
        <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 15px; color: var(--pv-black);">Security Audit Log</h3>
          ${securityAudits.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
              ${securityAudits.map(a => `
                <div style="padding: 10px 14px; background: var(--pv-surface-alt); border-radius: 6px; border-left: 3px solid var(--pv-gold);">
                  <div><strong>${a.action}</strong> &middot; <span style="color: var(--pv-text-muted);">${new Date(a.created_at).toLocaleString('en-NG')}</span></div>
                  <div style="color: var(--pv-text); margin-top: 2px;">${a.details || ''}</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="font-size: 0.85rem; color: var(--pv-text-muted);">No security modifications logged yet.</p>
          `}
        </div>
      </div>
    </div>
  `;

  res.send(renderAdminLayout('Security & Password', content, req));
});

// Action: Self Password Change
router.post('/security/change-password', (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  try {
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error('All password fields are required.');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('New password and confirmation do not match.');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters in length.');
    }

    // Fetch user with password hash
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw new Error('User not found.');

    // Verify current password
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      throw new Error('Current password is incorrect.');
    }

    // Hash and update
    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
      VALUES (?, 'CHANGE_PASSWORD', 'users', ?, ?)
    `).run(user.id, user.id.toString(), `User ${user.email} changed password`);

    setFlash(res, 'success', 'Your password has been changed successfully. You can update it again anytime.');
  } catch (err) {
    setFlash(res, 'error', err.message);
  }

  res.redirect('/admin/security');
});

// Action: Admin / Manager Reset User Password
router.post('/security/reset-user-password', (req, res) => {
  const { targetUserId, newPassword, confirmPassword } = req.body;

  try {
    const isSuperadminOrManager = ['superadmin', 'store_manager'].includes(req.user.role);
    if (!isSuperadminOrManager) {
      throw new Error('Permission denied. Superadmin or Store Manager role required.');
    }

    if (!newPassword || !confirmPassword) {
      throw new Error('New password and confirmation are required.');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters in length.');
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(targetUserId, 10));
    if (!targetUser) throw new Error('Target user account not found.');

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, targetUser.id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
      VALUES (?, 'ADMIN_RESET_PASSWORD', 'users', ?, ?)
    `).run(req.user.id, targetUser.id.toString(), `Admin ${req.user.email} reset password for ${targetUser.email}`);

    setFlash(res, 'success', `Password for ${targetUser.email} (${targetUser.full_name}) updated successfully.`);
  } catch (err) {
    setFlash(res, 'error', err.message);
  }

  res.redirect('/admin/security');
});

export default router;

