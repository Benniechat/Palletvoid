/**
 * Storefront Controller & Router
 * Serves Homepage, Catalog, Category Views, Product Details, Bespoke Enquiries, and Brand Story
 */
import express from 'express';
import { db } from '../database.js';
import { renderLayout, formatNaira } from '../views/layout.js';
import { getGoogleReviews } from '../services/googleReviewsService.js';

const router = express.Router();

// Helper to generate dynamic SVG placeholder when no real image is available
function getProductSvg(name, catSlug) {
  const isIndustrial = catSlug.includes('pallet') || catSlug.includes('crate');
  const bg = isIndustrial ? '#E9ECEF' : '#F7EFE5';
  const iconColor = isIndustrial ? '#5D9B4C' : '#C18A4A';
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450" fill="none"><rect width="600" height="450" fill="${encodeURIComponent(bg)}"/><g fill="${encodeURIComponent(iconColor)}" opacity="0.85"><rect x="150" y="140" width="300" height="24" rx="4"/><rect x="150" y="180" width="300" height="24" rx="4"/><rect x="150" y="220" width="300" height="24" rx="4"/><rect x="150" y="260" width="300" height="24" rx="4"/><rect x="180" y="120" width="28" height="180" rx="4"/><rect x="286" y="120" width="28" height="180" rx="4"/><rect x="392" y="120" width="28" height="180" rx="4"/></g><text x="50%" y="350" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="%23222222">${encodeURIComponent(name)}</text><text x="50%" y="380" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23666666">Palletvoid Craftsmanship</text></svg>`;
}

// Helper: returns real product image if set, else SVG placeholder
function getProductImg(primaryImage, name, catSlug) {
  if (primaryImage && primaryImage.trim() !== '') return primaryImage;
  return getProductSvg(name, catSlug);
}

// Helper: detect "price on request" products (price_kobo <= 100 = ₦0.01 placeholder)
function isPriceOnRequest(priceKobo) {
  return !priceKobo || priceKobo <= 100;
}

// Helper: render price display in product cards
function renderPriceDisplay(p) {
  if (isPriceOnRequest(p.price_kobo)) {
    return `<span style="font-size:1rem;font-weight:700;color:var(--pv-green);">Price on Request</span>`;
  }
  return `
    <span class="pv-price ${p.sale_price_kobo ? 'pv-price-sale' : ''}">${formatNaira(p.sale_price_kobo || p.price_kobo)}</span>
    ${p.sale_price_kobo ? `<span class="pv-price-original">${formatNaira(p.price_kobo)}</span>` : ''}
  `;
}

// Helper: render cart/enquiry button in product cards
function renderCardButton(p) {
  if (isPriceOnRequest(p.price_kobo)) {
    const msg = encodeURIComponent(`Hello Palletvoid, I am interested in the ${p.name} (SKU: ${p.sku}). Please send me a quote.`);
    return `<a href="https://wa.me/2348024720412?text=${msg}" target="_blank" rel="noopener noreferrer" class="pv-btn pv-btn-secondary pv-btn-sm" style="font-size:0.78rem;">💬 Get Quote</a>`;
  }
  return `
    <form action="/cart/add" method="POST" style="margin:0;">
      <input type="hidden" name="productId" value="${p.id}">
      <input type="hidden" name="quantity" value="1">
      <button type="submit" class="pv-btn pv-btn-primary pv-btn-sm">Add to Cart</button>
    </form>
  `;
}

// Helper: render tag badges
function renderTags(tags) {
  if (!tags || typeof tags !== 'string' || tags.trim() === '') return '';
  const list = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (list.length === 0) return '';
  return `<div class="pv-tag-list">${list.map(t => `<span class="pv-tag-badge">${t}</span>`).join('')}</div>`;
}

// 1. Homepage
router.get('/', (req, res) => {
  const featuredProducts = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 AND p.is_featured = 1
    ORDER BY p.id DESC LIMIT 4
  `).all();

  const newArrivals = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 AND p.is_new_arrival = 1
    ORDER BY CASE WHEN p.new_arrival_order > 0 THEN p.new_arrival_order ELSE 9999 END ASC, p.id DESC
    LIMIT 4
  `).all();

  const categories = db.prepare(`SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 8`).all();

  const content = `
    <!-- Hero Banner -->
    <section class="pv-hero">
      <div class="pv-container">
        <div class="pv-hero-content">
          <span class="pv-hero-badge">Eco-Conscious Craftsmanship</span>
          <h1 class="pv-hero-title">
            Artisanal Furniture &amp; Industrial Pallets <span>Crafted to Last</span>.
          </h1>
          <p class="pv-hero-desc">
            Nigeria's foremost pallet crafts store. We transform sustainable upcycled timber into luxury platform beds, minimalist coffee tables, ergonomic study desks, and certified industrial logistics pallets.
          </p>
          <div class="pv-hero-cta">
            <a href="/shop" class="pv-btn pv-btn-primary">Explore Handcrafted Furniture</a>
            <a href="/category/industrial" class="pv-btn pv-btn-secondary">Industrial Supply Pallets</a>
            <a href="/custom-order" class="pv-btn pv-btn-outline" style="border-color: #FFFFFF; color: #FFFFFF;">Bespoke Order Enquiry</a>
          </div>
        </div>
      </div>
    </section>

    <!-- Verified Business Partners Section -->
    <section class="pv-partners-section">
      <div class="pv-container">
        <div style="text-align: center; margin-bottom: 25px;">
          <span style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: var(--pv-text-muted);">
            Trusted by Leading Nigerian Enterprises &amp; Logistics Partners
          </span>
        </div>
        <div class="pv-partners-grid">
          <div class="pv-partner-item" title="Mecure">
            <span class="pv-partner-text">MECURE</span>
          </div>
          <div class="pv-partner-item" title="Vita Construction">
            <img src="/partner-vita.png" alt="Vita Construction" class="pv-partner-logo" onerror="this.outerHTML='<span class=\\'pv-partner-text\\'>VITA CONSTRUCTION</span>'">
          </div>
          <div class="pv-partner-item" title="Valency">
            <img src="/partner-valency.png" alt="Valency" class="pv-partner-logo" onerror="this.outerHTML='<span class=\\'pv-partner-text\\'>VALENCY</span>'">
          </div>
          <div class="pv-partner-item" title="Ultimate Zone">
            <span class="pv-partner-text">ULTIMATE ZONE</span>
          </div>
          <div class="pv-partner-item" title="Lasena Water">
            <span class="pv-partner-text">LASENA</span>
          </div>
          <div class="pv-partner-item" title="Sagar Vitaceuticals">
            <img src="/partner-sagar.png" alt="Sagar Vitaceuticals" class="pv-partner-logo" onerror="this.outerHTML='<span class=\\'pv-partner-text\\'>SAGAR VITACEUTICALS</span>'">
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Categories -->
    <section class="pv-section">
      <div class="pv-container">
        <div class="pv-section-header">
          <span class="pv-section-subtitle">Curated Collections</span>
          <h2 class="pv-section-title">Shop by Category</h2>
          <p class="pv-section-intro">From custom living spaces to heavy-duty warehouse logistics, discover our precision-engineered wooden crafts.</p>
        </div>

        <div class="pv-cat-grid">
          ${categories.map(c => `
            <a href="/category/${c.slug}" class="pv-cat-card">
              ${c.image_url ? `
                <div class="pv-cat-media">
                  <img src="${c.image_url}" alt="${c.name}" class="pv-cat-img" loading="lazy" onerror="this.parentElement.outerHTML='<div class=\\'pv-cat-icon\\'>🪵</div>'">
                </div>
              ` : `
                <div class="pv-cat-icon">🪵</div>
              `}
              <h3 class="pv-cat-name">${c.name}</h3>
              <p style="font-size: 0.85rem; color: var(--pv-text-muted);">${c.type === 'furniture' ? 'Furniture & Décor' : 'Industrial Supply'}</p>
            </a>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- Featured Craft Collection -->
    <section class="pv-section" style="background-color: #FFFFFF;">
      <div class="pv-container">
        <div class="pv-section-header">
          <span class="pv-section-subtitle">Signature Pieces</span>
          <h2 class="pv-section-title">Best Sellers &amp; Featured Crafts</h2>
          <p class="pv-section-intro">Hand-selected by our master woodworkers in our Lagos workshop.</p>
        </div>

        <div class="pv-product-grid">
          ${featuredProducts.map(p => `
            <div class="pv-card">
              <div class="pv-card-media">
                <img src="${getProductImg(p.primary_image, p.name, p.category_slug)}" alt="${p.name}" class="pv-card-img" loading="lazy">
                ${p.is_made_to_order ? `<span class="pv-card-tag" style="background-color: var(--pv-green);">Made to Order</span>` : `<span class="pv-card-tag">In Stock</span>`}
              </div>
              <div class="pv-card-body">
                <span class="pv-card-cat">${p.category_name}</span>
                <h3 class="pv-card-title"><a href="/product/${p.slug}">${p.name}</a></h3>
                ${renderTags(p.tags)}
                <p class="pv-card-desc">${p.short_description || ''}</p>
                <div class="pv-card-footer">
                  <div>
                    ${renderPriceDisplay(p)}
                  </div>
                  ${renderCardButton(p)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="text-align: center; margin-top: 45px;">
          <a href="/shop" class="pv-btn pv-btn-outline" style="min-width: 200px;">View Full Catalog</a>
        </div>
      </div>
    </section>

    <!-- New Arrivals Section (Ordered by Admin & Manager Specified Sequence) -->
    ${newArrivals.length > 0 ? `
    <section class="pv-section" style="background-color: #F8F6F0; border-top: 1px solid var(--pv-border); border-bottom: 1px solid var(--pv-border);">
      <div class="pv-container">
        <div class="pv-section-header">
          <span class="pv-section-subtitle">Fresh From Workshop &amp; Warehouse</span>
          <h2 class="pv-section-title">New Arrivals</h2>
          <p class="pv-section-intro">Newly crafted pallet designs and freshly stocked industrial logistics supplies, ready for nationwide dispatch.</p>
        </div>

        <div class="pv-product-grid">
          ${newArrivals.map((p, idx) => `
            <div class="pv-card">
              <div class="pv-card-media">
                <img src="${getProductImg(p.primary_image, p.name, p.category_slug)}" alt="${p.name}" class="pv-card-img" loading="lazy">
                <span class="pv-card-tag" style="background-color: var(--pv-gold);">
                  ${p.new_arrival_order > 0 ? `<span class="pv-arrival-rank">#${p.new_arrival_order}</span>` : ''}New Arrival
                </span>
              </div>
              <div class="pv-card-body">
                <span class="pv-card-cat">${p.category_name}</span>
                <h3 class="pv-card-title"><a href="/product/${p.slug}">${p.name}</a></h3>
                ${renderTags(p.tags)}
                <p class="pv-card-desc">${p.short_description || ''}</p>
                <div class="pv-card-footer">
                  <div>
                    ${renderPriceDisplay(p)}
                  </div>
                  ${renderCardButton(p)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <!-- Sustainability & Craftsmanship Spotlight -->
    <section class="pv-section" style="background: var(--pv-surface-alt); border-top: 1px solid var(--pv-border); border-bottom: 1px solid var(--pv-border);">
      <div class="pv-container">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 40px; align-items: center;">
          <div>
            <span class="pv-section-subtitle">Our Philosophy</span>
            <h2 class="pv-section-title">“We Think Green, We Think Class, And We Think Creative.”</h2>
            <p style="font-size: 1.05rem; line-height: 1.8; color: var(--pv-text); margin-bottom: 20px;">
              Every year, thousands of tons of high-grade seasoned pine, cedar, and oak shipping timbers are discarded across Nigerian ports. At Palletvoid, our master craftsmen salvage, clean, heat-treat, plane, and transform this timber into heirloom-grade functional furniture.
            </p>
            <ul style="list-style: none; margin-bottom: 30px;">
              <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
                <span style="color: var(--pv-green); font-weight: bold; font-size: 1.2rem;">✔</span> 100% Seasoned Kiln-Dried Reclaimed Timber
              </li>
              <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
                <span style="color: var(--pv-green); font-weight: bold; font-size: 1.2rem;">✔</span> Non-Toxic Organic Sealants &amp; Satin Polyurethane
              </li>
              <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
                <span style="color: var(--pv-green); font-weight: bold; font-size: 1.2rem;">✔</span> Tailored Custom Sizes &amp; Nigerian Nationwide Shipping
              </li>
            </ul>
            <a href="/custom-order" class="pv-btn pv-btn-primary">Commission a Bespoke Piece</a>
          </div>

          <div style="background: #FFFFFF; padding: 35px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); box-shadow: var(--pv-shadow-sm);">
            <h3 style="font-size: 1.4rem; margin-bottom: 15px; color: var(--pv-black);">Industrial Pallet Supply for Warehouses</h3>
            <p style="font-size: 0.95rem; color: var(--pv-text-muted); line-height: 1.7; margin-bottom: 20px;">
              Need certified Euro pallets or pharmaceutical-grade plastic pallets for your manufacturing facility or logistics hub? We supply tested wooden and HDPE pallets with up to 2,000kg load ratings.
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <a href="/category/wooden-pallets" class="pv-btn pv-btn-outline" style="justify-content: space-between;">
                Standard Euro Wooden Pallets (1200x800mm) <span>&rarr;</span>
              </a>
              <a href="/category/plastic-pallets" class="pv-btn pv-btn-outline" style="justify-content: space-between;">
                Reinforced HDPE Plastic Pallets <span>&rarr;</span>
              </a>
              <a href="/category/fruit-crates" class="pv-btn pv-btn-outline" style="justify-content: space-between;">
                Ventilated Agro &amp; Fruit Crates <span>&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Google Reviews — Horizontal Swipeable Carousel (Swipe through on mobile & desktop) -->
    <section class="pv-reviews-section" style="border-top: 1px solid var(--pv-border); border-bottom: 1px solid var(--pv-border);">
      <div class="pv-container">
        <div class="pv-reviews-header-wrap">
          <div>
            <span class="pv-section-subtitle">Google Business Verified</span>
            <h2 class="pv-section-title" style="margin-bottom: 2px;">Google Customer Reviews</h2>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--pv-text-muted); flex-wrap: wrap;">
              <span style="color: #F59E0B; font-weight: 700; letter-spacing: 1px;">⭐⭐⭐⭐⭐ 5.0 Rating</span>
              <span>&bull;</span>
              <span>Layered horizontally — swipe or scroll through &rarr;</span>
            </div>
          </div>
          <div class="pv-reviews-controls">
            <button type="button" class="pv-review-nav-btn" onclick="scrollReviews(-1)" aria-label="Previous Reviews">&larr;</button>
            <button type="button" class="pv-review-nav-btn" onclick="scrollReviews(1)" aria-label="Next Reviews">&rarr;</button>
            <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" class="pv-btn pv-btn-outline pv-btn-sm" style="margin-left: 4px;">View on Google</a>
          </div>
        </div>

        <!-- Horizontal Swipeable Track -->
        <div class="pv-reviews-horizontal-track" id="pv-reviews-track">
          <div class="pv-review-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="pv-review-stars">★★★★★</div>
                <span class="pv-google-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                  Google
                </span>
              </div>
              <p class="pv-review-text">“Palletvoid handcrafted our executive airport lounge modular sofa suite and dual coffee tables. The quality of sanding, fire-retardant finish, and reclaimed pine is unmatched. Zero splinters, extremely robust!”</p>
            </div>
            <div class="pv-review-author">
              <div class="pv-review-avatar">B</div>
              <div class="pv-review-meta">
                <strong>Babatunde Olumide</strong>
                <span>Ikeja, Lagos &bull; 2 weeks ago</span>
              </div>
            </div>
          </div>

          <div class="pv-review-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="pv-review-stars">★★★★★</div>
                <span class="pv-google-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                  Google
                </span>
              </div>
              <p class="pv-review-text">“Procured 150 HDPE heavy-duty plastic pallets for our pharmaceutical warehouse. Load capacity is top notch, delivery to our logistics bay was fast. Palletvoid is our trusted industrial supplier in Nigeria.”</p>
            </div>
            <div class="pv-review-author">
              <div class="pv-review-avatar">E</div>
              <div class="pv-review-meta">
                <strong>Engr. Emeka Nwosu</strong>
                <span>Oregun Logistics Bay &bull; 1 month ago</span>
              </div>
            </div>
          </div>

          <div class="pv-review-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="pv-review-stars">★★★★★</div>
                <span class="pv-google-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                  Google
                </span>
              </div>
              <p class="pv-review-text">“Ordered a Queen platform pallet bed with custom headboard. It completely transformed my bedroom with a modern rustic aesthetic. The craftsmanship is pure class.”</p>
            </div>
            <div class="pv-review-author">
              <div class="pv-review-avatar">Z</div>
              <div class="pv-review-meta">
                <strong>Zainab Al-Hassan</strong>
                <span>Victoria Island, Lagos &bull; 3 weeks ago</span>
              </div>
            </div>
          </div>

          <div class="pv-review-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="pv-review-stars">★★★★★</div>
                <span class="pv-google-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                  Google
                </span>
              </div>
              <p class="pv-review-text">“Their customer communication on WhatsApp is super responsive. Ordered the reclaimed study desk and wooden crate tables. Solid wood, natural honey stain, delivered right to my doorstep.”</p>
            </div>
            <div class="pv-review-author">
              <div class="pv-review-avatar">F</div>
              <div class="pv-review-meta">
                <strong>Folake Majekodunmi</strong>
                <span>Lekki Phase 1, Lagos &bull; 1 month ago</span>
              </div>
            </div>
          </div>

          <div class="pv-review-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="pv-review-stars">★★★★★</div>
                <span class="pv-google-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                  Google
                </span>
              </div>
              <p class="pv-review-text">“The pallet crate coffee table is the centerpiece of my living room. Sustainable upcycled timber done with true luxury finishing. Definitely ordering matching side stools soon!”</p>
            </div>
            <div class="pv-review-author">
              <div class="pv-review-avatar">C</div>
              <div class="pv-review-meta">
                <strong>Chidi Kalu</strong>
                <span>Surulere, Lagos &bull; 2 months ago</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SociableKIT Google Reviews Embed Widget (Styled Horizontally) -->
        <div class="pv-google-reviews-wrap">
          <div class="sk-ww-google-reviews" data-embed-id="25722235"></div>
          <script src="https://widgets.sociablekit.com/google-reviews/widget.js" defer></script>
          <script src="/js/reviews-cleaner.js" defer></script>
        </div>
      </div>
    </section>

    <!-- Custom Furniture Promotion CTA (Compact) -->
    <section class="pv-section" style="background-color: var(--pv-black); color: #FFFFFF; text-align: center; padding: 42px 20px;">
      <div class="pv-container" style="max-width: 800px;">
        <span class="pv-hero-badge" style="border-color: var(--pv-gold); color: var(--pv-gold); margin-bottom: 10px;">Tailored to Your Interior</span>
        <h2 style="font-size: 1.85rem; color: #FFFFFF; margin-bottom: 10px;">Have a Unique Design or Exact Room Dimensions in Mind?</h2>
        <p style="font-size: 0.95rem; color: #D1CDC7; margin-bottom: 20px; line-height: 1.6;">
          From meeting pods and standing desks to custom headboards and boutique restaurant booth seating, our woodworking team brings your architectural vision to life.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <a href="/custom-order" class="pv-btn pv-btn-primary" style="padding: 10px 22px;">Request a Custom Furniture Quote</a>
          <a href="https://wa.me/2348024720412?text=Hello%20Palletvoid,%20I%20have%20a%20custom%20furniture%20inquiry." target="_blank" rel="noopener noreferrer" class="pv-btn pv-btn-secondary" style="padding: 10px 22px;">
            Instant WhatsApp Chat
          </a>
        </div>
      </div>
    </section>
  `;

  res.send(renderLayout({
    title: "Palletvoid — Nigeria's Foremost Pallet Crafts & Industrial Pallet Store",
    content,
    user: req.user,
    req,
    activeNav: 'home'
  }));
});

// 2. Shop All & Search & Filters
router.get('/shop', (req, res) => {
  const { search, category, type, sort, min_price, max_price } = req.query;

  let query = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
  `;
  const params = [];

  if (search) {
    query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (category) {
    query += ` AND c.slug = ?`;
    params.push(category);
  }

  if (type) {
    query += ` AND p.product_type = ?`;
    params.push(type);
  }

  if (min_price) {
    query += ` AND p.price_kobo >= ?`;
    params.push(parseInt(min_price) * 100);
  }

  if (max_price) {
    query += ` AND p.price_kobo <= ?`;
    params.push(parseInt(max_price) * 100);
  }

  // Sorting
  if (sort === 'price_asc') {
    query += ` ORDER BY p.price_kobo ASC`;
  } else if (sort === 'price_desc') {
    query += ` ORDER BY p.price_kobo DESC`;
  } else if (sort === 'name') {
    query += ` ORDER BY p.name ASC`;
  } else {
    query += ` ORDER BY p.id DESC`;
  }

  const products = db.prepare(query).all(...params);
  const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC').all();

  const content = `
    <div class="pv-container pv-section">
      <div style="margin-bottom: 30px;">
        <span class="pv-section-subtitle">Catalog</span>
        <h1 class="pv-section-title">Shop All Products</h1>
        <p class="pv-section-intro">Browse handcrafted furniture and industrial storage solutions.</p>
      </div>

      <!-- Filters & Search Bar -->
      <form action="/shop" method="GET" style="background: #FFFFFF; padding: 20px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); margin-bottom: 35px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; align-items: flex-end;">
          <div>
            <label class="pv-form-label">Search</label>
            <input type="text" name="search" class="pv-input" placeholder="Search by name, SKU..." value="${search || ''}">
          </div>

          <div>
            <label class="pv-form-label">Category</label>
            <select name="category" class="pv-select">
              <option value="">All Categories</option>
              ${categories.map(c => `
                <option value="${c.slug}" ${category === c.slug ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="pv-form-label">Type</label>
            <select name="type" class="pv-select">
              <option value="">All Types</option>
              <option value="furniture" ${type === 'furniture' ? 'selected' : ''}>Furniture &amp; Décor</option>
              <option value="industrial" ${type === 'industrial' ? 'selected' : ''}>Industrial Supply</option>
            </select>
          </div>

          <div>
            <label class="pv-form-label">Sort By</label>
            <select name="sort" class="pv-select">
              <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest First</option>
              <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>Price: Low to High</option>
              <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>Price: High to Low</option>
              <option value="name" ${sort === 'name' ? 'selected' : ''}>Product Name</option>
            </select>
          </div>

          <div style="display: flex; gap: 10px;">
            <button type="submit" class="pv-btn pv-btn-primary" style="flex: 1;">Filter</button>
            <a href="/shop" class="pv-btn pv-btn-outline">Reset</a>
          </div>
        </div>
      </form>

      <!-- Products Grid -->
      ${products.length > 0 ? `
        <div class="pv-product-grid">
          ${products.map(p => `
            <div class="pv-card">
              <div class="pv-card-media">
                <img src="${getProductImg(p.primary_image, p.name, p.category_slug)}" alt="${p.name}" class="pv-card-img" loading="lazy">
                ${p.is_made_to_order ? `<span class="pv-card-tag" style="background-color: var(--pv-green);">Made to Order</span>` : `<span class="pv-card-tag">In Stock (${p.stock_quantity})</span>`}
              </div>
              <div class="pv-card-body">
                <span class="pv-card-cat">${p.category_name}</span>
                <h3 class="pv-card-title"><a href="/product/${p.slug}">${p.name}</a></h3>
                ${renderTags(p.tags)}
                <p class="pv-card-desc">${p.short_description || ''}</p>
                <div class="pv-card-footer">
                  <div>
                    ${renderPriceDisplay(p)}
                  </div>
                  ${renderCardButton(p)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <h3 style="margin-bottom: 10px; font-size: 1.4rem;">No matching products found</h3>
          <p style="color: var(--pv-text-muted); margin-bottom: 20px;">Try adjusting your search terms or filter settings.</p>
          <a href="/shop" class="pv-btn pv-btn-primary">View All Products</a>
        </div>
      `}
    </div>
  `;

  res.send(renderLayout({
    title: 'Shop Catalog — Handcrafted Furniture & Industrial Pallets | Palletvoid',
    content,
    user: req.user,
    req,
    activeNav: 'shop'
  }));
});

// 3. Category Specific Page
router.get('/category/:slug', (req, res) => {
  const { slug } = req.params;
  const category = db.prepare('SELECT * FROM categories WHERE slug = ? AND is_active = 1').get(slug);

  // If slug is 'furniture' or 'industrial', handle broad category grouping
  if (slug === 'furniture' || slug === 'industrial') {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.product_type = ?
      ORDER BY p.id DESC
    `).all(slug);

    const categories = db.prepare('SELECT * FROM categories WHERE type = ? AND is_active = 1').all(slug);

    const content = `
      <div class="pv-container pv-section">
        <div style="margin-bottom: 35px;">
          <span class="pv-section-subtitle">Category Group</span>
          <h1 class="pv-section-title">${slug === 'furniture' ? 'Handcrafted Furniture &amp; Home Décor' : 'Industrial Supply &amp; Logistics Pallets'}</h1>
          <p class="pv-section-intro">${slug === 'furniture' ? 'Premium rustic, modern, and sustainable furniture handcrafted in Lagos, Nigeria.' : 'Durable Euro wooden pallets, hygienic plastic HDPE pallets, and agricultural fruit crates for warehouses.'}</p>
        </div>

        <div class="pv-cat-grid" style="margin-bottom: 40px;">
          ${categories.map(c => `
            <a href="/category/${c.slug}" class="pv-cat-card">
              ${c.image_url ? `
                <div class="pv-cat-media">
                  <img src="${c.image_url}" alt="${c.name}" class="pv-cat-img" loading="lazy" onerror="this.parentElement.outerHTML='<div class=\\'pv-cat-icon\\'>🪵</div>'">
                </div>
              ` : `
                <div class="pv-cat-icon">🪵</div>
              `}
              <h3 class="pv-cat-name">${c.name}</h3>
              <p style="font-size: 0.85rem; color: var(--pv-text-muted);">${c.description || ''}</p>
            </a>
          `).join('')}
        </div>

        <div class="pv-product-grid">
          ${products.map(p => `
            <div class="pv-card">
              <div class="pv-card-media">
                <img src="${getProductImg(p.primary_image, p.name, p.category_slug)}" alt="${p.name}" class="pv-card-img" loading="lazy">
                ${p.is_made_to_order ? `<span class="pv-card-tag" style="background-color: var(--pv-green);">Made to Order</span>` : `<span class="pv-card-tag">In Stock</span>`}
              </div>
              <div class="pv-card-body">
                <span class="pv-card-cat">${p.category_name}</span>
                <h3 class="pv-card-title"><a href="/product/${p.slug}">${p.name}</a></h3>
                ${renderTags(p.tags)}
                <p class="pv-card-desc">${p.short_description || ''}</p>
                <div class="pv-card-footer">
                  <div>
                    ${renderPriceDisplay(p)}
                  </div>
                  ${renderCardButton(p)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    return res.send(renderLayout({
      title: `${slug === 'furniture' ? 'Furniture Collection' : 'Industrial Supply'} | Palletvoid`,
      content,
      user: req.user,
      req,
      activeNav: slug
    }));
  }

  if (!category) {
    return res.status(404).redirect('/shop');
  }

  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 AND p.category_id = ?
    ORDER BY p.id DESC
  `).all(category.id);

  const content = `
    <div class="pv-container pv-section">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 30px; margin-bottom: 35px; flex-wrap: wrap;">
        <div>
          <span class="pv-section-subtitle">${category.type === 'furniture' ? 'Furniture Category' : 'Industrial Logistics'}</span>
          <h1 class="pv-section-title">${category.name}</h1>
          <p class="pv-section-intro">${category.description || ''}</p>
        </div>
        ${category.image_url ? `
          <div style="width: 140px; height: 95px; border-radius: var(--pv-radius); overflow: hidden; border: 1px solid var(--pv-border); box-shadow: var(--pv-shadow-sm); flex-shrink: 0;">
            <img src="${category.image_url}" alt="${category.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'">
          </div>
        ` : ''}
      </div>

      ${products.length > 0 ? `
        <div class="pv-product-grid">
          ${products.map(p => `
            <div class="pv-card">
              <div class="pv-card-media">
                <img src="${getProductImg(p.primary_image, p.name, p.category_slug)}" alt="${p.name}" class="pv-card-img" loading="lazy">
                ${p.is_made_to_order ? `<span class="pv-card-tag" style="background-color: var(--pv-green);">Made to Order</span>` : `<span class="pv-card-tag">In Stock (${p.stock_quantity})</span>`}
              </div>
              <div class="pv-card-body">
                <span class="pv-card-cat">${p.category_name}</span>
                <h3 class="pv-card-title"><a href="/product/${p.slug}">${p.name}</a></h3>
                ${renderTags(p.tags)}
                <p class="pv-card-desc">${p.short_description || ''}</p>
                <div class="pv-card-footer">
                  <div>
                    ${renderPriceDisplay(p)}
                  </div>
                  ${renderCardButton(p)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <h3 style="margin-bottom: 10px; font-size: 1.4rem;">New craft collection arriving soon</h3>
          <p style="color: var(--pv-text-muted); margin-bottom: 20px;">We are currently crafting new pieces for this category. Inquire on WhatsApp or request a custom build.</p>
          <a href="/custom-order" class="pv-btn pv-btn-primary">Request Custom Build</a>
        </div>
      `}
    </div>
  `;

  res.send(renderLayout({
    title: `${category.name} | Palletvoid Nigeria`,
    content,
    user: req.user,
    req,
    activeNav: category.type
  }));
});

// 4. Product Details Page
router.get('/product/:slug', (req, res) => {
  const { slug } = req.params;
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.is_active = 1
  `).get(slug);

  if (!product) {
    return res.status(404).redirect('/shop');
  }

  // Related products
  const related = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1
    LIMIT 3
  `).all(product.category_id, product.id);

  // Gallery images
  const galleryImages = db.prepare(`
    SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC
  `).all(product.id);
  const allImages = [product.primary_image, ...galleryImages.map(g => g.image_url)].filter(Boolean);
  const uniqueImages = [...new Set(allImages)];
  const primaryDisplay = uniqueImages.length > 0 ? getProductImg(uniqueImages[0], product.name, product.category_slug) : '/hero.jpg';

  const content = `
    <div class="pv-container pv-section" style="padding-top: 25px;">
      <!-- Breadcrumb -->
      <nav style="font-size: 0.85rem; color: var(--pv-text-muted); margin-bottom: 18px;">
        <a href="/">Home</a> / <a href="/shop">Shop</a> / <a href="/category/${product.category_slug}">${product.category_name}</a> / <span style="color: var(--pv-black); font-weight: 500;">${product.name}</span>
      </nav>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 35px; margin-bottom: 40px;">
        <!-- Product Media Gallery with Multiple Image Support & Thumbnails -->
        <div class="pv-product-gallery">
          <div class="pv-product-main-media">
            <img id="pv-main-product-img" src="${primaryDisplay}" alt="${product.name}" class="pv-product-main-img">
          </div>

          ${uniqueImages.length > 1 ? `
            <div class="pv-product-thumbnails" id="pv-product-thumbs" title="Swipe or click to view more photos">
              ${uniqueImages.map((img, idx) => `
                <button type="button" class="pv-thumb-btn ${idx === 0 ? 'active' : ''}" onclick="switchProductMedia('${img}', this)" aria-label="View product photo ${idx + 1}">
                  <img src="${img}" alt="${product.name} photo ${idx + 1}" onerror="this.src='/hero.jpg'">
                </button>
              `).join('')}
            </div>
            <script>
              function switchProductMedia(imgUrl, btn) {
                var mainImg = document.getElementById('pv-main-product-img');
                if (mainImg) {
                  mainImg.style.opacity = '0.35';
                  setTimeout(function() {
                    mainImg.src = imgUrl;
                    mainImg.style.opacity = '1';
                  }, 120);
                }
                var buttons = document.querySelectorAll('.pv-thumb-btn');
                buttons.forEach(function(b) { b.classList.remove('active'); });
                if (btn) btn.classList.add('active');
              }
            </script>
          ` : ''}

          <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            <span style="font-size: 0.78rem; color: var(--pv-text-muted); padding: 5px 10px; background: #FFFFFF; border-radius: 4px; border: 1px solid var(--pv-border);">
              Authentic Palletvoid Workshop Build
            </span>
            <span style="font-size: 0.78rem; color: var(--pv-green); padding: 5px 10px; background: var(--pv-green-light); border-radius: 4px; font-weight: 600;">
              ISPM-15 Heat Treated Reclaimed Pine
            </span>
          </div>
        </div>

        <!-- Product Actions & Info -->
        <div>
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--pv-green); text-transform: uppercase; letter-spacing: 1px;">
            ${product.category_name} &bull; SKU: ${product.sku}
          </span>
          <h1 style="font-size: 2.2rem; margin: 10px 0 10px;">${product.name}</h1>
          ${renderTags(product.tags)}

          <!-- Price Display -->
          <div style="margin: 20px 0 25px; display: flex; align-items: baseline; gap: 15px;">
            ${isPriceOnRequest(product.price_kobo) ? `
              <span style="font-size: 2rem; font-weight: 800; color: var(--pv-green);">Price on Request</span>
              <span style="font-size: 0.9rem; color: var(--pv-text-muted);">(Custom dimensions / specifications)</span>
            ` : `
              <span style="font-size: 2rem; font-weight: 800; color: var(--pv-black);">
                ${formatNaira(product.sale_price_kobo || product.price_kobo)}
              </span>
              ${product.sale_price_kobo ? `
                <span style="font-size: 1.2rem; text-decoration: line-through; color: var(--pv-text-muted);">
                  ${formatNaira(product.price_kobo)}
                </span>
                <span style="background: var(--pv-gold-light); color: var(--pv-gold); font-size: 0.85rem; font-weight: 700; padding: 4px 8px; border-radius: 4px;">
                  Special Offer
                </span>
              ` : ''}
            `}
          </div>

          <div style="font-size: 1rem; color: var(--pv-text); line-height: 1.7; margin-bottom: 30px;">
            ${product.description}
          </div>

          <!-- Product Attributes Specs -->
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 20px; margin-bottom: 30px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9rem;">
              <div><strong>Dimensions:</strong> ${product.dimensions || 'Standard / Custom available'}</div>
              <div><strong>Weight:</strong> ${product.weight_kg ? product.weight_kg + ' kg' : 'Variable'}</div>
              <div><strong>Material:</strong> ${product.material || 'Upcycled Kiln-Dried Timber'}</div>
              <div><strong>Finish:</strong> ${product.finish || 'Eco Satin Protective Varnish'}</div>
              <div><strong>Availability:</strong> ${product.is_made_to_order ? 'Made to Order' : product.stock_quantity + ' Units in Stock'}</div>
              <div><strong>Lead Time:</strong> ${product.is_made_to_order ? product.lead_time_days + ' days production' : 'Immediate dispatch'}</div>
            </div>
          </div>

          ${isPriceOnRequest(product.price_kobo) ? `
            <!-- Price on Request / Bespoke Quote CTA -->
            <div style="background: var(--pv-surface-alt); border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 25px; margin-bottom: 25px;">
              <h4 style="font-size: 1.15rem; margin-bottom: 8px; color: var(--pv-black);">Bespoke / Specification Quote</h4>
              <p style="font-size: 0.92rem; color: var(--pv-text-muted); line-height: 1.6; margin-bottom: 18px;">
                This handcrafted piece is made to order or supplied based on specific load ratings and dimensions. Message our Lagos workshop on WhatsApp with your required sizing or quantity for an instant quote.
              </p>
              <a href="https://wa.me/2348024720412?text=Hello%20Palletvoid,%20I%20am%20inquiring%20about%20a%20quote%20for%20${encodeURIComponent(product.name)}%20(SKU:%20${product.sku})." 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 class="pv-btn pv-btn-primary" 
                 style="width: 100%; justify-content: center; font-size: 1.05rem; padding: 14px 20px;">
                💬 Request Quote on WhatsApp (+234 802 472 0412)
              </a>
            </div>
          ` : `
            <!-- Add to Cart Form -->
            <form action="/cart/add" method="POST" style="margin-bottom: 25px;">
              <input type="hidden" name="productId" value="${product.id}">
              
              <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
                <div style="width: 100px;">
                  <label class="pv-form-label">Quantity</label>
                  <input type="number" name="quantity" class="pv-input" value="1" min="1" max="${product.is_made_to_order ? 50 : product.stock_quantity}">
                </div>
                <div style="flex-grow: 1; padding-top: 24px;">
                  <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; height: 48px;">
                    Add to Cart
                  </button>
                </div>
              </div>
            </form>

            <!-- WhatsApp Direct Product Inquiry -->
            <a href="https://wa.me/2348024720412?text=Hello%20Palletvoid,%20I%20am%20interested%20in%20the%20${encodeURIComponent(product.name)}%20(SKU:%20${product.sku})%20priced%20at%20${formatNaira(product.sale_price_kobo || product.price_kobo)}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="pv-btn pv-btn-secondary" 
               style="width: 100%; justify-content: center;">
              💬 Enquire on WhatsApp with Product Specs
            </a>
          `}
        </div>
      </div>

      <!-- Related Products -->
      ${related.length > 0 ? `
        <div style="margin-top: 60px; border-top: 1px solid var(--pv-border); padding-top: 40px;">
          <h2 style="font-size: 1.8rem; margin-bottom: 25px;">You May Also Appreciate</h2>
          <div class="pv-product-grid">
            ${related.map(p => `
              <div class="pv-card">
                <div class="pv-card-media">
                  <img src="${getProductImg(p.primary_image, p.name, p.category_slug)}" alt="${p.name}" class="pv-card-img" loading="lazy">
                </div>
                <div class="pv-card-body">
                  <span class="pv-card-cat">${p.category_name}</span>
                  <h3 class="pv-card-title"><a href="/product/${p.slug}">${p.name}</a></h3>
                  ${renderTags(p.tags)}
                  <div class="pv-card-footer">
                    <div>
                      ${renderPriceDisplay(p)}
                    </div>
                    ${renderCardButton(p)}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  res.send(renderLayout({
    title: `${product.name} — Palletvoid Nigeria`,
    content,
    user: req.user,
    req,
    activeNav: 'shop'
  }));
});

// 5. Custom Order Enquiries Page
router.get('/custom-order', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 800px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <span class="pv-section-subtitle">Bespoke Carpentry</span>
        <h1 class="pv-section-title">Commission a Custom Furniture Piece</h1>
        <p class="pv-section-intro">Have a specific design, exact dimensions, or corporate office requirement? Tell us about your project.</p>
      </div>

      <div style="background: #FFFFFF; padding: 40px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); box-shadow: var(--pv-shadow-sm);">
        <form action="/custom-order" method="POST">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="pv-form-group">
              <label class="pv-form-label">Full Name *</label>
              <input type="text" name="name" class="pv-input" required placeholder="Adeola Balogun">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">Email Address *</label>
              <input type="email" name="email" class="pv-input" required placeholder="adeola@example.com">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="pv-form-group">
              <label class="pv-form-label">Phone &amp; WhatsApp Number *</label>
              <input type="text" name="phone" class="pv-input" required placeholder="+234 803 000 0000">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">Project Type *</label>
              <select name="project_type" class="pv-select" required>
                <option value="Residential Furniture">Residential Living &amp; Bedroom Furniture</option>
                <option value="Office & Commercial">Corporate Office / Coworking Desks &amp; Pods</option>
                <option value="Restaurant & Hospitality">Restaurant / Lounge / Café Booths</option>
                <option value="Industrial Pallets">Wholesale Industrial Logistics Pallets</option>
                <option value="Other">Other Bespoke Craft</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="pv-form-group">
              <label class="pv-form-label">Target Dimensions (L x W x H)</label>
              <input type="text" name="dimensions" class="pv-input" placeholder="e.g. 180cm x 80cm x 75cm">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">Preferred Wood Finish / Stain</label>
              <select name="wood_finish" class="pv-select">
                <option value="Natural Honey Pine">Natural Honey Pine (Matte)</option>
                <option value="Warm Walnut Satin">Warm Walnut Satin</option>
                <option value="Dark Teak Gloss">Dark Teak Gloss</option>
                <option value="Charred Black Yakisugi">Charred Black Yakisugi Style</option>
                <option value="Unfinished Raw Timber">Unfinished Raw Timber</option>
              </select>
            </div>
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Estimated Budget Range</label>
            <input type="text" name="budget_range" class="pv-input" placeholder="e.g. ₦100,000 - ₦350,000">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Detailed Project Specifications *</label>
            <textarea name="description" class="pv-textarea" rows="5" required placeholder="Describe what you want us to build, where it will be placed, any special hardware, caster wheels, or glass tops required..."></textarea>
          </div>

          <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; padding: 14px;">
            Submit Bespoke Enquiry
          </button>
        </form>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Custom Furniture & Bespoke Commissions | Palletvoid Nigeria',
    content,
    user: req.user,
    req,
    activeNav: 'custom'
  }));
});

router.post('/custom-order', (req, res) => {
  const { name, email, phone, project_type, dimensions, wood_finish, budget_range, description } = req.body;

  if (!name || !email || !phone || !description) {
    return res.status(400).send('Please fill in all required fields.');
  }

  db.prepare(`
    INSERT INTO custom_enquiries (name, email, phone, project_type, dimensions, wood_finish, budget_range, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, phone, project_type, dimensions || '', wood_finish || '', budget_range || '', description);

  res.send(renderLayout({
    title: 'Enquiry Received | Palletvoid',
    user: req.user,
    req,
    content: `
      <div class="pv-container pv-section" style="text-align: center; max-width: 650px; padding: 80px 20px;">
        <div style="font-size: 3.5rem; margin-bottom: 20px;">🪵✨</div>
        <h1 style="font-size: 2.2rem; margin-bottom: 15px;">Your Bespoke Request Has Been Received</h1>
        <p style="font-size: 1.05rem; color: var(--pv-text-muted); line-height: 1.7; margin-bottom: 30px;">
          Thank you, <strong>${name}</strong>. Our head woodworker in Ijaiye, Lagos is reviewing your specs and will contact you via WhatsApp/Email with a 3D sketch and estimate within 24 hours.
        </p>
        <a href="https://wa.me/2348024720412?text=Hello%20Palletvoid,%20I%20just%20submitted%20a%20custom%20order%20enquiry%20for%20${encodeURIComponent(project_type)}" class="pv-btn pv-btn-secondary" target="_blank" rel="noopener noreferrer">
          Message Master Craftsman on WhatsApp Now
        </a>
        <a href="/" class="pv-btn pv-btn-outline" style="margin-left: 10px;">Return Home</a>
      </div>
    `
  }));
});

// 6. About Page
router.get('/about', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 900px;">
      <span class="pv-section-subtitle">Our Heritage</span>
      <h1 class="pv-section-title">Palletvoid Global Resources</h1>
      <p style="font-size: 1.2rem; color: var(--pv-gold); font-weight: 600; font-style: italic; margin-bottom: 30px;">
        “We Think Green, We Think Class, And We Think Creative.”
      </p>

      <div style="font-size: 1.05rem; line-height: 1.8; color: var(--pv-text); display: flex; flex-direction: column; gap: 20px;">
        <p>
          Founded in Lagos, Nigeria, <strong>Palletvoid</strong> is a pioneer in sustainable circular woodworking and industrial logistics pallets. We believe that true luxury does not come from clear-cutting ancient virgin forests, but from the master artisanal treatment, seasoning, and rebirth of structural timber.
        </p>
        <p>
          Located at <strong>10, Opeyemi Street, Off Ijaiye Bus Stop, Abeokuta Expressway, Ijaiye, Lagos</strong>, our integrated carpentry workshop houses state-of-the-art planers, jointers, sanding stations, and certified heat-treatment facilities.
        </p>
        <p>
          Whether furnishing executive creative offices with rustic conference tables and meeting pods, outfitting residences with platform beds and coffee tables, or supplying thousands of heavy-duty Euro pallets to industrial manufacturing leaders like Valency, Vita Construction, and Sagar Vitaceuticals, we hold ourselves to the highest Nigerian standards of structural integrity and aesthetic elegance.
        </p>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'About Us — Palletvoid Nigeria',
    content,
    user: req.user,
    req,
    activeNav: 'about'
  }));
});

// 7. Sustainability & Craftsmanship Page
router.get('/sustainability', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 900px;">
      <span class="pv-section-subtitle">Eco Innovation</span>
      <h1 class="pv-section-title">Craftsmanship &amp; Circular Ecology</h1>
      
      <div style="display: grid; grid-template-columns: 1fr; gap: 30px; margin-top: 30px;">
        <div style="background: #FFFFFF; padding: 30px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <h2 style="font-size: 1.4rem; color: var(--pv-green); margin-bottom: 12px;">1. Seasoned Reclaimed Timber</h2>
          <p style="line-height: 1.7; color: var(--pv-text-muted);">
            Industrial shipping pallets are made from slow-grown, heavy-density pine and hardwoods that have already spent months seasoned under strict humidity controls. By upcycling them, we eliminate warping and shrinkage that frequently plagues damp, freshly cut wood.
          </p>
        </div>

        <div style="background: #FFFFFF; padding: 30px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <h2 style="font-size: 1.4rem; color: var(--pv-green); margin-bottom: 12px;">2. ISPM-15 Heat Treatment (No Chemical Insecticides)</h2>
          <p style="line-height: 1.7; color: var(--pv-text-muted);">
            We strictly source HT (Heat Treated) pallet wood rather than chemically fumigated timbers. The timber is baked in high-temperature kilns to eradicate all biological pests safely and sustainably.
          </p>
        </div>

        <div style="background: #FFFFFF; padding: 30px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <h2 style="font-size: 1.4rem; color: var(--pv-green); margin-bottom: 12px;">3. Triple-Coat Organic Sealants</h2>
          <p style="line-height: 1.7; color: var(--pv-text-muted);">
            Our finishes use non-toxic, child-safe, and pet-safe varnishes and waxes that bring out the natural grain, knot character, and radiant amber hues of the wood while providing moisture-resistant longevity.
          </p>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Sustainability & Craftsmanship | Palletvoid',
    content,
    user: req.user,
    req,
    activeNav: 'sustainability'
  }));
});

// 8. Contact Page
router.get('/contact', (req, res) => {
  const content = `
    <div class="pv-container pv-section">
      <div style="text-align: center; max-width: 650px; margin: 0 auto 40px;">
        <span class="pv-section-subtitle">Get in Touch</span>
        <h1 class="pv-section-title">Contact Palletvoid</h1>
        <p class="pv-section-intro">Have questions regarding pricing, wholesale bulk deliveries, or workshop visits? We are here to assist.</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 40px;">
        <!-- Contact Information -->
        <div style="background: #FFFFFF; padding: 35px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <h2 style="font-size: 1.4rem; margin-bottom: 20px;">Workshop &amp; Showroom</h2>
          
          <div style="margin-bottom: 20px;">
            <strong>Physical Address:</strong>
            <p style="color: var(--pv-text-muted); margin-top: 4px;">
              10, Opeyemi Street, Off Ijaiye Bus Stop, Abeokuta Expressway, Ijaiye, Lagos, Nigeria.
            </p>
          </div>

          <div style="margin-bottom: 20px;">
            <strong>Phone &amp; Direct Line:</strong>
            <p style="color: var(--pv-text-muted); margin-top: 4px;">
              <a href="tel:+2348024720412">+234 802 472 0412</a>
            </p>
          </div>

          <div style="margin-bottom: 20px;">
            <strong>Email Enquiries:</strong>
            <p style="color: var(--pv-text-muted); margin-top: 4px;">
              <a href="mailto:mail.palletvoid@gmail.com">mail.palletvoid@gmail.com</a>
            </p>
          </div>

          <div style="margin-bottom: 25px;">
            <strong>WhatsApp Instant Response:</strong>
            <p style="color: var(--pv-text-muted); margin-top: 4px;">
              <a href="https://wa.me/2348024720412" target="_blank" rel="noopener noreferrer" style="color: var(--pv-green); font-weight: 600;">+234 802 472 0412 (Click to Chat)</a>
            </p>
          </div>

          <div style="padding-top: 20px; border-top: 1px solid var(--pv-border);">
            <strong>Operating Hours:</strong>
            <p style="color: var(--pv-text-muted); margin-top: 4px;">
              Monday – Saturday: 8:00 AM – 6:00 PM WAT<br>
              Sunday: By Appointment Only
            </p>
          </div>
        </div>

        <!-- Contact Form -->
        <div style="background: #FFFFFF; padding: 35px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border);">
          <h2 style="font-size: 1.4rem; margin-bottom: 20px;">Send a Direct Message</h2>
          <form action="/contact" method="POST">
            <div class="pv-form-group">
              <label class="pv-form-label">Full Name *</label>
              <input type="text" name="name" class="pv-input" required placeholder="Your full name">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">Email Address *</label>
              <input type="email" name="email" class="pv-input" required placeholder="your.email@example.com">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">Phone Number *</label>
              <input type="text" name="phone" class="pv-input" required placeholder="+234 800 000 0000">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">Subject</label>
              <input type="text" name="subject" class="pv-input" placeholder="e.g. Bulk Euro Pallet Purchase Order">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">Message *</label>
              <textarea name="message" class="pv-textarea" rows="4" required placeholder="How can we assist you?"></textarea>
            </div>
            <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%;">Send Message</button>
          </form>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Contact Us — Palletvoid Nigeria',
    content,
    user: req.user,
    req,
    activeNav: 'contact'
  }));
});

router.post('/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  // Store or log contact enquiry safely
  console.log(`[Contact Submission] From: ${name} (${email}, ${phone}) — Subject: ${subject}`);
  
  res.send(renderLayout({
    title: 'Message Sent | Palletvoid',
    user: req.user,
    req,
    content: `
      <div class="pv-container pv-section" style="text-align: center; max-width: 600px; padding: 80px 20px;">
        <h1 style="font-size: 2rem; margin-bottom: 15px;">Thank You for Contacting Us</h1>
        <p style="color: var(--pv-text-muted); line-height: 1.7; margin-bottom: 25px;">
          We have received your message, <strong>${name}</strong>. Our customer relations team will respond within 2 to 4 business hours.
        </p>
        <a href="/" class="pv-btn pv-btn-primary">Return Home</a>
      </div>
    `
  }));
});

// 9. Standard Policy Pages
router.get('/shipping-policy', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 850px;">
      <h1 class="pv-section-title">Shipping &amp; Delivery Policy</h1>
      <div style="font-size: 1rem; line-height: 1.8; color: var(--pv-text); display: flex; flex-direction: column; gap: 20px; margin-top: 25px;">
        <p><strong>1. Coverage:</strong> Palletvoid delivers across all 36 States and the Federal Capital Territory (Abuja) in Nigeria. Orders within Lagos and Ogun State are fulfilled via direct company dispatch vehicles or vetted logistics vans.</p>
        <p><strong>2. Bulky Furniture Handling:</strong> Large furniture items (platform beds, meeting pods, 8-seater dining tables) require dedicated freight transit to safeguard corners and glass tops. Shipping fees are calculated transparently during checkout based on zone and freight tier.</p>
        <p><strong>3. Delivery Timelines:</strong> In-stock furniture ships within 1–3 business days within Lagos. Made-to-order custom pieces have production lead times ranging from 5 to 14 business days, explicitly stated on the product page.</p>
        <p><strong>4. Local Workshop Pickup:</strong> Customers may opt for free self-pickup at our workshop: 10, Opeyemi Street, Off Ijaiye Bus Stop, Abeokuta Expressway, Ijaiye, Lagos.</p>
      </div>
    </div>
  `;
  res.send(renderLayout({ title: 'Shipping Policy | Palletvoid', content, user: req.user, req }));
});

router.get('/returns-policy', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 850px;">
      <h1 class="pv-section-title">Returns, Refunds &amp; Cancellation Policy</h1>
      <div style="font-size: 1rem; line-height: 1.8; color: var(--pv-text); display: flex; flex-direction: column; gap: 20px; margin-top: 25px;">
        <p><strong>1. Inspection Upon Delivery:</strong> Customers are advised to inspect all wood finishes, joints, glass tops, and dimensions upon delivery before signing the delivery manifest.</p>
        <p><strong>2. Defect Warranty:</strong> In the rare event of transit damage or structural manufacturing flaw, notify us within 48 hours with photographic proof for immediate workshop replacement or full refund.</p>
        <p><strong>3. Made-to-Order Items:</strong> Custom-dimensioned orders cannot be cancelled once timber milling has commenced unless mutually agreed upon.</p>
      </div>
    </div>
  `;
  res.send(renderLayout({ title: 'Returns Policy | Palletvoid', content, user: req.user, req }));
});

router.get('/terms', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 850px;">
      <h1 class="pv-section-title">Terms &amp; Conditions</h1>
      <div style="font-size: 1rem; line-height: 1.8; color: var(--pv-text); display: flex; flex-direction: column; gap: 20px; margin-top: 25px;">
        <p>These terms govern your purchases with Palletvoid Global Resources. All transactions are billed in Nigerian Naira (NGN). We reserve the right to verify manual bank transfers before releasing merchandise for dispatch.</p>
      </div>
    </div>
  `;
  res.send(renderLayout({ title: 'Terms and Conditions | Palletvoid', content, user: req.user, req }));
});

router.get('/privacy', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 850px;">
      <h1 class="pv-section-title">Privacy Policy</h1>
      <div style="font-size: 1rem; line-height: 1.8; color: var(--pv-text); display: flex; flex-direction: column; gap: 20px; margin-top: 25px;">
        <p>We respect customer privacy. We collect only delivery addresses, email addresses, and phone numbers strictly needed to fulfill orders and communicate shipping updates. We never sell or distribute your data.</p>
      </div>
    </div>
  `;
  res.send(renderLayout({ title: 'Privacy Policy | Palletvoid', content, user: req.user, req }));
});

// 10. XML Sitemap for SEO
router.get('/sitemap.xml', (req, res) => {
  const products = db.prepare('SELECT slug, updated_at FROM products WHERE is_active = 1').all();
  const categories = db.prepare('SELECT slug FROM categories WHERE is_active = 1').all();
  const baseUrl = process.env.APP_URL || 'https://palletvoid.com';

  res.header('Content-Type', 'application/xml');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/shop</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${baseUrl}/category/furniture</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/category/industrial</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/custom-order</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${baseUrl}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${baseUrl}/contact</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
`;

  categories.forEach(c => {
    xml += `  <url><loc>${baseUrl}/category/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  });

  products.forEach(p => {
    xml += `  <url><loc>${baseUrl}/product/${p.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  });

  xml += `</urlset>`;
  res.send(xml);
});

// 11. Robots.txt
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /account/\nDisallow: /checkout/\nSitemap: ${(process.env.APP_URL || 'https://palletvoid.com')}/sitemap.xml`);
});

// 12. Google Reviews API (real-time with server-side cache)
router.get('/api/reviews', async (req, res) => {
  try {
    const data = await getGoogleReviews();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, reviews: [], rating: null, totalReviews: 0 });
  }
});

export default router;

