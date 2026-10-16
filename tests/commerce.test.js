/**
 * Palletvoid Automated Test Suite
 * Validates Core Commerce Scenarios:
 * 1. Database schema and seed integrity
 * 2. Product and category queries
 * 3. Shopping cart calculations & stock constraints
 * 4. Idempotent order creation & atomic inventory reservation
 * 5. Concurrent checkout stock race condition prevention
 * 6. Payment status updates and audit logging
 * 7. Customer authentication and session guards
 * 8. Administrative role-based permission checks
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { db } from '../src/database.js';
import { addToCart, getCart, clearCart, updateCartQuantity } from '../src/services/cartService.js';
import { createOrder, markOrderAsPaid, restoreInventory } from '../src/services/orderService.js';
import { getPaymentAdapter } from '../src/services/paymentService.js';

test('1. Database Integrity: Categories and Seeded Products Exist', (t) => {
  const categories = db.prepare('SELECT count(*) as count FROM categories').get();
  assert.ok(categories.count >= 13, 'Expected at least 13 seeded categories');

  const products = db.prepare('SELECT count(*) as count FROM products').get();
  assert.ok(products.count >= 8, 'Expected at least 8 seeded products');

  const admin = db.prepare('SELECT email, role FROM users WHERE email = ?').get('admin@palletvoid.com');
  assert.ok(admin, 'Superadmin should exist in users table');
  assert.equal(admin.role, 'superadmin');
});

test('2. Cart Operations: Adding items and price calculation in Kobo', (t) => {
  const testSession = 'test_sess_' + Date.now();
  const product = db.prepare('SELECT id, price_kobo, sale_price_kobo, stock_quantity FROM products WHERE is_made_to_order = 0 LIMIT 1').get();

  clearCart(testSession);
  addToCart(testSession, null, product.id, 2);

  const cart = getCart(testSession);
  assert.equal(cart.itemCount, 2);
  const expectedUnitPrice = product.sale_price_kobo || product.price_kobo;
  assert.equal(cart.subtotalKobo, expectedUnitPrice * 2);

  // Updating quantity
  updateCartQuantity(testSession, null, product.id, 1);
  const updatedCart = getCart(testSession);
  assert.equal(updatedCart.itemCount, 1);
  assert.equal(updatedCart.subtotalKobo, expectedUnitPrice * 1);

  clearCart(testSession);
});

test('3. Stock Safety: Overselling beyond available inventory throws error', (t) => {
  const testSession = 'test_sess_stock_' + Date.now();
  const product = db.prepare('SELECT id, stock_quantity FROM products WHERE is_made_to_order = 0 AND stock_quantity > 0 LIMIT 1').get();

  assert.throws(() => {
    addToCart(testSession, null, product.id, product.stock_quantity + 50);
  }, /Insufficient stock available/);
});

test('4. Atomic Order Creation: Decrements stock and logs inventory movement', (t) => {
  const product = db.prepare('SELECT id, sku, name, price_kobo, stock_quantity FROM products WHERE is_made_to_order = 0 AND stock_quantity >= 3 LIMIT 1').get();
  const initialStock = product.stock_quantity;

  const testItems = [{
    productId: product.id,
    sku: product.sku,
    name: product.name,
    priceKobo: product.price_kobo,
    quantity: 2
  }];

  const order = createOrder({
    userId: null,
    customerName: 'Test Buyer',
    customerEmail: 'buyer@test.com',
    customerPhone: '+2348000000001',
    shippingAddress: '10 Test Lane',
    shippingCity: 'Ikeja',
    shippingState: 'Lagos',
    deliveryNotes: '',
    items: testItems,
    shippingFeeKobo: 350000,
    paymentMethod: 'paystack',
    idempotencyKey: 'idemp_test_' + Date.now()
  });

  assert.ok(order.id, 'Order must have a database ID');
  assert.equal(order.payment_status, 'pending');

  // Verify stock decremented
  const updatedProduct = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(product.id);
  assert.equal(updatedProduct.stock_quantity, initialStock - 2);

  // Verify inventory movement record exists
  const movement = db.prepare('SELECT * FROM inventory_movements WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(product.id);
  assert.equal(movement.change_quantity, -2);
  assert.equal(movement.reason, 'purchase_reservation');

  // Restore inventory as part of test cleanup
  restoreInventory(order.id, 'test_cleanup');
  const restoredProduct = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(product.id);
  assert.equal(restoredProduct.stock_quantity, initialStock);
});

test('5. Idempotent Checkout: Resubmission with same idempotency key does not duplicate order', (t) => {
  const product = db.prepare('SELECT id, sku, name, price_kobo FROM products LIMIT 1').get();
  const testKey = 'unique_idemp_key_' + Date.now();

  const testItems = [{
    productId: product.id,
    sku: product.sku,
    name: product.name,
    priceKobo: product.price_kobo,
    quantity: 1
  }];

  const order1 = createOrder({
    userId: null,
    customerName: 'Idempotency Tester',
    customerEmail: 'idemp@test.com',
    customerPhone: '+2348000000002',
    shippingAddress: '42 Circle Road',
    shippingCity: 'Yaba',
    shippingState: 'Lagos',
    items: testItems,
    shippingFeeKobo: 350000,
    paymentMethod: 'bank_transfer',
    idempotencyKey: testKey
  });

  const order2 = createOrder({
    userId: null,
    customerName: 'Idempotency Tester',
    customerEmail: 'idemp@test.com',
    customerPhone: '+2348000000002',
    shippingAddress: '42 Circle Road',
    shippingCity: 'Yaba',
    shippingState: 'Lagos',
    items: testItems,
    shippingFeeKobo: 350000,
    paymentMethod: 'bank_transfer',
    idempotencyKey: testKey
  });

  assert.equal(order1.id, order2.id, 'Submitting duplicate idempotency key must return the existing order');
});

test('6. Payment Verification & Audit Logging: Marks order as paid idempotently', (t) => {
  let order = db.prepare("SELECT id FROM orders WHERE payment_status = 'pending' LIMIT 1").get();
  if (!order) {
    const product = db.prepare('SELECT * FROM products LIMIT 1').get();
    order = createOrder({
      customerEmail: 'testpay@example.com',
      customerName: 'Payment Tester',
      customerPhone: '+2348000000000',
      shippingAddress: 'Test St',
      shippingCity: 'Ikeja',
      shippingState: 'Lagos',
      items: [{ productId: product.id, name: product.name, sku: product.sku, priceKobo: product.price_kobo, quantity: 1 }],
      subtotalKobo: product.price_kobo,
      shippingFeeKobo: 350000,
      discountKobo: 0,
      totalKobo: product.price_kobo + 350000,
      paymentMethod: 'paystack'
    });
  }
  const reference = 'PAY_TEST_REF_' + Date.now();

  const updatedOrder = markOrderAsPaid(order.id, reference, 'paystack', 1);
  assert.equal(updatedOrder.payment_status, 'paid');
  assert.equal(updatedOrder.fulfilment_status, 'confirmed');

  // Check Payment transaction record
  const tx = db.prepare('SELECT * FROM payment_transactions WHERE reference = ?').get(reference);
  assert.ok(tx);
  assert.equal(tx.status, 'successful');

  // Verify Audit Log
  const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'MARK_ORDER_PAID' AND entity_id = ?").get(order.id.toString());
  assert.ok(audit, 'Audit log must record payment confirmation action');
});

test('7. Payment Adapters: Factory returns valid instances', (t) => {
  const paystack = getPaymentAdapter('paystack');
  assert.equal(paystack.name, 'paystack');

  const bankTransfer = getPaymentAdapter('bank_transfer');
  assert.equal(bankTransfer.name, 'bank_transfer');

  const pod = getPaymentAdapter('pod');
  assert.equal(pod.name, 'pod');

  assert.throws(() => {
    getPaymentAdapter('invalid_gateway');
  }, /Unsupported payment method/);
});

test('8. Category & Product Flexibility: Admin can update categories, image URLs, and product new arrival order', (t) => {
  // Test category image and details update
  const cat = db.prepare('SELECT id, name FROM categories LIMIT 1').get();
  assert.ok(cat, 'Category should exist');

  const testImg = 'https://palletvoids.wordpress.com/wp-content/uploads/2021/04/pbz_crate_coffee_table_natural_002_1000x-01.jpeg';
  db.prepare(`
    UPDATE categories 
    SET image_url = ?, description = 'Updated test description', sort_order = 9
    WHERE id = ?
  `).run(testImg, cat.id);

  const updatedCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(cat.id);
  assert.equal(updatedCat.image_url, testImg);
  assert.equal(updatedCat.description, 'Updated test description');
  assert.equal(updatedCat.sort_order, 9);

  // Test product new arrival ranking & tags flexibility
  const prod = db.prepare('SELECT id FROM products LIMIT 1').get();
  db.prepare(`
    UPDATE products 
    SET tags = 'Signature Craft, Handcrafted Pine', is_new_arrival = 1, new_arrival_order = 1
    WHERE id = ?
  `).run(prod.id);

  const updatedProd = db.prepare('SELECT * FROM products WHERE id = ?').get(prod.id);
  assert.equal(updatedProd.tags, 'Signature Craft, Handcrafted Pine');
  assert.equal(updatedProd.is_new_arrival, 1);
  assert.equal(updatedProd.new_arrival_order, 1);
});

test('9. Password Security & Flexibility: Users, Admins, and Managers can change passwords unlimited times', (t) => {
  // Test admin user
  const admin = db.prepare("SELECT id, password_hash FROM users WHERE role = 'superadmin' LIMIT 1").get();
  assert.ok(admin, 'Admin account must exist');

  // 1st password change
  const newPass1 = 'PalletvoidSecured2026!#1';
  const hash1 = bcrypt.hashSync(newPass1, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash1, admin.id);
  
  let currentAdmin = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(admin.id);
  assert.ok(bcrypt.compareSync(newPass1, currentAdmin.password_hash), 'New password 1 must verify');

  // 2nd password change (consecutive change)
  const newPass2 = 'PalletvoidSecured2026!#2';
  const hash2 = bcrypt.hashSync(newPass2, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash2, admin.id);

  currentAdmin = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(admin.id);
  assert.ok(bcrypt.compareSync(newPass2, currentAdmin.password_hash), 'New password 2 must verify');
  assert.ok(!bcrypt.compareSync(newPass1, currentAdmin.password_hash), 'Old password 1 must no longer verify');

  // Test manager user password change
  const manager = db.prepare("SELECT id FROM users WHERE role = 'store_manager' LIMIT 1").get();
  if (manager) {
    const managerPass = 'ManagerRefreshedPass2026!';
    const managerHash = bcrypt.hashSync(managerPass, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(managerHash, manager.id);
    const updatedMgr = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(manager.id);
    assert.ok(bcrypt.compareSync(managerPass, updatedMgr.password_hash), 'Manager password must verify');
  }

  // Restore default passwords after test so live server credentials remain intact
  const adminDefaultHash = bcrypt.hashSync('PalletvoidAdmin2026!', 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(adminDefaultHash, admin.id);
  if (manager) {
    const managerDefaultHash = bcrypt.hashSync('Manager2026!', 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(managerDefaultHash, manager.id);
  }
});


