import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/database.js';
import { extractGoogleDriveId, normalizeImageUrl, getGoogleDriveThumbnailUrl } from '../src/utils/imageUrl.js';

test('12. Google Drive Image URLs: Parsing, Normalization & Storefront Resolution', (t) => {
  const sampleId = '1v9qK9xY7zM2pL3nO4rS5tU6vW8xY0zA';

  // 1. Verify URL parsing across all Google Drive link variations
  const variations = [
    `https://drive.google.com/file/d/${sampleId}/view?usp=sharing`,
    `https://drive.google.com/file/d/${sampleId}/view`,
    `https://drive.google.com/file/d/${sampleId}`,
    `https://drive.google.com/file/u/0/d/${sampleId}/view`,
    `https://drive.google.com/file/u/2/d/${sampleId}/view?usp=drivesdk`,
    `https://drive.google.com/open?id=${sampleId}`,
    `https://drive.google.com/uc?id=${sampleId}&export=download`,
    `https://drive.google.com/uc?export=view&id=${sampleId}`,
    `https://docs.google.com/file/d/${sampleId}/edit`,
    `https://docs.google.com/uc?id=${sampleId}`,
    `https://lh3.googleusercontent.com/d/${sampleId}`,
    `https://drive.usercontent.google.com/download?id=${sampleId}&export=download`
  ];

  variations.forEach((url) => {
    assert.equal(extractGoogleDriveId(url), sampleId, `Failed to extract ID from: ${url}`);
    assert.equal(
      normalizeImageUrl(url),
      `https://lh3.googleusercontent.com/d/${sampleId}`,
      `Failed to normalize URL: ${url}`
    );
  });

  // 2. Non-Google URLs and local paths remain unaltered
  assert.equal(normalizeImageUrl('/uploads/pv_123_table.webp'), '/uploads/pv_123_table.webp');
  assert.equal(normalizeImageUrl('/hero.jpg'), '/hero.jpg');
  assert.equal(normalizeImageUrl('https://images.unsplash.com/photo-1540555700478-4be289fbecef'), 'https://images.unsplash.com/photo-1540555700478-4be289fbecef');
  assert.equal(normalizeImageUrl(''), '');
  assert.equal(normalizeImageUrl(null), '');

  // 3. Thumbnail fallback generator
  const thumbUrl = getGoogleDriveThumbnailUrl(`https://drive.google.com/file/d/${sampleId}/view`);
  assert.equal(thumbUrl, `https://drive.google.com/thumbnail?id=${sampleId}&sz=w1200`);

  // 4. Database integration: Product primary image and gallery images with Google Drive URLs
  const product = db.prepare('SELECT id, name FROM products LIMIT 1').get();
  assert.ok(product, 'Expected a baseline product to exist');

  const gDriveLink = `https://drive.google.com/file/d/${sampleId}/view?usp=sharing`;
  const normalizedDirect = `https://lh3.googleusercontent.com/d/${sampleId}`;

  // Save normalized URL into database
  db.prepare('UPDATE products SET primary_image = ? WHERE id = ?').run(normalizeImageUrl(gDriveLink), product.id);

  const updatedProduct = db.prepare('SELECT primary_image FROM products WHERE id = ?').get(product.id);
  assert.equal(updatedProduct.primary_image, normalizedDirect, 'Database should store direct CDN URL');

  // Insert a Google Drive link into product_images gallery
  const galleryInsert = db.prepare(`
    INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(product.id, normalizeImageUrl(gDriveLink), 'Google Drive Angle', 99);

  const galleryRow = db.prepare('SELECT image_url FROM product_images WHERE id = ?').get(galleryInsert.lastInsertRowid);
  assert.equal(galleryRow.image_url, normalizedDirect, 'Gallery row should store direct CDN URL');

  // Clean up test gallery row
  db.prepare('DELETE FROM product_images WHERE id = ?').run(galleryInsert.lastInsertRowid);
});
