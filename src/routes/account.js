/**
 * Customer Account Portal Router
 * Order history, address book, profile updates
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { renderLayout, formatNaira } from '../views/layout.js';
import { setFlash } from '../server.js';

const router = express.Router();

// Middleware: Customer Auth Guard
router.use((req, res, next) => {
  if (!req.user) {
    setFlash(res, 'error', 'Please log in to access your customer account.');
    return res.redirect('/auth/login');
  }
  next();
});

// Dashboard & Order History
router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const addresses = db.prepare('SELECT * FROM customer_addresses WHERE user_id = ?').all(req.user.id);

  const content = `
    <div class="pv-container pv-section">
      <div style="margin-bottom: 30px;">
        <span class="pv-section-subtitle">Customer Portal</span>
        <h1 class="pv-section-title">Welcome, ${req.user.full_name}</h1>
        <p class="pv-section-intro">Manage your orders, deliveries, and delivery addresses.</p>
      </div>

      <div style="display: grid; grid-template-columns: 2.2fr 1fr; gap: 40px; align-items: flex-start;">
        <!-- Orders List -->
        <div>
          <h3 style="font-size: 1.3rem; margin-bottom: 20px;">Your Orders</h3>
          
          ${orders.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 20px;">
              ${orders.map(order => {
                const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
                return `
                  <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--pv-border); padding-bottom: 15px; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                      <div>
                        <strong>Order #${order.order_number}</strong>
                        <div style="font-size: 0.8rem; color: var(--pv-text-muted);">${new Date(order.created_at).toLocaleDateString('en-NG', { dateStyle: 'long' })}</div>
                      </div>
                      <div style="text-align: right;">
                        <span style="font-size: 1.1rem; font-weight: bold; color: var(--pv-gold);">${formatNaira(order.total_kobo)}</span>
                        <div>
                          <span style="font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; font-weight: bold; background: ${order.payment_status === 'paid' ? 'var(--pv-green-light)' : 'var(--pv-gold-light)'}; color: ${order.payment_status === 'paid' ? 'var(--pv-green)' : 'var(--pv-gold)'};">
                            Payment: ${order.payment_status.toUpperCase()}
                          </span>
                          <span style="font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; font-weight: bold; background: var(--pv-surface-alt); margin-left: 5px;">
                            Fulfilment: ${order.fulfilment_status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                      ${items.map(item => `
                        <div style="font-size: 0.9rem; margin-bottom: 6px; display: flex; justify-content: space-between;">
                          <span>${item.product_name} &times; ${item.quantity}</span>
                          <span>${formatNaira(item.line_total_kobo)}</span>
                        </div>
                      `).join('')}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--pv-border); padding-top: 15px; font-size: 0.85rem;">
                      <span style="color: var(--pv-text-muted);">Ship to: ${order.shipping_address}, ${order.shipping_city}</span>
                      <a href="https://wa.me/2348024720412?text=Enquiry%20on%20Order%20${order.order_number}" target="_blank" rel="noopener noreferrer" style="color: var(--pv-green); font-weight: 600;">
                        WhatsApp Support &rarr;
                      </a>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; text-align: center;">
              <p style="color: var(--pv-text-muted); margin-bottom: 15px;">You have not placed any orders yet.</p>
              <a href="/shop" class="pv-btn pv-btn-primary pv-btn-sm">Browse Products</a>
            </div>
          `}
        </div>

        <!-- Saved Addresses & Profile -->
        <div>
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px; margin-bottom: 25px;">
            <h3 style="font-size: 1.2rem; margin-bottom: 15px;">Profile Details</h3>
            <div style="font-size: 0.9rem; line-height: 1.7; margin-bottom: 20px;">
              <div><strong>Name:</strong> ${req.user.full_name}</div>
              <div><strong>Email:</strong> ${req.user.email}</div>
              <div><strong>Phone:</strong> ${req.user.phone || 'Not provided'}</div>
            </div>
            <a href="/auth/logout" class="pv-btn pv-btn-outline pv-btn-sm" style="width: 100%; border-color: var(--pv-danger); color: var(--pv-danger);">
              Sign Out
            </a>
          </div>

          <!-- Password & Security Card -->
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px; margin-bottom: 25px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <span style="font-size: 1.2rem;">🔒</span>
              <h3 style="font-size: 1.15rem; margin: 0;">Change Password</h3>
            </div>
            <p style="font-size: 0.82rem; color: var(--pv-text-muted); margin-bottom: 16px; line-height: 1.5;">
              You can change your password as many times as you like.
            </p>

            <form action="/account/change-password" method="POST">
              <div class="pv-form-group" style="margin-bottom: 12px;">
                <label class="pv-form-label" style="font-size: 0.82rem;">Current Password *</label>
                <input type="password" name="currentPassword" class="pv-input" placeholder="Current password" required autocomplete="current-password">
              </div>

              <div class="pv-form-group" style="margin-bottom: 12px;">
                <label class="pv-form-label" style="font-size: 0.82rem;">New Password (min 8 chars) *</label>
                <input type="password" name="newPassword" class="pv-input" placeholder="New password" required minlength="8" autocomplete="new-password">
              </div>

              <div class="pv-form-group" style="margin-bottom: 16px;">
                <label class="pv-form-label" style="font-size: 0.82rem;">Confirm New Password *</label>
                <input type="password" name="confirmPassword" class="pv-input" placeholder="Confirm new password" required minlength="8" autocomplete="new-password">
              </div>

              <button type="submit" class="pv-btn pv-btn-primary pv-btn-sm" style="width: 100%; padding: 10px;">
                Update Password
              </button>
            </form>
          </div>

          <!-- Saved Address Book -->
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px;">
            <h3 style="font-size: 1.2rem; margin-bottom: 15px;">Delivery Addresses</h3>
            ${addresses.length > 0 ? `
              ${addresses.map(addr => `
                <div style="font-size: 0.9rem; padding: 12px; background: var(--pv-surface-alt); border-radius: 6px; margin-bottom: 10px;">
                  <strong>${addr.label} (${addr.recipient_name})</strong>
                  <p style="color: var(--pv-text-muted); margin: 4px 0;">${addr.street_address}, ${addr.city}, ${addr.state}</p>
                  <p style="color: var(--pv-text-muted); font-size: 0.8rem;">Phone: ${addr.phone}</p>
                </div>
              `).join('')}
            ` : `
              <p style="font-size: 0.85rem; color: var(--pv-text-muted);">No saved addresses found. Addresses entered during checkout will be preserved.</p>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Customer Account | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// Process Password Change (Customer)
router.post('/change-password', (req, res) => {
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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw new Error('User account not found.');

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      throw new Error('Current password entered is incorrect.');
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);

    setFlash(res, 'success', 'Password updated successfully! You can change your password anytime as often as you want.');
  } catch (err) {
    setFlash(res, 'error', err.message);
  }

  res.redirect('/account');
});

export default router;
