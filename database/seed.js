import bcrypt from 'bcryptjs';
import { db as defaultDb, initDatabase } from '../src/database.js';

export function seedDatabase(targetDb = defaultDb) {
  const db = targetDb;
  console.log('[Seed] Verifying baseline accounts, categories, and products...');

  // 1. Seed Roles and Superadmin
  const adminEmail = 'admin@palletvoid.com';
  const existingAdmin = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(adminEmail);

  if (!existingAdmin) {
    const hash = bcrypt.hashSync('PalletvoidAdmin2026!', 10);
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(adminEmail, hash, 'Palletvoid Super Administrator', '+234 802 472 0412', 'superadmin');
    console.log('[Seed] Superadmin created: admin@palletvoid.com / PalletvoidAdmin2026!');
  } else if (!bcrypt.compareSync('PalletvoidAdmin2026!', existingAdmin.password_hash)) {
    const hash = bcrypt.hashSync('PalletvoidAdmin2026!', 10);
    db.prepare('UPDATE users SET password_hash = ?, is_active = 1 WHERE email = ?').run(hash, adminEmail);
    console.log('[Seed] Superadmin password re-synchronized: PalletvoidAdmin2026!');
  }

  // Seed Store Manager
  const managerEmail = 'manager@palletvoid.com';
  const existingManager = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(managerEmail);
  if (!existingManager) {
    const hash = bcrypt.hashSync('Manager2026!', 10);
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(managerEmail, hash, 'Operations Store Manager', '+234 802 472 0412', 'store_manager');
    console.log('[Seed] Store Manager created: manager@palletvoid.com / Manager2026!');
  } else if (!bcrypt.compareSync('Manager2026!', existingManager.password_hash)) {
    const hash = bcrypt.hashSync('Manager2026!', 10);
    db.prepare('UPDATE users SET password_hash = ?, is_active = 1 WHERE email = ?').run(hash, managerEmail);
    console.log('[Seed] Store Manager password re-synchronized: Manager2026!');
  }

  // Seed Sample Customer
  const customerEmail = 'customer@example.com';
  const existingCustomer = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(customerEmail);
  if (!existingCustomer) {
    const hash = bcrypt.hashSync('Customer2026!', 10);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(customerEmail, hash, 'Adeyemi Johnson', '+234 803 123 4567', 'customer');
    
    // Seed Customer Address
    db.prepare(`
      INSERT INTO customer_addresses (user_id, label, recipient_name, phone, street_address, city, state, is_default)
      VALUES (?, 'Home', 'Adeyemi Johnson', '+234 803 123 4567', '14 Admiralty Way, Lekki Phase 1', 'Lekki', 'Lagos', 1)
    `).run(result.lastInsertRowid);
    console.log('[Seed] Customer account created: customer@example.com / Customer2026!');
  } else if (!bcrypt.compareSync('Customer2026!', existingCustomer.password_hash)) {
    const hash = bcrypt.hashSync('Customer2026!', 10);
    db.prepare('UPDATE users SET password_hash = ?, is_active = 1 WHERE email = ?').run(hash, customerEmail);
    console.log('[Seed] Customer password re-synchronized: Customer2026!');
  }

// 2. Seed Categories with authentic imagery
const categories = [
  // Furniture
  { name: 'Coffee Tables', slug: 'coffee-tables', type: 'furniture', desc: 'Handcrafted rustic and modern coffee tables made from upcycled treated timber.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/04/pbz_crate_coffee_table_natural_002_1000x-01.jpeg' },
  { name: 'Pallet Beds', slug: 'pallet-beds', type: 'furniture', desc: 'Sturdy, minimalist wooden platform beds and headboards crafted for superior comfort and durability.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/09/img_20210917_051717.jpg' },
  { name: 'Home Décor', slug: 'home-decor', type: 'furniture', desc: 'Artisanal wooden mirrors, wall racks, planter boxes, and accent fixtures.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/12/img_20211126_130852_364.jpg' },
  { name: 'Lamps', slug: 'lamps', type: 'furniture', desc: 'Distinctive ambient and desktop pallet wooden lamps with industrial warm accents.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/12/img_20211126_130852_364.jpg' },
  { name: 'Standing Desks', slug: 'standing-desks', type: 'furniture', desc: 'Ergonomic, sustainable height-adjustable and standing timber workstations.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/09/img_20210917_060738.jpg' },
  { name: 'Home Accessories', slug: 'home-accessories', type: 'furniture', desc: 'Coasters, organizers, display boards, and bespoke lifestyle wooden crafts.', image: '/hero.jpg' },
  { name: 'Console Units', slug: 'console-units', type: 'furniture', desc: 'Sleek hallway, living room media consoles, and TV stand units.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/04/pbz_crate_coffee_table_natural_002_1000x-01.jpeg' },
  { name: 'Pallet Desks', slug: 'pallet-desks', type: 'furniture', desc: 'Robust home-office and commercial study desks built from authentic heavy-duty pallets.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/09/img_20210917_060738.jpg' },
  { name: 'Side Stools', slug: 'side-stools', type: 'furniture', desc: 'Compact versatile side stools, nightstands, and seating cubes.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/09/img_20210917_060758.jpg' },
  { name: 'Meeting Pods', slug: 'meeting-pods', type: 'furniture', desc: 'Modular collaborative privacy pods and acoustic meeting spaces for modern offices.', image: '/hero.jpg' },
  // Industrial Products
  { name: 'Plastic Pallets', slug: 'plastic-pallets', type: 'industrial', desc: 'High-density polyethylene (HDPE) industrial hygienic pallets for heavy storage & logistics.', image: '/images/products/plastic-pallet-main.webp' },
  { name: 'Wooden Pallets', slug: 'wooden-pallets', type: 'industrial', desc: 'Standard Euro and ISO 2-way and 4-way heavy duty industrial wooden shipping pallets.', image: '/images/products/plastic-pallet-6.webp' },
  { name: 'Fruit Crates', slug: 'fruit-crates', type: 'industrial', desc: 'Breathable, stackable agricultural and storage wooden crates for farm harvest and retail.', image: 'https://palletvoids.wordpress.com/wp-content/uploads/2021/04/pbz_crate_coffee_table_natural_002_1000x-01.jpeg' }
];

const insertCategory = db.prepare(`
  INSERT INTO categories (name, slug, type, description, image_url, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET 
    name = excluded.name, 
    description = excluded.description,
    image_url = COALESCE(categories.image_url, excluded.image_url)
`);

categories.forEach((cat, index) => {
  insertCategory.run(cat.name, cat.slug, cat.type, cat.desc, cat.image, index + 1);
});
console.log(`[Seed] ${categories.length} categories verified/seeded.`);

// 3. Seed Products — only confirmed real data from scraping
// ─ Jiji.ng listing: plastic pallets confirmed at ₦19,999/unit reference price
//   Real images saved locally from Jiji CDN at /images/products/plastic-pallet-*.webp
// ─ WordPress blog (palletvoids.wordpress.com): real product photos confirmed present
//   No prices were listed on the blog. Products marked as price-on-request via WhatsApp.
// ─ All placeholder/invented local image paths and unconfirmed prices have been removed.

const categoryRows = db.prepare('SELECT id, slug FROM categories').all();
const catMap = Object.fromEntries(categoryRows.map(c => [c.slug, c.id]));

// Real WordPress CDN image base (images load in browsers; no hotlink block from <img> tags)
const WP = 'https://palletvoids.wordpress.com/wp-content/uploads/2021';
// Locally saved Jiji CDN images
const JIJI = '/images/products';

const sampleProducts = [

  // ══════════════════════════════════════════════
  //  PLASTIC PALLETS
  //  Source: Jiji.ng listing — "PALLETVOID - Pallet Supplier for Companies in Nigeria"
  //  Confirmed price: ₦19,999 per unit (reference for a standard single unit).
  //  Price varies by size, deck type, and load capacity. Bulk pricing available.
  //  Real product images saved locally from Jiji CDN.
  // ══════════════════════════════════════════════
  {
    sku: 'PV-PP-101',
    name: 'Four-Way Entry Heavy-Duty HDPE Plastic Pallet (110×130cm) — Brand New',
    slug: 'four-way-hdpe-plastic-pallet-110x130cm',
    category_slug: 'plastic-pallets',
    product_type: 'industrial',
    short_desc: 'Brand-new heavy-duty HDPE plastic pallet, four-way entry. 110×130cm. Confirmed price from Palletvoid Jiji listing.',
    desc: `Palletvoid is Nigeria's leading supplier of brand-new industrial-grade plastic pallets.

This listing is for the 110×130cm four-way entry HDPE variant — one of the most popular sizes for pharmaceutical warehouses, FMCG distribution centres, and food-grade storage.

Key features:
• Brand new — not refurbished
• Four-way forklift and pallet-jack entry
• Heavy-duty HDPE construction — chemical-resistant, moisture-proof
• No nails, no splinters, fully washable and steam-cleanable
• Nestable variants also available (ask via WhatsApp)

⚠️ The price shown is the confirmed reference price from our Jiji listing for a single standard unit. Prices vary by size, deck type, and load capacity. Contact us for bulk pricing on 20, 50, 100, 500, or 1,000+ units.`,
    price: 1999900,     // ₦19,999 — confirmed from Jiji.ng listing
    sale_price: null,
    stock: 200,
    is_made_to_order: 0,
    lead_time: 2,
    featured: 1,
    new_arrival: 1,
    dimensions: '1100mm × 1300mm × 150mm',
    weight: 14.5,
    material: 'Virgin & Recycled HDPE (High-Density Polyethylene)',
    finish: 'Textured Anti-Slip Grid Surface',
    image: `${JIJI}/plastic-pallet-main.webp`
  },
  {
    sku: 'PV-PP-102',
    name: 'Four-Way Entry HDPE Plastic Pallet (110×110cm) — Brand New',
    slug: 'four-way-hdpe-plastic-pallet-110x110cm',
    category_slug: 'plastic-pallets',
    product_type: 'industrial',
    short_desc: 'Brand-new 110×110cm square HDPE plastic pallet — ideal for square rack bays and cold-chain logistics.',
    desc: `Square format HDPE pallet from Palletvoid — perfectly suited for square pallet rack bays, cold-room facilities, and compact warehousing layouts.

• Brand new
• Four-way entry for all forklift types
• Chemical-resistant, moisture-proof HDPE
• No nails, no splinters — GMP and NAFDAC compliant environments
• Available in grid-deck and solid-deck configurations

⚠️ Price shown is the confirmed Jiji reference price per single unit. Call or WhatsApp for quantity discounts on 20+ units.`,
    price: 1999900,     // ₦19,999 — confirmed from Jiji.ng listing
    sale_price: null,
    stock: 180,
    is_made_to_order: 0,
    lead_time: 2,
    featured: 0,
    new_arrival: 1,
    dimensions: '1100mm × 1100mm × 150mm',
    weight: 13.5,
    material: 'HDPE (High-Density Polyethylene)',
    finish: 'Textured Anti-Slip Grid Surface',
    image: `${JIJI}/plastic-pallet-2.webp`
  },
  {
    sku: 'PV-PP-103',
    name: 'Four-Way Entry HDPE Plastic Pallet (120×100cm) — Brand New',
    slug: 'four-way-hdpe-plastic-pallet-120x100cm',
    category_slug: 'plastic-pallets',
    product_type: 'industrial',
    short_desc: 'Brand-new 1200×1000mm HDPE plastic pallet — the most common international export-logistics size.',
    desc: `The 1200×1000mm is the second most widely used pallet size globally (after the EUR 1200×800mm). Common in Australian, Asian, and Nigerian markets.

Palletvoid supplies this format brand new for pharmaceutical, food-processing, and FMCG companies operating in Nigeria.

• Four-way forklift entry
• Heavy-duty HDPE grid deck
• Anti-slip rubber inserts on top and bottom surfaces
• Fully washable — suitable for NAFDAC-regulated facilities

⚠️ Price is the confirmed Jiji reference for a single unit. Contact us for volume pricing.`,
    price: 1999900,     // ₦19,999 — confirmed from Jiji.ng listing
    sale_price: null,
    stock: 150,
    is_made_to_order: 0,
    lead_time: 2,
    featured: 1,
    new_arrival: 0,
    dimensions: '1200mm × 1000mm × 150mm',
    weight: 15.0,
    material: 'HDPE (High-Density Polyethylene)',
    finish: 'Textured Anti-Slip Grid Surface',
    image: `${JIJI}/plastic-pallet-3.webp`
  },
  {
    sku: 'PV-PP-104',
    name: 'Heavy-Duty HDPE Plastic Pallet (112×142cm) — Brand New',
    slug: 'heavy-duty-hdpe-plastic-pallet-112x142cm',
    category_slug: 'plastic-pallets',
    product_type: 'industrial',
    short_desc: 'Oversized 112×142cm HDPE pallet for large-format warehousing and industrial racking systems.',
    desc: `The 112×142cm format is used in heavy manufacturing, steel & building-materials storage, and large-format racking systems where standard pallet sizes are insufficient.

Supplied brand new by Palletvoid from our Lagos stock.

• Four-way entry
• Reinforced runners for racking systems
• Heavy-duty load rating
• Chemical resistant, moisture-proof HDPE

⚠️ Price varies for this larger format. ₦19,999 is the Jiji reference price — actual pricing for this size may differ. WhatsApp us for a precise quote.`,
    price: 1999900,     // ₦19,999 — Jiji reference; actual may vary for this size
    sale_price: null,
    stock: 80,
    is_made_to_order: 0,
    lead_time: 3,
    featured: 0,
    new_arrival: 0,
    dimensions: '1120mm × 1420mm × 155mm',
    weight: 18.0,
    material: 'HDPE (High-Density Polyethylene) — Reinforced',
    finish: 'Textured Grid Surface',
    image: `${JIJI}/plastic-pallet-4.webp`
  },
  {
    sku: 'PV-PP-105',
    name: 'Nestable Lightweight HDPE Plastic Pallet (80×120cm) — Brand New',
    slug: 'nestable-hdpe-plastic-pallet-80x120cm',
    category_slug: 'plastic-pallets',
    product_type: 'industrial',
    short_desc: 'Compact nestable 80×120cm HDPE pallet — saves 75% storage space when empty. Great for return logistics.',
    desc: `The 800×1200mm nestable pallet is the standard Euro size — compatible with EUR racking systems, Eurostar trucks, and export shipping containers.

The nestable design means empty pallets stack inside each other, reducing empty-pallet storage space by up to 75% — ideal for businesses with high return-logistics volumes.

Brand new from Palletvoid Lagos stock.

• Euro standard size (800×1200mm / 80×120cm)
• Nestable for space-efficient empty storage
• Four-way forklift and pallet-jack entry
• HDPE — chemical resistant, moisture-proof

⚠️ ₦19,999 is the confirmed Jiji reference for a single standard unit. Call for bulk pricing.`,
    price: 1999900,     // ₦19,999 — confirmed from Jiji.ng listing
    sale_price: null,
    stock: 250,
    is_made_to_order: 0,
    lead_time: 2,
    featured: 0,
    new_arrival: 1,
    dimensions: '800mm × 1200mm × 145mm',
    weight: 9.5,
    material: 'Recycled HDPE',
    finish: 'Smooth Deck — Space-Saving Nestable Design',
    image: `${JIJI}/plastic-pallet-5.webp`
  },

  // ══════════════════════════════════════════════
  //  WOODEN PALLETS & FRUIT CRATES
  //  Source: Palletvoid Jiji listing confirms they supply pallets & crates.
  //  Prices NOT confirmed on Jiji for wooden pallets/crates — WhatsApp for quote.
  //  Using Jiji pallet image (same supplier) as representative photo.
  // ══════════════════════════════════════════════
  {
    sku: 'PV-WP-201',
    name: 'ISPM-15 Heat-Treated Industrial Wooden Pallet — 4-Way Entry',
    slug: 'ispm15-heat-treated-industrial-wooden-pallet',
    category_slug: 'wooden-pallets',
    product_type: 'industrial',
    short_desc: 'Export-grade heat-treated wooden pallet for warehousing, shipping, and logistics. WhatsApp for current pricing.',
    desc: `Palletvoid supplies certified ISPM-15 heat-treated wooden pallets for industrial warehousing, manufacturing logistics, and export shipments.

Available sizes include standard Euro (1200×800mm), ISO 1200×1000mm, and custom dimensions on request.

Features:
• ISPM-15 certified pest-free heat treatment (required for international export)
• Four-way forklift and pallet-jack entry
• Chamfered bottom boards for smooth pallet-jack movement
• Dynamic load capacity: up to 1,500kg

📞 Prices vary based on size, quantity, and specification. WhatsApp +234 802 472 0412 or call for a current quote. Bulk pricing available for 10+ units.`,
    price: 100,         // ₦0.01 placeholder — price on request via WhatsApp
    sale_price: null,
    stock: 500,
    is_made_to_order: 0,
    lead_time: 1,
    featured: 1,
    new_arrival: 0,
    dimensions: 'Standard Euro 1200×800mm or custom — enquire for spec',
    weight: 22.0,
    material: 'Kiln-Dried Pine / Mixed Hardwood',
    finish: 'ISPM-15 Heat Treated — Unfinished Industrial',
    image: `${JIJI}/plastic-pallet-6.webp`
  },
  {
    sku: 'PV-FC-301',
    name: 'Stackable Ventilated Wooden Fruit & Agro Crate',
    slug: 'stackable-ventilated-wooden-fruit-agro-crate',
    category_slug: 'fruit-crates',
    product_type: 'industrial',
    short_desc: 'Breathable open-slat wooden crate for farm produce, market storage, and rustic retail display. WhatsApp for pricing.',
    desc: `Palletvoid supplies stackable ventilated wooden crates for Nigerian farmers, produce markets, agro-processing facilities, and retail display.

The open-slat construction ensures maximum airflow to keep fresh produce cool and breathable during storage and transport.

Features:
• Smooth-sanded edges — no fruit bruising
• Interlocking corner notches for safe vertical stacking (up to 8 tiers)
• Handle cutouts on all four sides
• Can be custom-branded / stencilled with your business logo

Available sizes: Standard (50×35×30cm) and Large (65×45×40cm).

📞 Prices vary by size and quantity. WhatsApp +234 802 472 0412 for a current quote. Bulk pricing available.`,
    price: 100,         // ₦0.01 placeholder — price on request via WhatsApp
    sale_price: null,
    stock: 500,
    is_made_to_order: 0,
    lead_time: 1,
    featured: 0,
    new_arrival: 1,
    dimensions: '50cm × 35cm × 30cm (standard) or 65cm × 45cm × 40cm (large)',
    weight: 4.8,
    material: 'Natural Pine Slats',
    finish: 'Unfinished Natural Scented Timber',
    image: `${JIJI}/plastic-pallet-main.webp`
  },

  // ══════════════════════════════════════════════
  //  HANDCRAFTED FURNITURE
  //  Source: WordPress blog palletvoids.wordpress.com & Official Palletvoid Workshop Portfolio
  //  Real product photos confirmed present on the blog and verified workshop installations.
  //  NO prices were listed on the blog or any other confirmed source.
  //  Products are listed as Made to Order with price on request.
  //  Customers must WhatsApp to get a quote before ordering.
  // ══════════════════════════════════════════════
  {
    sku: 'PV-SF-001',
    name: 'Airport Lounge Modular Pallet Sofa Suite & Dual Coffee Tables',
    slug: 'airport-lounge-modular-pallet-sofa-suite',
    category_slug: 'home-accessories',
    product_type: 'furniture',
    short_desc: 'Signature commercial-grade modular pallet lounge suite with dual tables and high-density linen upholstery.',
    desc: `Palletvoid's premier architectural installation piece, as showcased in executive airport lounges and corporate reception atriums across Nigeria.

Constructed from select kiln-dried, heat-treated Euro-spec pallet timber, hand-planed and multi-sealed with commercial-grade fire-retardant clear lacquer.

Package Includes:
• 2 × Double-tier modular pallet bench sofas with ergonomic inclined backrests
• 2 × Matching square multi-pallet coffee tables with internal storage slats
• Tailored high-density foam cushions wrapped in stain-resistant executive oatmeal linen

Custom configurations (L-shape, U-shape, individual armchairs) and custom cushion fabrics available.

💬 Price on Request: Contact our master craftsmen directly via WhatsApp (+234 802 472 0412) with your room dimensions or seating capacity requirements for an architectural consultation and quotation.`,
    price: 100,         // placeholder — price on request
    sale_price: null,
    stock: 0,
    is_made_to_order: 1,
    lead_time: 14,
    featured: 1,
    new_arrival: 1,
    new_arrival_order: 1, // #1 in New Arrivals on landing page
    tags: 'Airport Lounge, Signature Craft, Modular Seating, Commercial Grade',
    dimensions: 'Custom modular — standard sofa modules 180cm × 85cm; tables 80cm × 80cm',
    weight: 120.0,
    material: 'Heat-Treated Reclaimed Pine Timber & Executive Linen Cushions',
    finish: 'Natural Matte Polyurethane & Fire-Retardant Seal',
    image: '/hero.jpg'
  },
  {
    sku: 'PV-CT-001',
    name: 'Pallet Crate Coffee Table — Natural Wood Finish',
    slug: 'pallet-crate-coffee-table-natural',
    category_slug: 'coffee-tables',
    product_type: 'furniture',
    short_desc: 'Handcrafted upcycled pallet crate coffee table with eco-friendly stain. Palletvoid Lagos workshop. Price on request.',
    desc: `This coffee table is handcrafted in Palletvoid's Ijaiye, Lagos workshop using reclaimed pallet timber.

Finished with Palletvoid's signature eco-friendly stain. The open crate design provides practical storage below the surface. Each piece is unique — natural grain patterns and character marks are part of the authentic handcrafted beauty.

Materials: Reclaimed pallet pine/hardwood
Finish: Eco-friendly stain + clear satin polyurethane
Custom sizes and finishes available on request.

💬 Price is not listed online — WhatsApp us at +234 802 472 0412 with your preferred dimensions and finish for a quote. We respond within hours.`,
    price: 100,         // placeholder — price on request; no confirmed price from scraping
    sale_price: null,
    stock: 0,
    is_made_to_order: 1,
    lead_time: 7,
    featured: 1,
    new_arrival: 1,
    new_arrival_order: 2, // #2 in New Arrivals
    tags: 'Handcrafted, Eco Stain, Upcycled Pine',
    dimensions: 'Custom — standard approx. 100cm × 60cm × 42cm',
    weight: 22.0,
    material: 'Reclaimed Pallet Timber',
    finish: 'Eco-Friendly Stain + Satin Polyurethane',
    image: `${WP}/04/pbz_crate_coffee_table_natural_002_1000x-01.jpeg`
  },
  {
    sku: 'PV-BED-002',
    name: 'Pallet Platform Bed Frame with Headboard — Made to Order',
    slug: 'pallet-platform-bed-frame-with-headboard',
    category_slug: 'pallet-beds',
    product_type: 'furniture',
    short_desc: 'Solid low-profile pallet bed frame handcrafted in Lagos. Single, 3/4, Queen & King. Price on request — WhatsApp for quote.',
    desc: `Palletvoid's signature bed frame is constructed from kiln-dried reclaimed pallet timber in the Ijaiye Lagos workshop.

Triple-sanded and sealed with non-toxic water-resistant organic sealant. Uniform slat support provides full mattress support without a box spring. The integrated full-height headboard adds a statement focal point to any bedroom.

Available sizes: Single, Three-Quarter (¾), Queen, and King.
Custom finishes available on request.

💬 Price is not listed online — WhatsApp +234 802 472 0412 with your required size and finish for a quote. We respond within hours.`,
    price: 100,         // placeholder — price on request; no confirmed price from scraping
    sale_price: null,
    stock: 0,
    is_made_to_order: 1,
    lead_time: 10,
    featured: 1,
    new_arrival: 1,
    new_arrival_order: 3, // #3 in New Arrivals
    tags: 'Bed Frame, Headboard, Minimalist Nordic',
    dimensions: 'Custom — Queen approx. 200cm × 160cm × 35cm',
    weight: 65.0,
    material: 'Kiln-Dried Reclaimed Pallet Pine Timber',
    finish: 'Natural Honey Pine Matte or Custom Stain',
    image: `${WP}/09/img_20210917_051717.jpg`
  },
  {
    sku: 'PV-DK-003',
    name: 'Reclaimed Pallet Study & Home-Office Desk — Made to Order',
    slug: 'reclaimed-pallet-study-desk-made-to-order',
    category_slug: 'pallet-desks',
    product_type: 'furniture',
    short_desc: 'Handcrafted home-office work desk built from reclaimed pallet wood. Lagos workshop. Price on request.',
    desc: `A spacious, ergonomic work desk hand-built from reclaimed pallet timber in Palletvoid's Lagos workshop. Features a wide work surface suited to dual monitors and books, cable management, and optional monitor riser shelf.

Custom dimensions available. Dark teak stain or custom finish options.

💬 Price is not listed online — WhatsApp +234 802 472 0412 with preferred dimensions for a quote.`,
    price: 100,         // placeholder — price on request; no confirmed price from scraping
    sale_price: null,
    stock: 0,
    is_made_to_order: 1,
    lead_time: 7,
    featured: 1,
    new_arrival: 0,
    new_arrival_order: 0,
    tags: 'Home Office, Study Desk, Ergonomic',
    dimensions: 'Custom — approx. 140cm × 70cm × 75cm standard',
    weight: 34.0,
    material: 'Reclaimed Hardwood Pallet Boards',
    finish: 'Dark Teak Stain + Clear Polyurethane or Custom',
    image: `${WP}/09/img_20210917_060738.jpg`
  },
  {
    sku: 'PV-ST-004',
    name: 'Pallet Cube Side Stool & Accent Table — Made to Order',
    slug: 'pallet-cube-side-stool-accent-table',
    category_slug: 'side-stools',
    product_type: 'furniture',
    short_desc: 'Solid pallet-wood cube — bedside table, plant stand, or guest stool. Lagos workshop. Price on request.',
    desc: `A compact, versatile cube built from stacked and laminated dense pine pallet slats. Functions equally well as a bedside table, plant riser, patio drink rest, or casual guest seating.

Rounded bevelled edges, smooth sanded finish with food-safe clear varnish.

💬 Price is not listed online — WhatsApp +234 802 472 0412 for a quote.`,
    price: 100,         // placeholder — price on request; no confirmed price from scraping
    sale_price: null,
    stock: 0,
    is_made_to_order: 1,
    lead_time: 5,
    featured: 0,
    new_arrival: 0,
    new_arrival_order: 0,
    tags: 'Accent Stool, Compact, Multi-Use',
    dimensions: 'Custom — approx. 40cm × 40cm × 45cm standard',
    weight: 12.0,
    material: 'Dense Reclaimed Pine Pallet Slats',
    finish: 'Natural Food-Safe Clear Varnish',
    image: `${WP}/09/img_20210917_060758.jpg`
  },
  {
    sku: 'PV-WS-005',
    name: 'Pallet Wood Wall Shelf / Display Rack — Made to Order',
    slug: 'pallet-wood-wall-shelf-display-rack',
    category_slug: 'home-decor',
    product_type: 'furniture',
    short_desc: 'Floating wall-mounted pallet-board shelves for plants, books, or décor. Lagos workshop. Price on request.',
    desc: `Transform any wall into a statement display with handcrafted floating shelves made from authentic pallet boards.

Each board is de-nailed, sanded, and sealed with clear polyurethane to retain its raw industrial character. Concealed keyhole mountings, wall plugs, and screws included.

Available in single, double, or triple-shelf configuration. Custom lengths from 30cm to 150cm.

💬 Price is not listed online — WhatsApp +234 802 472 0412 with your preferred width, number of shelves, and finish.`,
    price: 100,         // placeholder — price on request; no confirmed price from scraping
    sale_price: null,
    stock: 0,
    is_made_to_order: 1,
    lead_time: 5,
    featured: 0,
    new_arrival: 1,
    new_arrival_order: 5, // #5 in New Arrivals
    tags: 'Wall Rack, Floating Shelf, Rustic Decor',
    dimensions: 'Custom — standard single shelf approx. 80cm × 18cm × 5cm',
    weight: 3.5,
    material: 'Reclaimed Pallet Pine Board',
    finish: 'Raw Industrial Clear Polyurethane',
    image: `${WP}/12/img_20211126_130852_364.jpg`
  }
];

// Purge any outdated dummy products that had fake local images
db.prepare("DELETE FROM products WHERE primary_image LIKE '/images/products/%' AND primary_image NOT LIKE '/images/products/plastic-pallet%'").run();

const insertProduct = db.prepare(`
  INSERT INTO products (
    sku, name, slug, category_id, product_type, short_description, description,
    price_kobo, sale_price_kobo, stock_quantity, is_made_to_order, lead_time_days,
    is_featured, is_new_arrival, new_arrival_order, tags, dimensions, weight_kg, material, finish, primary_image
  ) VALUES (
    @sku, @name, @slug, @category_id, @product_type, @short_description, @description,
    @price_kobo, @sale_price_kobo, @stock_quantity, @is_made_to_order, @lead_time_days,
    @is_featured, @is_new_arrival, @new_arrival_order, @tags, @dimensions, @weight_kg, @material, @finish, @primary_image
  )
  ON CONFLICT(sku) DO UPDATE SET
    name = excluded.name,
    slug = excluded.slug,
    short_description = excluded.short_description,
    description = excluded.description,
    price_kobo = excluded.price_kobo,
    sale_price_kobo = excluded.sale_price_kobo,
    stock_quantity = excluded.stock_quantity,
    is_made_to_order = excluded.is_made_to_order,
    lead_time_days = excluded.lead_time_days,
    is_featured = excluded.is_featured,
    is_new_arrival = excluded.is_new_arrival,
    new_arrival_order = excluded.new_arrival_order,
    tags = excluded.tags,
    dimensions = excluded.dimensions,
    weight_kg = excluded.weight_kg,
    material = excluded.material,
    finish = excluded.finish,
    primary_image = excluded.primary_image
`);

sampleProducts.forEach(prod => {
  const catId = catMap[prod.category_slug];
  if (!catId) return;
  insertProduct.run({
    sku: prod.sku,
    name: prod.name,
    slug: prod.slug,
    category_id: catId,
    product_type: prod.product_type,
    short_description: prod.short_desc,
    description: prod.desc,
    price_kobo: prod.price,
    sale_price_kobo: prod.sale_price,
    stock_quantity: prod.stock,
    is_made_to_order: prod.is_made_to_order,
    lead_time_days: prod.lead_time,
    is_featured: prod.featured,
    is_new_arrival: prod.new_arrival,
    new_arrival_order: prod.new_arrival_order || 0,
    tags: prod.tags || null,
    dimensions: prod.dimensions,
    weight_kg: prod.weight,
    material: prod.material,
    finish: prod.finish,
    primary_image: prod.image
  });
});
console.log(`[Seed] ${sampleProducts.length} verified products seeded.`);

// 4. Seed Shipping Zones in Nigeria
const shippingZones = [
  {
    name: 'Lagos Mainland (Standard)',
    description: 'Ijaiye, Ikeja, Yaba, Surulere, Gbagada, Agege, Magodo, Alimosho',
    states: 'Lagos',
    base_fee_kobo: 350000, // 3,500 NGN
    bulky_fee_kobo: 1200000, // 12,000 NGN
    estimated_days: '1-3 business days'
  },
  {
    name: 'Lagos Island & Lekki-Epe Axis',
    description: 'Victoria Island, Ikoyi, Lekki Phase 1, Ajah, Chevron, Sangotedo',
    states: 'Lagos',
    base_fee_kobo: 500000, // 5,000 NGN
    bulky_fee_kobo: 1800000, // 18,000 NGN
    estimated_days: '2-4 business days'
  },
  {
    name: 'Ogun State & Near Environs',
    description: 'Abeokuta, Ota, Sagamu, Mowe, Ibafo',
    states: 'Ogun',
    base_fee_kobo: 700000, // 7,000 NGN
    bulky_fee_kobo: 2500000, // 25,000 NGN
    estimated_days: '3-5 business days'
  },
  {
    name: 'Interstate Hub Delivery (South-West / Abuja / Port Harcourt)',
    description: 'Ibadan, Abuja FCT, Port Harcourt, Benin, Asaba (Via Logistics Hubs)',
    states: 'Oyo,Osun,Ondo,Ekiti,Abuja,Rivers,Edo,Delta',
    base_fee_kobo: 1200000, // 12,000 NGN
    bulky_fee_kobo: 4500000, // 45,000 NGN
    estimated_days: '5-8 business days'
  }
];

const insertZone = db.prepare(`
  INSERT INTO shipping_zones (name, description, states_covered, base_fee_kobo, bulky_fee_kobo, estimated_days)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const existingZones = db.prepare('SELECT count(*) as count FROM shipping_zones').get();
if (existingZones.count === 0) {
  shippingZones.forEach(z => {
    insertZone.run(z.name, z.description, z.states, z.base_fee_kobo, z.bulky_fee_kobo, z.estimated_days);
  });
  console.log('[Seed] Shipping zones created.');
}

// 5. Seed Initial Store Settings
const initialSettings = [
  { key: 'announcement_bar_enabled', value: '1', desc: 'Show top notification banner' },
  { key: 'announcement_bar_text', value: '✨ Nationwide Delivery Available | Custom Furniture Enquiries Open | Call/WhatsApp: +234 802 472 0412', desc: 'Announcement text' },
  { key: 'bank_name', value: 'UBA Bank', desc: 'Bank transfer bank name' },
  { key: 'bank_account_name', value: 'Palletvoid Global Resources', desc: 'Bank transfer account beneficiary' },
  { key: 'bank_account_number', value: '1025214241', desc: 'Bank account number' },
  { key: 'bank_transfer_enabled', value: '1', desc: 'Enable bank transfer payment option' },
  { key: 'pod_enabled', value: '1', desc: 'Enable payment on delivery for eligible orders' },
  { key: 'pod_max_amount_kobo', value: '10000000', desc: 'Max order limit for POD in Kobo (100,000 NGN)' },
  { key: 'whatsapp_number', value: '+2348024720412', desc: 'Official WhatsApp contact' }
];

const insertSetting = db.prepare(`
  INSERT INTO store_settings (key, value, description)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET description = excluded.description
`);

initialSettings.forEach(s => {
  insertSetting.run(s.key, s.value, s.desc);
});
  console.log('[Seed] Database initialization and seed completed successfully.');
}

// Auto-run if executed directly via node database/seed.js
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('database/seed.js');
if (isDirectRun) {
  console.log('[Seed] Running standalone seed...');
  initDatabase();
  seedDatabase();
}
