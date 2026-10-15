/**
 * Shopping Cart Controller and Router
 */
import express from 'express';
import { getCart, addToCart, updateCartQuantity, removeFromCart } from '../services/cartService.js';
import { renderLayout, formatNaira } from '../views/layout.js';
import { setFlash } from '../server.js';

const router = express.Router();

// Helper dynamic SVG
function getProductSvg(name) {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90" fill="none"><rect width="120" height="90" fill="%23F7EFE5"/><rect x="30" y="25" width="60" height="8" rx="2" fill="%23C18A4A"/><rect x="30" y="38" width="60" height="8" rx="2" fill="%23C18A4A"/><rect x="30" y="51" width="60" height="8" rx="2" fill="%23C18A4A"/><text x="50%" y="78" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="10" fill="%23222222">Palletvoid</text></svg>`;
}

// View Cart
router.get('/', (req, res) => {
  const cart = getCart(req.sessionId, req.user ? req.user.id : null);

  const content = `
    <div class="pv-container pv-section">
      <div style="margin-bottom: 30px;">
        <span class="pv-section-subtitle">Shopping Bag</span>
        <h1 class="pv-section-title">Your Order Summary</h1>
      </div>

      ${cart.items.length > 0 ? `
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 40px; align-items: flex-start;">
          <!-- Cart Items List -->
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--pv-border); text-align: left; font-size: 0.85rem; color: var(--pv-text-muted); text-transform: uppercase;">
                  <th style="padding-bottom: 12px;">Craft / Item</th>
                  <th style="padding-bottom: 12px;">Unit Price</th>
                  <th style="padding-bottom: 12px; text-align: center;">Qty</th>
                  <th style="padding-bottom: 12px; text-align: right;">Total</th>
                  <th style="padding-bottom: 12px;"></th>
                </tr>
              </thead>
              <tbody>
                ${cart.items.map(item => `
                  <tr style="border-bottom: 1px solid var(--pv-border);">
                    <td style="padding: 20px 0; display: flex; align-items: center; gap: 15px;">
                      <img src="${getProductSvg(item.name)}" alt="${item.name}" style="width: 70px; height: 55px; border-radius: 4px; object-fit: cover;">
                      <div>
                        <a href="/product/${item.slug}" style="font-weight: 600; font-size: 0.95rem; color: var(--pv-black); display: block;">
                          ${item.name}
                        </a>
                        <span style="font-size: 0.8rem; color: var(--pv-text-muted);">SKU: ${item.sku}</span>
                        ${item.isMadeToOrder ? `<div style="font-size: 0.75rem; color: var(--pv-green); font-weight: 600;">Custom Build (Made to Order)</div>` : ''}
                      </div>
                    </td>
                    <td style="padding: 20px 0; font-weight: 600;">
                      ${formatNaira(item.priceKobo)}
                    </td>
                    <td style="padding: 20px 0; text-align: center;">
                      <form action="/cart/update" method="POST" style="display: inline-flex; align-items: center; gap: 5px;">
                        <input type="hidden" name="productId" value="${item.productId}">
                        <input type="number" name="quantity" value="${item.quantity}" min="1" max="${item.isMadeToOrder ? 50 : item.stockQuantity}" class="pv-input" style="width: 65px; padding: 6px; text-align: center;" onchange="this.form.submit()">
                      </form>
                    </td>
                    <td style="padding: 20px 0; text-align: right; font-weight: 700; color: var(--pv-black);">
                      ${formatNaira(item.lineTotalKobo)}
                    </td>
                    <td style="padding: 20px 0; text-align: right;">
                      <form action="/cart/remove" method="POST" style="margin: 0;">
                        <input type="hidden" name="productId" value="${item.productId}">
                        <button type="submit" style="background: none; border: none; color: var(--pv-danger); cursor: pointer; font-size: 1.1rem;" title="Remove Item">&times;</button>
                      </form>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="margin-top: 25px; display: flex; justify-content: space-between; align-items: center;">
              <a href="/shop" class="pv-btn pv-btn-outline pv-btn-sm">&larr; Continue Shopping</a>
            </div>
          </div>

          <!-- Checkout Summary Sidebar -->
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px;">
            <h3 style="font-size: 1.25rem; margin-bottom: 20px; border-bottom: 1px solid var(--pv-border); padding-bottom: 10px;">Order Summary</h3>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.95rem;">
              <span>Subtotal</span>
              <strong style="color: var(--pv-black);">${formatNaira(cart.subtotalKobo)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.95rem;">
              <span>Estimated Delivery</span>
              <span style="color: var(--pv-text-muted);">Calculated at Checkout</span>
            </div>

            <div style="border-top: 2px solid var(--pv-border); padding-top: 15px; margin-top: 15px; display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 800;">
              <span>Subtotal</span>
              <span style="color: var(--pv-gold);">${formatNaira(cart.subtotalKobo)}</span>
            </div>

            <div style="margin-top: 25px;">
              <a href="/checkout" class="pv-btn pv-btn-primary" style="width: 100%; padding: 14px; font-size: 1rem;">
                Proceed to Checkout &rarr;
              </a>
            </div>

            <div style="margin-top: 20px; text-align: center; font-size: 0.8rem; color: var(--pv-text-muted);">
              🔒 100% Secure Checkout | Paystack &amp; Bank Transfer Supported
            </div>
          </div>
        </div>
      ` : `
        <div style="text-align: center; padding: 80px 20px; background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <div style="font-size: 3rem; margin-bottom: 15px;">🛒</div>
          <h2 style="font-size: 1.6rem; margin-bottom: 10px;">Your Cart is Currently Empty</h2>
          <p style="color: var(--pv-text-muted); margin-bottom: 25px;">Explore our handcrafted furniture and durable industrial logistics pallets.</p>
          <a href="/shop" class="pv-btn pv-btn-primary">Discover Handcrafted Furniture</a>
        </div>
      `}
    </div>
  `;

  res.send(renderLayout({
    title: 'Shopping Cart | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// Add to Cart
router.post('/add', (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const qty = parseInt(quantity, 10) || 1;
    addToCart(req.sessionId, req.user ? req.user.id : null, parseInt(productId, 10), qty);
    setFlash(res, 'success', 'Item successfully added to your cart.');
  } catch (err) {
    setFlash(res, 'error', err.message);
  }
  res.redirect('/cart');
});

// Update Quantity
router.post('/update', (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const qty = parseInt(quantity, 10);
    updateCartQuantity(req.sessionId, req.user ? req.user.id : null, parseInt(productId, 10), qty);
    setFlash(res, 'success', 'Cart updated successfully.');
  } catch (err) {
    setFlash(res, 'error', err.message);
  }
  res.redirect('/cart');
});

// Remove Item
router.post('/remove', (req, res) => {
  const { productId } = req.body;
  removeFromCart(req.sessionId, req.user ? req.user.id : null, parseInt(productId, 10));
  setFlash(res, 'success', 'Item removed from your cart.');
  res.redirect('/cart');
});

export default router;
