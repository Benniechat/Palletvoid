import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/database.js';

test('11. Product Gallery: Multiple Images Management & Storefront Resolution', (t) => {
  // Find or create a test product
  const product = db.prepare('SELECT id, name, primary_image FROM products LIMIT 1').get();
  assert.ok(product, 'Expected a baseline product to exist');

  // Clean any previous test gallery images
  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(product.id);

  // 1. Add multiple images to product gallery
  const insertImg = db.prepare(`
    INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  const img1 = insertImg.run(product.id, '/images/products/plastic-pallet-2.webp', 'Angle View 1', 1);
  const img2 = insertImg.run(product.id, '/images/products/plastic-pallet-3.webp', 'Angle View 2', 2);
  const img3 = insertImg.run(product.id, 'https://example.com/custom-pallet-view.jpg', 'Real Installation', 3);

  assert.ok(img1.lastInsertRowid > 0);
  assert.ok(img2.lastInsertRowid > 0);
  assert.ok(img3.lastInsertRowid > 0);

  // 2. Query product images in order
  const images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC').all(product.id);
  assert.equal(images.length, 3, 'Should have 3 gallery images');
  assert.equal(images[0].image_url, '/images/products/plastic-pallet-2.webp');
  assert.equal(images[1].image_url, '/images/products/plastic-pallet-3.webp');
  assert.equal(images[2].image_url, 'https://example.com/custom-pallet-view.jpg');

  // 3. Storefront Resolution: Unique list combining primary image and gallery images
  const allImages = [product.primary_image, ...images.map(g => g.image_url)].filter(Boolean);
  const uniqueImages = [...new Set(allImages)];
  assert.ok(uniqueImages.length >= 3, 'Storefront should resolve all unique gallery images');
  assert.equal(uniqueImages[0], product.primary_image, 'Primary image should be first');

  // 4. Test deleting a gallery image
  db.prepare('DELETE FROM product_images WHERE id = ?').run(images[1].id);
  const remainingImages = db.prepare('SELECT * FROM product_images WHERE product_id = ?').all(product.id);
  assert.equal(remainingImages.length, 2, 'Should have 2 gallery images remaining after deletion');

  // 5. Cleanup test images
  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(product.id);
});
