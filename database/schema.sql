-- Palletvoid SQLite Relational Schema
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer', -- 'superadmin', 'store_manager', 'order_manager', 'inventory_manager', 'content_manager', 'customer'
    is_active INTEGER NOT NULL DEFAULT 1,
    email_verified INTEGER NOT NULL DEFAULT 0,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customer Addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT DEFAULT 'Home',
    recipient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'furniture', -- 'furniture' or 'industrial'
    description TEXT,
    image_url TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category_id INTEGER NOT NULL,
    product_type TEXT NOT NULL DEFAULT 'furniture', -- 'furniture' or 'industrial'
    short_description TEXT,
    description TEXT,
    price_kobo INTEGER NOT NULL, -- Price in Kobo (1 Naira = 100 Kobo) to eliminate float errors
    sale_price_kobo INTEGER,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_made_to_order INTEGER NOT NULL DEFAULT 0,
    lead_time_days INTEGER DEFAULT 7,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_new_arrival INTEGER NOT NULL DEFAULT 0,
    dimensions TEXT,
    weight_kg REAL,
    material TEXT,
    finish TEXT,
    primary_image TEXT,
    tags TEXT,
    new_arrival_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

-- Product Images Gallery
CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Product Variations (e.g. Dimensions, Finishes, Wood Types)
CREATE TABLE IF NOT EXISTS product_variations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g. "Size", "Wood Stain"
    value TEXT NOT NULL, -- e.g. "6x6 ft", "Dark Walnut"
    price_modifier_kobo INTEGER DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    sku_modifier TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Inventory Movements / Audit Trail
CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    variation_id INTEGER,
    change_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL, -- 'purchase', 'restock', 'manual_adjustment', 'order_cancellation', 'damage'
    reference_id TEXT, -- e.g. Order ID
    actor_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Shipping Zones & Methods
CREATE TABLE IF NOT EXISTS shipping_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    states_covered TEXT NOT NULL, -- Comma-separated or JSON list of states
    base_fee_kobo INTEGER NOT NULL DEFAULT 0,
    bulky_fee_kobo INTEGER NOT NULL DEFAULT 0,
    estimated_days TEXT DEFAULT '2-5 business days',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    user_id INTEGER, -- Nullable for Guest Checkout
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    delivery_notes TEXT,
    
    subtotal_kobo INTEGER NOT NULL,
    shipping_fee_kobo INTEGER NOT NULL DEFAULT 0,
    discount_kobo INTEGER NOT NULL DEFAULT 0,
    total_kobo INTEGER NOT NULL,
    
    payment_method TEXT NOT NULL, -- 'paystack', 'bank_transfer', 'pod'
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    fulfilment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'made_to_order', 'ready_for_dispatch', 'shipped', 'delivered', 'cancelled'
    
    payment_reference TEXT,
    admin_notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    variation_details TEXT,
    unit_price_kobo INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    line_total_kobo INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Payment Transactions / Audit Log
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL, -- 'paystack', 'bank_transfer', 'pod'
    amount_kobo INTEGER NOT NULL,
    currency TEXT DEFAULT 'NGN',
    status TEXT NOT NULL, -- 'initiated', 'successful', 'failed', 'abandoned', 'verified_manual'
    provider_response TEXT,
    verified_by_actor_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Wishlist
CREATE TABLE IF NOT EXISTS wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Customer Reviews (Real & Moderated)
CREATE TABLE IF NOT EXISTS customer_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER,
    author_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    title TEXT,
    review_text TEXT NOT NULL,
    is_verified_purchase INTEGER DEFAULT 0,
    is_approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Custom Furniture Enquiries / Bespoke Requests
CREATE TABLE IF NOT EXISTS custom_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    project_type TEXT NOT NULL,
    dimensions TEXT,
    wood_finish TEXT,
    budget_range TEXT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'new', -- 'new', 'in_discussion', 'quoted', 'completed', 'closed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System & Store Settings (Key-Value)
CREATE TABLE IF NOT EXISTS store_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs for sensitive operations
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
