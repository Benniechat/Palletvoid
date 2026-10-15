/**
 * Checkout and Payment Processing Controller & Router
 * Enforces server-calculated pricing, shipping zones, idempotent transactions, and payment adapters
 */
import express from 'express';
import { db } from '../database.js';
import { getCart, clearCart } from '../services/cartService.js';
import { createOrder, markOrderAsPaid } from '../services/orderService.js';
import { getPaymentAdapter } from '../services/paymentService.js';
import { renderLayout, formatNaira } from '../views/layout.js';
import { setFlash } from '../server.js';

const router = express.Router();

// 1. Checkout Page
router.get('/', (req, res) => {
  const cart = getCart(req.sessionId, req.user ? req.user.id : null);

  if (cart.items.length === 0) {
    setFlash(res, 'error', 'Your shopping cart is empty.');
    return res.redirect('/cart');
  }

  // Load Shipping Zones
  const zones = db.prepare('SELECT * FROM shipping_zones WHERE is_active = 1').all();

  // Load Saved Address if User is Logged In
  let defaultAddress = null;
  if (req.user) {
    defaultAddress = db.prepare('SELECT * FROM customer_addresses WHERE user_id = ? ORDER BY is_default DESC LIMIT 1').get(req.user.id);
  }

  // Generate Unique Idempotency Key
  const idempotencyKey = 'pv_idemp_' + Math.random().toString(36).substring(2) + Date.now();

  const content = `
    <div class="pv-container pv-section">
      <div style="margin-bottom: 30px;">
        <span class="pv-section-subtitle">Secure Order Completion</span>
        <h1 class="pv-section-title">Checkout</h1>
      </div>

      <form action="/checkout/place-order" method="POST" id="checkout-form">
        <input type="hidden" name="idempotencyKey" value="${idempotencyKey}">
        
        <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 40px; align-items: flex-start;">
          <!-- Customer & Delivery Details -->
          <div>
            <!-- Step 1: Customer Contact -->
            <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 30px; margin-bottom: 25px;">
              <h3 style="font-size: 1.2rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                <span style="background: var(--pv-gold); color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem;">1</span>
                Customer Contact Information
              </h3>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="pv-form-group">
                  <label class="pv-form-label">Full Name *</label>
                  <input type="text" name="customerName" class="pv-input" required value="${req.user ? req.user.full_name : (defaultAddress ? defaultAddress.recipient_name : '')}" placeholder="Adeola Balogun">
                </div>
                <div class="pv-form-group">
                  <label class="pv-form-label">Email Address *</label>
                  <input type="email" name="customerEmail" class="pv-input" required value="${req.user ? req.user.email : ''}" placeholder="adeola@example.com">
                </div>
              </div>

              <div class="pv-form-group">
                <label class="pv-form-label">Nigerian Phone Number (WhatsApp Enabled) *</label>
                <input type="tel" name="customerPhone" class="pv-input" required value="${req.user ? req.user.phone : (defaultAddress ? defaultAddress.phone : '')}" placeholder="+234 802 000 0000">
              </div>
            </div>

            <!-- Step 2: Shipping Destination -->
            <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 30px; margin-bottom: 25px;">
              <h3 style="font-size: 1.2rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                <span style="background: var(--pv-gold); color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem;">2</span>
                Delivery Destination &amp; Shipping Zone
              </h3>

              <div class="pv-form-group">
                <label class="pv-form-label">Shipping Zone *</label>
                <select name="shippingZoneId" class="pv-select" id="shippingZoneSelect" required onchange="updateShippingFee()">
                  ${zones.map(z => `
                    <option value="${z.id}" data-base="${z.base_fee_kobo}" data-bulky="${z.bulky_fee_kobo}">
                      ${z.name} — (${z.estimated_days}) [${formatNaira(z.base_fee_kobo)}]
                    </option>
                  `).join('')}
                </select>
                <small style="color: var(--pv-text-muted); font-size: 0.8rem; margin-top: 4px; display: block;">
                  Bulky furniture items incur tailored logistics handling to ensure pristine delivery.
                </small>
              </div>

              <div class="pv-form-group">
                <label class="pv-form-label">Street Address / Landmark *</label>
                <input type="text" name="shippingAddress" class="pv-input" required value="${defaultAddress ? defaultAddress.street_address : ''}" placeholder="Plot 12, Admiralty Way, Lekki Phase 1">
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="pv-form-group">
                  <label class="pv-form-label">City / Town *</label>
                  <input type="text" name="shippingCity" class="pv-input" required value="${defaultAddress ? defaultAddress.city : 'Lagos'}" placeholder="Ikeja, Lekki, Abeokuta...">
                </div>
                <div class="pv-form-group">
                  <label class="pv-form-label">State *</label>
                  <input type="text" name="shippingState" class="pv-input" required value="${defaultAddress ? defaultAddress.state : 'Lagos'}" placeholder="Lagos">
                </div>
              </div>

              <div class="pv-form-group">
                <label class="pv-form-label">Delivery Notes / Landmark Instructions</label>
                <textarea name="deliveryNotes" class="pv-textarea" rows="2" placeholder="e.g. Call security gate on arrival, second black gate on left..."></textarea>
              </div>
            </div>

            <!-- Step 3: Payment Method Selection -->
            <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 30px;">
              <h3 style="font-size: 1.2rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                <span style="background: var(--pv-gold); color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem;">3</span>
                Select Payment Method
              </h3>

              <div style="display: flex; flex-direction: column; gap: 15px;">
                <!-- Paystack -->
                <label style="display: flex; align-items: flex-start; gap: 14px; padding: 16px; border: 2px solid var(--pv-gold); border-radius: var(--pv-radius); background: var(--pv-gold-light); cursor: pointer;">
                  <input type="radio" name="paymentMethod" value="paystack" checked style="margin-top: 4px;">
                  <div>
                    <strong style="color: var(--pv-black); font-size: 1.05rem;">Pay Online via Paystack (Debit Card / USSD / Bank Transfer)</strong>
                    <p style="font-size: 0.85rem; color: var(--pv-text-muted); margin-top: 4px;">
                      Instant confirmation. Supports Mastercard, Visa, Verve, USSD, and Bank Transfer with 256-bit bank encryption.
                    </p>
                  </div>
                </label>

                <!-- Direct Bank Transfer -->
                <label style="display: flex; align-items: flex-start; gap: 14px; padding: 16px; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); background: #FFFFFF; cursor: pointer;">
                  <input type="radio" name="paymentMethod" value="bank_transfer" style="margin-top: 4px;">
                  <div>
                    <strong style="color: var(--pv-black); font-size: 1.05rem;">Direct Bank Transfer (UBA Bank)</strong>
                    <p style="font-size: 0.85rem; color: var(--pv-text-muted); margin-top: 4px;">
                      Make a direct transfer to Palletvoid Global Resources. Verification is handled securely by store admin before dispatch.
                    </p>
                  </div>
                </label>

                <!-- Payment on Delivery (POD) -->
                <label style="display: flex; align-items: flex-start; gap: 14px; padding: 16px; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); background: #FFFFFF; cursor: pointer;">
                  <input type="radio" name="paymentMethod" value="pod" style="margin-top: 4px;">
                  <div>
                    <strong style="color: var(--pv-black); font-size: 1.05rem;">Payment on Delivery (POD)</strong>
                    <p style="font-size: 0.85rem; color: var(--pv-text-muted); margin-top: 4px;">
                      Available for eligible Lagos Mainland orders under ₦100,000. Verified with driver POS on delivery.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Order Summary Sidebar -->
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 30px; position: sticky; top: 100px;">
            <h3 style="font-size: 1.25rem; margin-bottom: 20px; border-bottom: 1px solid var(--pv-border); padding-bottom: 10px;">Review Order</h3>

            <div style="max-height: 250px; overflow-y: auto; margin-bottom: 20px;">
              ${cart.items.map(item => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.9rem;">
                  <div>
                    <strong>${item.name}</strong> &times; ${item.quantity}
                    <div style="font-size: 0.8rem; color: var(--pv-text-muted);">${formatNaira(item.priceKobo)} each</div>
                  </div>
                  <span style="font-weight: 600;">${formatNaira(item.lineTotalKobo)}</span>
                </div>
              `).join('')}
            </div>

            <div style="border-top: 1px solid var(--pv-border); padding-top: 15px; margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 0.95rem;">
              <span>Subtotal</span>
              <strong id="summary-subtotal" data-kobo="${cart.subtotalKobo}">${formatNaira(cart.subtotalKobo)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.95rem;">
              <span>Delivery Fee</span>
              <strong id="summary-shipping">₦3,500</strong>
            </div>

            <div style="border-top: 2px solid var(--pv-border); padding-top: 15px; margin-top: 15px; display: flex; justify-content: space-between; font-size: 1.3rem; font-weight: 800;">
              <span>Total Payable</span>
              <span id="summary-total" style="color: var(--pv-gold);">₦0</span>
            </div>

            <div style="margin-top: 25px;">
              <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; padding: 15px; font-size: 1.05rem;" id="confirm-order-btn">
                Confirm &amp; Place Order
              </button>
            </div>

            <div style="margin-top: 20px; font-size: 0.8rem; color: var(--pv-text-muted); text-align: center;">
              By completing your order, you agree to Palletvoid's Terms of Service and Craft Inspection Policy.
            </div>
          </div>
        </div>
      </form>
    </div>

    <script>
      function updateShippingFee() {
        const select = document.getElementById('shippingZoneSelect');
        const selectedOption = select.options[select.selectedIndex];
        const baseKobo = parseInt(selectedOption.getAttribute('data-base'), 10) || 0;
        const subtotalKobo = parseInt(document.getElementById('summary-subtotal').getAttribute('data-kobo'), 10) || 0;
        
        const totalKobo = subtotalKobo + baseKobo;

        document.getElementById('summary-shipping').innerText = '₦' + (baseKobo / 100).toLocaleString('en-NG');
        document.getElementById('summary-total').innerText = '₦' + (totalKobo / 100).toLocaleString('en-NG');
      }
      document.addEventListener('DOMContentLoaded', updateShippingFee);
    </script>
  `;

  res.send(renderLayout({
    title: 'Checkout — Secure Order | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// 2. Place Order (Transaction processing, Inventory reservation, and Gateway initialization)
router.post('/place-order', async (req, res) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    shippingZoneId,
    shippingAddress,
    shippingCity,
    shippingState,
    deliveryNotes,
    paymentMethod,
    idempotencyKey
  } = req.body;

  try {
    const cart = getCart(req.sessionId, req.user ? req.user.id : null);
    if (cart.items.length === 0) {
      setFlash(res, 'error', 'Your shopping cart is empty.');
      return res.redirect('/cart');
    }

    // Determine Shipping Fee strictly on server from DB
    const zone = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(shippingZoneId);
    const shippingFeeKobo = zone ? zone.base_fee_kobo : 350000;

    // Check POD eligibility
    if (paymentMethod === 'pod') {
      const podMaxSetting = db.prepare('SELECT value FROM store_settings WHERE key = ?').get('pod_max_amount_kobo');
      const maxLimit = podMaxSetting ? parseInt(podMaxSetting.value, 10) : 10000000;
      const orderTotal = cart.subtotalKobo + shippingFeeKobo;

      if (orderTotal > maxLimit) {
        throw new Error(`Payment on Delivery is only available for orders up to ${formatNaira(maxLimit)}. Please choose Paystack Online Payment or Direct Bank Transfer.`);
      }
    }

    // Create Order with atomic transaction and inventory reservation
    const order = createOrder({
      userId: req.user ? req.user.id : null,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      shippingCity,
      shippingState,
      deliveryNotes,
      items: cart.items,
      shippingFeeKobo,
      discountKobo: 0,
      paymentMethod,
      idempotencyKey
    });

    // Clear cart immediately upon successful order creation
    clearCart(req.sessionId, req.user ? req.user.id : null);

    // Initialize Payment through the Adapter abstraction
    const adapter = getPaymentAdapter(paymentMethod);
    const paymentResult = await adapter.initializeTransaction(order);

    if (paymentMethod === 'paystack') {
      return res.redirect(paymentResult.authorization_url);
    } else if (paymentMethod === 'bank_transfer') {
      return res.redirect(`/checkout/bank-transfer-instructions?order=${order.order_number}`);
    } else if (paymentMethod === 'pod') {
      return res.redirect(`/checkout/success?order=${order.order_number}`);
    }

  } catch (err) {
    console.error('[Order Creation Error]', err);
    setFlash(res, 'error', err.message);
    res.redirect('/checkout');
  }
});

// 3. Test Sandbox Payment Redirect Helper (Safe simulated checkout for dev verification)
router.get('/payment-redirect-test', (req, res) => {
  const { reference, order } = req.query;
  const dbOrder = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order);
  if (!dbOrder) return res.redirect('/shop');

  const content = `
    <div class="pv-container pv-section" style="max-width: 600px; text-align: center; padding: 60px 20px;">
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm);">
        <img src="/logo.png" alt="Palletvoid" style="height: 48px; margin: 0 auto 20px;">
        <h2 style="font-size: 1.6rem; margin-bottom: 10px;">Paystack Secured Payment Portal</h2>
        <p style="font-size: 0.95rem; color: var(--pv-text-muted); margin-bottom: 20px;">
          Test Sandbox Environment Verification
        </p>

        <div style="background: var(--pv-surface-alt); padding: 18px; border-radius: 6px; margin-bottom: 25px; text-align: left; font-size: 0.9rem;">
          <div><strong>Order Number:</strong> ${order}</div>
          <div><strong>Customer:</strong> ${dbOrder.customer_name}</div>
          <div><strong>Amount Payable:</strong> <span style="font-size: 1.2rem; font-weight: bold; color: var(--pv-gold);">${formatNaira(dbOrder.total_kobo)}</span></div>
          <div><strong>Transaction Ref:</strong> <code>${reference}</code></div>
        </div>

        <div style="display: flex; gap: 15px;">
          <a href="/checkout/verify?reference=${reference}&order=${order}&action=success" class="pv-btn pv-btn-primary" style="flex: 1;">
            ✔ Complete Payment (Simulate Success)
          </a>
          <a href="/checkout/verify?reference=${reference}&order=${order}&action=fail" class="pv-btn pv-btn-outline" style="flex: 1; border-color: var(--pv-danger); color: var(--pv-danger);">
            ✕ Cancel Payment
          </a>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Paystack Payment | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// 4. Server-Side Verification Callback
router.get('/verify', async (req, res) => {
  const { reference, order, action } = req.query;

  try {
    if (action === 'fail') {
      setFlash(res, 'error', 'Payment was cancelled. You may retry your payment.');
      return res.redirect(`/account/orders`);
    }

    const adapter = getPaymentAdapter('paystack');
    const verification = await adapter.verifyTransaction(reference);

    if (verification.status && verification.data.status === 'success') {
      // Find order
      const dbOrder = db.prepare('SELECT id, order_number FROM orders WHERE order_number = ? OR payment_reference = ?').get(order, reference) 
        || db.prepare('SELECT id, order_number FROM orders ORDER BY id DESC LIMIT 1').get();

      if (dbOrder) {
        markOrderAsPaid(dbOrder.id, reference, 'paystack');
        return res.redirect(`/checkout/success?order=${dbOrder.order_number}`);
      }
    }

    setFlash(res, 'error', 'Payment could not be verified by the bank gateway.');
    res.redirect('/cart');
  } catch (err) {
    console.error('[Payment Verification Error]', err);
    setFlash(res, 'error', err.message);
    res.redirect('/cart');
  }
});

// 5. Bank Transfer Instructions Page
router.get('/bank-transfer-instructions', (req, res) => {
  const { order } = req.query;
  const dbOrder = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order);
  if (!dbOrder) return res.redirect('/shop');

  const content = `
    <div class="pv-container pv-section" style="max-width: 650px;">
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm);">
        <div style="text-align: center; margin-bottom: 25px;">
          <span style="font-size: 2.5rem;">🏦</span>
          <h1 style="font-size: 1.8rem; margin: 10px 0 5px;">Bank Transfer Instructions</h1>
          <p style="color: var(--pv-text-muted);">Order Reference: <strong>${dbOrder.order_number}</strong></p>
        </div>

        <div style="background: var(--pv-gold-light); border: 1px solid var(--pv-gold); padding: 20px; border-radius: var(--pv-radius); margin-bottom: 25px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Bank:</span>
            <strong>UBA Bank</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Account Name:</span>
            <strong>Palletvoid Global Resources</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Account Number:</span>
            <strong style="font-size: 1.2rem; letter-spacing: 1px; color: var(--pv-black);">1025214241</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(193, 138, 74, 0.4); padding-top: 10px; margin-top: 10px;">
            <span>Exact Total Amount:</span>
            <strong style="font-size: 1.25rem; color: var(--pv-gold);">${formatNaira(dbOrder.total_kobo)}</strong>
          </div>
        </div>

        <div style="font-size: 0.9rem; color: var(--pv-text-muted); line-height: 1.7; margin-bottom: 25px;">
          <p style="margin-bottom: 10px;">
            <strong>Important:</strong> Please include <code>${dbOrder.order_number}</code> in your transfer remarks/narration.
          </p>
          <p>
            Once completed, send your payment receipt via WhatsApp to <a href="https://wa.me/2348024720412?text=Payment%20Receipt%20for%20Order%20${dbOrder.order_number}" target="_blank" rel="noopener noreferrer" style="color: var(--pv-green); font-weight: 600;">+234 802 472 0412</a> for immediate verification by our administration team.
          </p>
        </div>

        <div style="display: flex; gap: 15px;">
          <a href="https://wa.me/2348024720412?text=Payment%20Receipt%20for%20Order%20${dbOrder.order_number}" target="_blank" rel="noopener noreferrer" class="pv-btn pv-btn-secondary" style="flex: 1;">
            Send Receipt on WhatsApp
          </a>
          <a href="/checkout/success?order=${dbOrder.order_number}" class="pv-btn pv-btn-outline" style="flex: 1;">
            View Order Receipt
          </a>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Bank Transfer Instructions | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// 6. Order Success Page
router.get('/success', (req, res) => {
  const { order } = req.query;
  const dbOrder = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(order);
  if (!dbOrder) return res.redirect('/shop');

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(dbOrder.id);

  const content = `
    <div class="pv-container pv-section" style="max-width: 700px;">
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm); text-align: center;">
        <div style="font-size: 3.5rem; margin-bottom: 15px;">🎉</div>
        <h1 style="font-size: 2.2rem; margin-bottom: 10px;">Order Successfully Placed!</h1>
        <p style="color: var(--pv-text-muted); font-size: 1.05rem; margin-bottom: 25px;">
          Thank you for choosing Palletvoid. Your order <strong>#${dbOrder.order_number}</strong> is being processed.
        </p>

        <div style="background: var(--pv-surface-alt); border-radius: var(--pv-radius); padding: 25px; text-align: left; margin-bottom: 30px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.95rem; margin-bottom: 20px;">
            <div><strong>Recipient:</strong> ${dbOrder.customer_name}</div>
            <div><strong>Contact:</strong> ${dbOrder.customer_phone}</div>
            <div><strong>Destination:</strong> ${dbOrder.shipping_address}, ${dbOrder.shipping_city}, ${dbOrder.shipping_state}</div>
            <div><strong>Payment Method:</strong> ${dbOrder.payment_method.toUpperCase()}</div>
            <div><strong>Payment Status:</strong> <span style="font-weight: bold; color: ${dbOrder.payment_status === 'paid' ? 'var(--pv-green)' : 'var(--pv-warning)'};">${dbOrder.payment_status.toUpperCase()}</span></div>
            <div><strong>Fulfilment:</strong> <span style="font-weight: bold; color: var(--pv-gold);">${dbOrder.fulfilment_status.toUpperCase()}</span></div>
          </div>

          <h4 style="font-size: 1rem; border-top: 1px solid var(--pv-border); padding-top: 15px; margin-bottom: 12px;">Items Ordered:</h4>
          ${items.map(i => `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 8px;">
              <span>${i.product_name} &times; ${i.quantity}</span>
              <strong>${formatNaira(i.line_total_kobo)}</strong>
            </div>
          `).join('')}

          <div style="border-top: 1px solid var(--pv-border); padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
            <span>Total:</span>
            <span style="color: var(--pv-gold);">${formatNaira(dbOrder.total_kobo)}</span>
          </div>
        </div>

        <div style="display: flex; gap: 15px; justify-content: center;">
          <a href="/shop" class="pv-btn pv-btn-primary">Continue Shopping</a>
          <a href="https://wa.me/2348024720412?text=Hello%20Palletvoid,%20tracking%20update%20for%20order%20${dbOrder.order_number}" target="_blank" rel="noopener noreferrer" class="pv-btn pv-btn-secondary">
            Track via WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Order Confirmed | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

export default router;
