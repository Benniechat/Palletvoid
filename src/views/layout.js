/**
 * Global SSR Layout Template for Palletvoid
 */
import { getCartCount } from '../services/cartService.js';
import { db } from '../database.js';

export function formatNaira(kobo) {
  if (kobo === null || kobo === undefined) return '₦0';
  const naira = kobo / 100;
  return '₦' + naira.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function renderLayout({ title, content, user, req, activeNav = '', extraHead = '', extraScripts = '' }) {
  const cartCount = req ? getCartCount(req.sessionId, user ? user.id : null) : 0;
  
  // Get announcement bar setting
  let announcementEnabled = '1';
  let announcementText = '✨ Nationwide Delivery Available | Custom Furniture Enquiries Open | Call/WhatsApp: +234 802 472 0412';
  try {
    const sEnabled = db.prepare('SELECT value FROM store_settings WHERE key = ?').get('announcement_bar_enabled');
    const sText = db.prepare('SELECT value FROM store_settings WHERE key = ?').get('announcement_bar_text');
    if (sEnabled) announcementEnabled = sEnabled.value;
    if (sText) announcementText = sText.value;
  } catch {}

  const flash = req && req.signedCookies ? (req.signedCookies.pv_flash ? JSON.parse(req.signedCookies.pv_flash) : null) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Palletvoid — Nigeria Foremost Pallet Crafts & Industrial Pallets'}</title>
  <meta name="description" content="Handcrafted rustic & modern pallet furniture, platform beds, coffee tables, standing desks, plus certified industrial Euro wooden & plastic pallets in Lagos, Nigeria.">
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/logo.png">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
  
  <!-- Stylesheet -->
  <link rel="stylesheet" href="/css/palletvoid.css">

  <!-- Critical Preloader CSS (Zero White Flash on Initial Visit & Refresh) -->
  <style id="pv-preloader-critical-css">
    .pv-page-preloader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, #1E1A14 0%, #0F0E0C 100%);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 1;
      visibility: visible;
      transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s ease;
      pointer-events: all;
    }
    .pv-page-preloader.pv-preloader-hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
  </style>
  
  ${extraHead}
</head>
<body>

  <!-- Global Animated Page Transition Overlay (Palletvoid) -->
  <div id="pv-page-preloader" class="pv-page-preloader" aria-hidden="false">
    <div class="pv-preloader-content">
      <div class="pv-preloader-logo-wrap">
        <img src="/logo.png" alt="Palletvoid" class="pv-preloader-logo">
        <div class="pv-preloader-ring"></div>
      </div>
      <div class="pv-preloader-text">
        <span class="pv-preloader-brand">PALLETVOID</span>
        <span class="pv-preloader-tagline">Eco-Luxury Timber Crafts &amp; Industrial Logistics</span>
      </div>
      <div class="pv-preloader-bar">
        <div class="pv-preloader-progress"></div>
      </div>
    </div>
  </div>

  <!-- Announcement Bar -->
  ${announcementEnabled === '1' ? `
  <div class="pv-announcement">
    <div class="pv-container">
      ${announcementText}
    </div>
  </div>
  ` : ''}

  <!-- Header -->
  <header class="pv-header">
    <div class="pv-container pv-header-inner">
      <a href="/" class="pv-logo-link" title="Palletvoid — Home">
        <img src="/logo.png" alt="Palletvoid Logo" class="pv-logo-img">
      </a>

      <!-- Navigation Menu (Desktop & Mobile Drawer) -->
      <nav id="pv-nav" class="pv-nav">
        <ul class="pv-nav-menu">
          <li><a href="/" class="pv-nav-link ${activeNav === 'home' ? 'active' : ''}">Home</a></li>
          <li><a href="/shop" class="pv-nav-link ${activeNav === 'shop' ? 'active' : ''}">Shop All</a></li>
          <li><a href="/category/furniture" class="pv-nav-link ${activeNav === 'furniture' ? 'active' : ''}">Furniture</a></li>
          <li><a href="/category/industrial" class="pv-nav-link ${activeNav === 'industrial' ? 'active' : ''}">Industrial Supply</a></li>
          <li><a href="/custom-order" class="pv-nav-link ${activeNav === 'custom' ? 'active' : ''}">Custom Orders</a></li>
          <li><a href="/sustainability" class="pv-nav-link ${activeNav === 'sustainability' ? 'active' : ''}">Craftsmanship</a></li>
          <li><a href="/about" class="pv-nav-link ${activeNav === 'about' ? 'active' : ''}">About</a></li>
          <li><a href="/contact" class="pv-nav-link ${activeNav === 'contact' ? 'active' : ''}">Contact</a></li>
        </ul>
      </nav>

      <!-- Header Quick Actions -->
      <div class="pv-header-actions">
        <!-- Search form trigger -->
        <a href="/shop" class="pv-header-icon-btn" title="Search Products" aria-label="Search">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </a>

        <!-- Wishlist -->
        <a href="/wishlist" class="pv-header-icon-btn" title="Wishlist" aria-label="Wishlist">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
        </a>

        <!-- Cart with Live Count Badge -->
        <a href="/cart" class="pv-header-icon-btn" title="Shopping Cart" aria-label="Cart">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          <span class="pv-badge" id="cart-counter">${cartCount}</span>
        </a>

        <!-- Account / Login -->
        ${user ? `
          <div style="position: relative; display: inline-block;">
            <a href="${user.role === 'customer' ? '/account' : '/admin'}" class="pv-btn pv-btn-outline pv-btn-sm pv-auth-btn" style="padding: 6px 14px;">
              ${user.role !== 'customer' ? 'Admin Portal' : 'My Account'}
            </a>
          </div>
        ` : `
          <a href="/auth/login" class="pv-btn pv-btn-primary pv-btn-sm pv-auth-btn" style="padding: 6px 14px;">Sign In</a>
        `}

        <!-- Mobile Hamburger Toggle Button -->
        <button class="pv-mobile-menu-btn" id="pv-mobile-menu-btn" aria-label="Toggle navigation menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </header>

  <!-- Flash Notification (if present) -->
  ${flash ? `
    <div class="pv-container" style="margin-top: 15px;">
      <div style="padding: 12px 18px; border-radius: 6px; background-color: ${flash.type === 'error' ? '#FEE2E2' : '#DEF7EC'}; color: ${flash.type === 'error' ? '#991B1B' : '#03543F'}; border: 1px solid ${flash.type === 'error' ? '#F87171' : '#31C48D'};">
        ${flash.message}
      </div>
    </div>
  ` : ''}

  <!-- Main View Content -->
  <main id="main-content">
    ${content}
  </main>

  <!-- Floating WhatsApp Contact Button -->
  <a href="https://wa.me/2348024720412?text=Hello%20Palletvoid,%20I%20would%20like%20to%20enquire%20about%20your%20products." 
     class="pv-whatsapp-float" 
     target="_blank" 
     rel="noopener noreferrer" 
     title="Chat with Palletvoid on WhatsApp"
     aria-label="Chat with Palletvoid on WhatsApp">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.956.564 3.784 1.542 5.336L2 22l4.781-1.516A9.97 9.97 0 0012.031 22C17.567 22 22 17.505 22 12.031 22 6.495 17.567 2 12.031 2zm5.787 14.283c-.244.686-1.42 1.299-1.969 1.344-.549.046-1.253.076-4.045-1.077-3.359-1.388-5.503-4.811-5.672-5.039-.168-.229-1.371-1.826-1.371-3.483 0-1.657.868-2.471 1.173-2.806.305-.335.67-.427.899-.427.228 0 .457.003.655.013.213.01.499-.081.777.587.29.697.99 2.41 1.077 2.585.087.175.145.38.03.61-.114.229-.173.372-.344.572-.172.2-.361.447-.516.6-.172.172-.351.359-.151.702.2.343.889 1.464 1.907 2.371 1.31 1.167 2.415 1.529 2.758 1.7.343.172.544.143.744-.087.2-.229.858-1.002 1.087-1.345.229-.343.457-.286.772-.172.315.114 2.001.944 2.344 1.116.343.171.572.257.658.4.086.143.086.829-.158 1.515z"/>
    </svg>
  </a>

  <!-- Global Footer -->
  <footer class="pv-footer">
    <div class="pv-container">
      <div class="pv-footer-grid">
        <!-- Col 1: Brand Info -->
        <div class="pv-footer-col">
          <img src="/logo.png" alt="Palletvoid" style="height: 55px; margin-bottom: 18px; filter: brightness(1.1);">
          <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 15px;">
            Nigeria’s foremost pallet crafts store. We blend eco-conscious upcycled timber with master craftsmanship to deliver luxury furniture and certified industrial logistics pallets.
          </p>
          <p style="color: var(--pv-gold); font-size: 0.9rem; font-weight: 600; font-style: italic;">
            “We Think Green, We Think Class, And We Think Creative.”
          </p>
        </div>

        <!-- Col 2: Furniture Categories -->
        <div class="pv-footer-col">
          <h4>Furniture</h4>
          <ul class="pv-footer-links">
            <li><a href="/category/coffee-tables">Coffee Tables</a></li>
            <li><a href="/category/pallet-beds">Pallet Beds</a></li>
            <li><a href="/category/pallet-desks">Pallet Desks</a></li>
            <li><a href="/category/standing-desks">Standing Desks</a></li>
            <li><a href="/category/console-units">Console Units</a></li>
            <li><a href="/category/home-decor">Home Décor & Lamps</a></li>
          </ul>
        </div>

        <!-- Col 3: Industrial & Policies -->
        <div class="pv-footer-col">
          <h4>Industrial Supply</h4>
          <ul class="pv-footer-links">
            <li><a href="/category/wooden-pallets">Euro Wooden Pallets</a></li>
            <li><a href="/category/plastic-pallets">Plastic Pallets (HDPE)</a></li>
            <li><a href="/category/fruit-crates">Fruit & Agro Crates</a></li>
            <li><a href="/shipping-policy">Shipping & Delivery</a></li>
            <li><a href="/returns-policy">Returns & Refunds</a></li>
            <li><a href="/terms">Terms & Conditions</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
          </ul>
        </div>

        <!-- Col 4: Contact & Workshop Location -->
        <div class="pv-footer-col">
          <h4>Workshop & Showroom</h4>
          <p style="font-size: 0.92rem; color: #AFAAA0; margin-bottom: 12px; line-height: 1.6;">
            📍 10, Opeyemi Street, Off Ijaiye Bus Stop, Abeokuta Expressway, Ijaiye, Lagos, Nigeria.
          </p>
          <p style="font-size: 0.92rem; color: #AFAAA0; margin-bottom: 10px;">
            📞 <a href="tel:+2348024720412" style="color: #FFFFFF;">+234 802 472 0412</a>
          </p>
          <p style="font-size: 0.92rem; color: #AFAAA0; margin-bottom: 20px;">
            ✉️ <a href="mailto:mail.palletvoid@gmail.com" style="color: #FFFFFF;">mail.palletvoid@gmail.com</a>
          </p>
          <div style="display: flex; gap: 12px; font-size: 1.1rem;">
            <a href="https://instagram.com/palletvoid" target="_blank" rel="noopener noreferrer" style="color: var(--pv-gold);" title="Instagram">Instagram</a> •
            <a href="https://facebook.com/palletvoid" target="_blank" rel="noopener noreferrer" style="color: var(--pv-gold);" title="Facebook">Facebook</a> •
            <a href="https://twitter.com/palletvoid" target="_blank" rel="noopener noreferrer" style="color: var(--pv-gold);" title="Twitter / X">X</a>
          </div>
        </div>
      </div>

      <div class="pv-footer-bottom">
        <div>
          &copy; ${new Date().getFullYear()} Palletvoid Global Resources. All rights reserved.
        </div>
        <div style="display: flex; gap: 20px;">
          <span>Registered in Nigeria</span>
          <span>Secured with 256-bit SSL</span>
          <span>Paystack Verified Gateway</span>
        </div>
      </div>
    </div>
  </footer>

  <!-- Page Transitions & Client Interactivity -->
  <script src="/js/page-transitions.js"></script>
  ${extraScripts}
</body>
</html>`;
}
