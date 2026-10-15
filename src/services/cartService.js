/**
 * In-Memory & Session-based Shopping Cart Service
 * Supports Guest and Authenticated Carts, stock checking, and seamless merging upon login
 */
import { db } from '../database.js';

// Global Map for Cart Sessions (or stored directly in SQLite if needed)
// Using an in-memory session map backed by sqlite queries for products
const carts = new Map(); // key: sessionId or userId, value: array of items [{ productId, quantity, variationId }]

export function getCart(sessionId, userId = null) {
  const key = userId ? `user_${userId}` : `sess_${sessionId}`;
  if (!carts.has(key)) {
    carts.set(key, []);
  }
  
  const rawItems = carts.get(key);
  const items = [];
  let subtotalKobo = 0;

  for (const item of rawItems) {
    const product = db.prepare(`
      SELECT p.id, p.sku, p.name, p.slug, p.price_kobo, p.sale_price_kobo, p.stock_quantity, p.is_made_to_order, p.primary_image, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.is_active = 1
    `).get(item.productId);

    if (product) {
      const unitPrice = product.sale_price_kobo || product.price_kobo;
      const lineTotal = unitPrice * item.quantity;
      subtotalKobo += lineTotal;

      items.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        image: product.primary_image,
        category: product.category_name,
        priceKobo: unitPrice,
        regularPriceKobo: product.price_kobo,
        quantity: item.quantity,
        stockQuantity: product.stock_quantity,
        isMadeToOrder: product.is_made_to_order,
        lineTotalKobo: lineTotal
      });
    }
  }

  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalKobo,
    currency: 'NGN'
  };
}

export function getCartCount(sessionId, userId = null) {
  const cart = getCart(sessionId, userId);
  return cart.itemCount;
}

export function addToCart(sessionId, userId = null, productId, quantity = 1) {
  const key = userId ? `user_${userId}` : `sess_${sessionId}`;
  if (!carts.has(key)) {
    carts.set(key, []);
  }

  const product = db.prepare('SELECT id, stock_quantity, is_made_to_order FROM products WHERE id = ? AND is_active = 1').get(productId);
  if (!product) {
    throw new Error('Product not found or currently unavailable.');
  }

  const items = carts.get(key);
  const existing = items.find(i => i.productId === productId);

  const desiredQty = (existing ? existing.quantity : 0) + quantity;
  if (!product.is_made_to_order && desiredQty > product.stock_quantity) {
    throw new Error(`Insufficient stock available. Only ${product.stock_quantity} left in stock.`);
  }

  if (existing) {
    existing.quantity = desiredQty;
  } else {
    items.push({ productId, quantity: desiredQty });
  }

  return getCart(sessionId, userId);
}

export function updateCartQuantity(sessionId, userId = null, productId, quantity) {
  const key = userId ? `user_${userId}` : `sess_${sessionId}`;
  if (!carts.has(key)) return getCart(sessionId, userId);

  const items = carts.get(key);
  const index = items.findIndex(i => i.productId === productId);

  if (index !== -1) {
    if (quantity <= 0) {
      items.splice(index, 1);
    } else {
      const product = db.prepare('SELECT stock_quantity, is_made_to_order FROM products WHERE id = ?').get(productId);
      if (product && !product.is_made_to_order && quantity > product.stock_quantity) {
        throw new Error(`Cannot exceed available stock of ${product.stock_quantity}.`);
      }
      items[index].quantity = quantity;
    }
  }

  return getCart(sessionId, userId);
}

export function removeFromCart(sessionId, userId = null, productId) {
  const key = userId ? `user_${userId}` : `sess_${sessionId}`;
  if (carts.has(key)) {
    const items = carts.get(key).filter(i => i.productId !== productId);
    carts.set(key, items);
  }
  return getCart(sessionId, userId);
}

export function clearCart(sessionId, userId = null) {
  const key = userId ? `user_${userId}` : `sess_${sessionId}`;
  carts.set(key, []);
}

// Merge Guest Cart into User Cart upon login
export function mergeGuestCartIntoUser(sessionId, userId) {
  const guestKey = `sess_${sessionId}`;
  const userKey = `user_${userId}`;

  if (!carts.has(guestKey) || carts.get(guestKey).length === 0) return;

  if (!carts.has(userKey)) {
    carts.set(userKey, []);
  }

  const guestItems = carts.get(guestKey);
  const userItems = carts.get(userKey);

  for (const gItem of guestItems) {
    const existing = userItems.find(u => u.productId === gItem.productId);
    if (existing) {
      existing.quantity += gItem.quantity;
    } else {
      userItems.push({ ...gItem });
    }
  }

  // Clear guest cart
  carts.set(guestKey, []);
}
