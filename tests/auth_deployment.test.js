import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from '../database/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../database/schema.sql');

test('10. Fresh Cloud Deployment Auto-Seed and Credential Verification', (t) => {
  // Simulate an in-memory fresh empty database like Render/Railway on first clone
  const memDb = new Database(':memory:');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  memDb.exec(schema);

  // Before seed: users table is empty
  const countBefore = memDb.prepare('SELECT count(*) as count FROM users').get();
  assert.equal(countBefore.count, 0, 'Fresh database should initially have 0 users');

  // Trigger auto-seed
  seedDatabase(memDb);

  // 1. Verify Superadmin
  const admin = memDb.prepare('SELECT * FROM users WHERE email = ?').get('admin@palletvoid.com');
  assert.ok(admin, 'Superadmin should be auto-created on empty deployment');
  assert.equal(admin.role, 'superadmin');
  assert.equal(admin.is_active, 1);
  assert.ok(bcrypt.compareSync('PalletvoidAdmin2026!', admin.password_hash), 'Superadmin default password must verify');

  // Verify Case-Insensitive & Whitespace Trimming
  const adminCaseCheck = memDb.prepare('SELECT * FROM users WHERE email = ?').get('Admin@Palletvoid.com'.trim().toLowerCase());
  assert.ok(adminCaseCheck, 'Case insensitive lookup should match');

  // 2. Verify Store Manager
  const manager = memDb.prepare('SELECT * FROM users WHERE email = ?').get('manager@palletvoid.com');
  assert.ok(manager, 'Store manager should be auto-created on empty deployment');
  assert.equal(manager.role, 'store_manager');
  assert.equal(manager.is_active, 1);
  assert.ok(bcrypt.compareSync('Manager2026!', manager.password_hash), 'Manager default password must verify');

  // 3. Verify Customer
  const customer = memDb.prepare('SELECT * FROM users WHERE email = ?').get('customer@example.com');
  assert.ok(customer, 'Customer should be auto-created on empty deployment');
  assert.equal(customer.role, 'customer');
  assert.equal(customer.is_active, 1);
  assert.ok(bcrypt.compareSync('Customer2026!', customer.password_hash), 'Customer default password must verify');

  // 4. Verify Categories and Products exist on fresh deployment
  const cats = memDb.prepare('SELECT count(*) as count FROM categories').get();
  assert.ok(cats.count >= 8, 'Categories must be seeded on fresh deployment');

  const prods = memDb.prepare('SELECT count(*) as count FROM products').get();
  assert.ok(prods.count >= 8, 'Products must be seeded on fresh deployment');

  memDb.close();
});
