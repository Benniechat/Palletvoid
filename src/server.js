/**
 * Palletvoid E-Commerce Platform — Core Server Application
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { db, initDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ALT_PORT = PORT === 3000 ? 5000 : 3000;

// Ensure database tables exist
initDatabase();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline SVG & styles for seamless design system
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(cookieParser(process.env.SESSION_SECRET || 'palletvoid-secure-session-key'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(path.resolve(__dirname, '../public')));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Simple Secure Session Middleware using signed cookies & database lookup
app.use((req, res, next) => {
  // Guest Cart / Session ID
  let sessionId = req.signedCookies.pv_session;
  if (!sessionId) {
    sessionId = 'pv_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    res.cookie('pv_session', sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });
  }
  req.sessionId = sessionId;

  // Authenticated user lookup
  const authUserId = req.signedCookies.pv_auth_user;
  if (authUserId) {
    try {
      const user = db.prepare('SELECT id, email, full_name, phone, role, is_active FROM users WHERE id = ? AND is_active = 1').get(authUserId);
      if (user) {
        req.user = user;
      } else {
        res.clearCookie('pv_auth_user');
      }
    } catch (err) {
      console.error('[Session Error]', err);
    }
  }

  // Flash messages cookie helper
  const flashMsg = req.signedCookies.pv_flash;
  if (flashMsg) {
    try {
      res.locals.flash = JSON.parse(flashMsg);
      res.clearCookie('pv_flash');
    } catch {
      res.locals.flash = null;
    }
  } else {
    res.locals.flash = null;
  }

  res.locals.user = req.user || null;
  res.locals.appName = 'Palletvoid';
  res.locals.tagline = 'We Think Green, We Think Class, And We Think Creative.';
  res.locals.whatsappUrl = 'https://wa.me/2348024720412';
  res.locals.phone = '+234 802 472 0412';
  res.locals.email = 'mail.palletvoid@gmail.com';
  res.locals.address = '10, Opeyemi Street, Off Ijaiye Bus Stop, Abeokuta Expressway, Ijaiye, Lagos, Nigeria.';

  next();
});

// Flash helper
export function setFlash(res, type, message) {
  res.cookie('pv_flash', JSON.stringify({ type, message }), {
    httpOnly: true,
    signed: true,
    maxAge: 60 * 1000,
    sameSite: 'lax'
  });
}

// Rate Limiter for Authentication & Sensitive forms
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many login or checkout attempts. Please try again later for security.'
});

// Import Modular Routes
import storefrontRoutes from './routes/storefront.js';
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';

app.use('/', storefrontRoutes);
app.use('/cart', cartRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/account', accountRoutes);
app.use('/admin', adminRoutes);
app.use('/webhooks', webhookRoutes);

// 404 Handler
import { renderLayout } from './views/layout.js';
app.use((req, res) => {
  res.status(404).send(renderLayout({
    title: '404 — Page Not Found | Palletvoid',
    user: req.user,
    content: `
      <div class="pv-container pv-section" style="text-align: center; padding: 100px 20px;">
        <h1 style="font-size: 4rem; color: var(--pv-gold); margin-bottom: 1rem;">404</h1>
        <h2 style="font-size: 2rem; margin-bottom: 1.5rem;">Craftsmanship Awaits Elsewhere</h2>
        <p style="color: var(--pv-text-muted); max-width: 500px; margin: 0 auto 2rem;">The item or page you are looking for may have been moved, repurposed, or crafted into something new.</p>
        <a href="/" class="pv-btn pv-btn-primary">Return to Homepage</a>
        <a href="/shop" class="pv-btn pv-btn-outline" style="margin-left: 10px;">Browse Catalog</a>
      </div>
    `
  }));
});

// 500 Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Palletvoid Server Error]:', err);
  res.status(500).send(renderLayout({
    title: 'System Notice | Palletvoid',
    user: req.user,
    content: `
      <div class="pv-container pv-section" style="text-align: center; padding: 100px 20px;">
        <h1 style="font-size: 3rem; color: #b91c1c; margin-bottom: 1rem;">Service Temporarily Unavailable</h1>
        <p style="color: var(--pv-text-muted); max-width: 600px; margin: 0 auto 2rem;">We are fine-tuning our sustainable operations. Our engineers have been alerted and are resolving the issue promptly.</p>
        <a href="/" class="pv-btn pv-btn-primary">Back to Safety</a>
      </div>
    `
  }));
});

const primaryServer = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  PALLETVOID PREMIUM E-COMMERCE PLATFORM`);
  console.log(`  Live URL:      http://localhost:${PORT}`);
  if (ALT_PORT && ALT_PORT !== PORT) {
    console.log(`  Alternate URL: http://localhost:${ALT_PORT}`);
  }
  console.log(`  Environment:   ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Tagline: "We Think Green, We Think Class, And We Think Creative."`);
  console.log(`======================================================\n`);
});

if (ALT_PORT && ALT_PORT !== PORT) {
  try {
    const secondaryServer = app.listen(ALT_PORT, () => {
      // Alternate port bound successfully
    });
    secondaryServer.on('error', () => {
      // Ignore if alt port is in use by another tool
    });
  } catch (e) {
    // Port in use, continue
  }
}

export default app;
