/**
 * Customer Authentication Router
 * Registration, Login, Logout, Password Reset, Guest Cart Merging
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../database.js';
import { renderLayout } from '../views/layout.js';
import { setFlash } from '../server.js';
import { mergeGuestCartIntoUser } from '../services/cartService.js';

const router = express.Router();

// 1. Login Page
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/account');

  const content = `
    <div class="pv-container pv-section" style="max-width: 480px;">
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm);">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="/logo.png" alt="Palletvoid" style="height: 48px; margin: 0 auto 15px;">
          <h1 style="font-size: 1.6rem; margin-bottom: 8px;">Customer Sign In</h1>
          <p style="font-size: 0.9rem; color: var(--pv-text-muted);">Access your orders, saved addresses, and wishlist</p>
        </div>

        <form action="/auth/login" method="POST">
          <div class="pv-form-group">
            <label class="pv-form-label">Email Address *</label>
            <input type="email" name="email" class="pv-input" required placeholder="your.email@example.com">
          </div>

          <div class="pv-form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label class="pv-form-label" style="margin-bottom: 0;">Password *</label>
              <a href="/auth/forgot-password" style="font-size: 0.8rem; color: var(--pv-gold);">Forgot password?</a>
            </div>
            <input type="password" name="password" class="pv-input" required placeholder="••••••••">
          </div>

          <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; padding: 13px; margin-top: 10px;">
            Sign In to Account
          </button>
        </form>

        <div style="margin-top: 25px; text-align: center; font-size: 0.9rem; border-top: 1px solid var(--pv-border); padding-top: 20px;">
          New to Palletvoid? <a href="/auth/register" style="color: var(--pv-gold); font-weight: 600;">Create an Account</a>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Customer Sign In | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// Process Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      setFlash(res, 'error', 'Invalid email address or password.');
      return res.redirect('/auth/login');
    }

    if (!user.is_active) {
      setFlash(res, 'error', 'This account has been deactivated. Please contact support.');
      return res.redirect('/auth/login');
    }

    // Set signed auth cookie
    res.cookie('pv_auth_user', user.id, {
      httpOnly: true,
      signed: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    // Merge Guest Cart into User Cart
    mergeGuestCartIntoUser(req.sessionId, user.id);

    setFlash(res, 'success', `Welcome back, ${user.full_name}!`);
    if (user.role !== 'customer') {
      res.redirect('/admin');
    } else {
      res.redirect('/account');
    }
  } catch (err) {
    console.error('[Login Error]', err);
    setFlash(res, 'error', 'An error occurred during authentication.');
    res.redirect('/auth/login');
  }
});

// 2. Registration Page
router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/account');

  const content = `
    <div class="pv-container pv-section" style="max-width: 540px;">
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm);">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="/logo.png" alt="Palletvoid" style="height: 48px; margin: 0 auto 15px;">
          <h1 style="font-size: 1.6rem; margin-bottom: 8px;">Create Palletvoid Account</h1>
          <p style="font-size: 0.9rem; color: var(--pv-text-muted);">Join Nigeria's foremost pallet crafts community</p>
        </div>

        <form action="/auth/register" method="POST">
          <div class="pv-form-group">
            <label class="pv-form-label">Full Name *</label>
            <input type="text" name="fullName" class="pv-input" required placeholder="Adeyemi Johnson">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Email Address *</label>
            <input type="email" name="email" class="pv-input" required placeholder="adeyemi@example.com">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Nigerian Phone Number *</label>
            <input type="tel" name="phone" class="pv-input" required placeholder="+234 803 123 4567">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Delivery Street Address</label>
            <input type="text" name="address" class="pv-input" placeholder="Plot 14, Admiralty Way, Lekki Phase 1">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="pv-form-group">
              <label class="pv-form-label">City / Town</label>
              <input type="text" name="city" class="pv-input" placeholder="Lekki">
            </div>
            <div class="pv-form-group">
              <label class="pv-form-label">State</label>
              <input type="text" name="state" class="pv-input" value="Lagos" placeholder="Lagos">
            </div>
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Password (Minimum 8 Characters) *</label>
            <input type="password" name="password" class="pv-input" required minlength="8" placeholder="••••••••">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Confirm Password *</label>
            <input type="password" name="confirmPassword" class="pv-input" required minlength="8" placeholder="••••••••">
          </div>

          <div style="margin-bottom: 20px; font-size: 0.85rem; color: var(--pv-text-muted);">
            <label style="display: flex; gap: 10px; align-items: flex-start; cursor: pointer;">
              <input type="checkbox" required style="margin-top: 3px;">
              <span>I agree to Palletvoid's <a href="/terms" target="_blank" style="color: var(--pv-gold);">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" style="color: var(--pv-gold);">Privacy Policy</a>.</span>
            </label>
          </div>

          <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; padding: 13px;">
            Register Account
          </button>
        </form>

        <div style="margin-top: 25px; text-align: center; font-size: 0.9rem; border-top: 1px solid var(--pv-border); padding-top: 20px;">
          Already have an account? <a href="/auth/login" style="color: var(--pv-gold); font-weight: 600;">Sign In</a>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Customer Registration | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// Process Registration
router.post('/register', (req, res) => {
  const { fullName, email, phone, address, city, state, password, confirmPassword } = req.body;

  try {
    if (password !== confirmPassword) {
      setFlash(res, 'error', 'Passwords do not match.');
      return res.redirect('/auth/register');
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      setFlash(res, 'error', 'An account with this email address already exists.');
      return res.redirect('/auth/register');
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified)
      VALUES (?, ?, ?, ?, 'customer', 1, 0)
    `).run(cleanEmail, hash, fullName.trim(), phone.trim());

    const newUserId = result.lastInsertRowid;

    // Save default address if provided
    if (address && city) {
      db.prepare(`
        INSERT INTO customer_addresses (user_id, label, recipient_name, phone, street_address, city, state, is_default)
        VALUES (?, 'Primary', ?, ?, ?, ?, ?, 1)
      `).run(newUserId, fullName.trim(), phone.trim(), address.trim(), city.trim(), state || 'Lagos');
    }

    // Set signed auth cookie
    res.cookie('pv_auth_user', newUserId, {
      httpOnly: true,
      signed: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    // Merge cart
    mergeGuestCartIntoUser(req.sessionId, newUserId);

    setFlash(res, 'success', 'Your account has been created successfully!');
    res.redirect('/account');
  } catch (err) {
    console.error('[Registration Error]', err);
    setFlash(res, 'error', 'Registration could not be completed.');
    res.redirect('/auth/register');
  }
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('pv_auth_user');
  setFlash(res, 'success', 'You have been signed out safely.');
  res.redirect('/auth/login');
});

// 3. Forgot Password Page
router.get('/forgot-password', (req, res) => {
  const content = `
    <div class="pv-container pv-section" style="max-width: 480px;">
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm);">
        <div style="text-align: center; margin-bottom: 25px;">
          <img src="/logo.png" alt="Palletvoid" style="height: 48px; margin: 0 auto 15px;">
          <h1 style="font-size: 1.6rem; margin-bottom: 8px;">Reset Your Password</h1>
          <p style="font-size: 0.9rem; color: var(--pv-text-muted);">Enter your registered account email to receive a password reset link.</p>
        </div>

        <form action="/auth/forgot-password" method="POST">
          <div class="pv-form-group">
            <label class="pv-form-label">Account Email Address *</label>
            <input type="email" name="email" class="pv-input" required placeholder="your.email@example.com">
          </div>

          <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; padding: 13px; margin-top: 10px;">
            Send Password Reset Link
          </button>
        </form>

        <div style="margin-top: 25px; text-align: center; font-size: 0.9rem; border-top: 1px solid var(--pv-border); padding-top: 20px;">
          Remembered your password? <a href="/auth/login" style="color: var(--pv-gold); font-weight: 600;">Sign In</a>
        </div>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Reset Password | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// Process Forgot Password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      // Set token with 2-hour expiration
      db.prepare(`
        UPDATE users 
        SET reset_token = ?, reset_token_expires = datetime('now', '+2 hours') 
        WHERE id = ?
      `).run(token, user.id);

      const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password?token=${token}`;

      const content = `
        <div class="pv-container pv-section" style="max-width: 520px;">
          <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm); text-align: center;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--pv-green-light); color: var(--pv-green); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 15px;">
              ✔
            </div>
            <h2 style="font-size: 1.5rem; margin-bottom: 12px;">Password Reset Link Ready</h2>
            <p style="font-size: 0.92rem; color: var(--pv-text-muted); line-height: 1.6; margin-bottom: 25px;">
              A secure password reset token has been generated for <strong>${user.email}</strong>.
            </p>

            <div style="background: var(--pv-surface-alt); padding: 18px; border-radius: var(--pv-radius); border: 1px solid var(--pv-border); margin-bottom: 25px; word-break: break-all; font-family: monospace; font-size: 0.85rem;">
              <a href="/auth/reset-password?token=${token}" style="color: var(--pv-gold); text-decoration: underline; font-weight: bold;">
                Click here to set your new password &rarr;
              </a>
            </div>

            <a href="/auth/reset-password?token=${token}" class="pv-btn pv-btn-primary" style="width: 100%; padding: 12px;">
              Proceed to Change Password
            </a>
          </div>
        </div>
      `;

      return res.send(renderLayout({
        title: 'Reset Password Sent | Palletvoid',
        content,
        user: req.user,
        req
      }));
    }

    setFlash(res, 'error', 'If an account with that email exists, a password reset link has been provided.');
    res.redirect('/auth/forgot-password');
  } catch (err) {
    console.error('[Forgot Password Error]', err);
    setFlash(res, 'error', 'An error occurred. Please try again.');
    res.redirect('/auth/forgot-password');
  }
});

// 4. Reset Password Page (with Token)
router.get('/reset-password', (req, res) => {
  const { token } = req.query;

  if (!token) {
    setFlash(res, 'error', 'Invalid or missing password reset token.');
    return res.redirect('/auth/login');
  }

  const user = db.prepare(`
    SELECT * FROM users 
    WHERE reset_token = ? AND reset_token_expires > datetime('now')
  `).get(token);

  if (!user) {
    setFlash(res, 'error', 'This password reset link is invalid or has expired. Please request a new one.');
    return res.redirect('/auth/forgot-password');
  }

  const content = `
    <div class="pv-container pv-section" style="max-width: 480px;">
      <div style="background: #FFFFFF; border: 1px solid var(--pv-border); border-radius: var(--pv-radius); padding: 40px; box-shadow: var(--pv-shadow-sm);">
        <div style="text-align: center; margin-bottom: 25px;">
          <img src="/logo.png" alt="Palletvoid" style="height: 48px; margin: 0 auto 15px;">
          <h1 style="font-size: 1.6rem; margin-bottom: 8px;">Set New Password</h1>
          <p style="font-size: 0.9rem; color: var(--pv-text-muted);">Create a new password for <strong>${user.email}</strong></p>
        </div>

        <form action="/auth/reset-password" method="POST">
          <input type="hidden" name="token" value="${token}">

          <div class="pv-form-group">
            <label class="pv-form-label">New Password (min 8 characters) *</label>
            <input type="password" name="password" class="pv-input" required minlength="8" placeholder="••••••••" autocomplete="new-password">
          </div>

          <div class="pv-form-group">
            <label class="pv-form-label">Confirm New Password *</label>
            <input type="password" name="confirmPassword" class="pv-input" required minlength="8" placeholder="••••••••" autocomplete="new-password">
          </div>

          <button type="submit" class="pv-btn pv-btn-primary" style="width: 100%; padding: 13px; margin-top: 10px;">
            Save New Password
          </button>
        </form>
      </div>
    </div>
  `;

  res.send(renderLayout({
    title: 'Set New Password | Palletvoid',
    content,
    user: req.user,
    req
  }));
});

// Process Reset Password
router.post('/reset-password', (req, res) => {
  const { token, password, confirmPassword } = req.body;

  try {
    if (!token || !password || !confirmPassword) {
      throw new Error('All fields are required.');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters in length.');
    }

    const user = db.prepare(`
      SELECT * FROM users 
      WHERE reset_token = ? AND reset_token_expires > datetime('now')
    `).get(token);

    if (!user) {
      throw new Error('Password reset link is invalid or has expired.');
    }

    const newHash = bcrypt.hashSync(password, 10);
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newHash, user.id);

    setFlash(res, 'success', 'Your password has been reset successfully! You can now sign in.');
    res.redirect('/auth/login');
  } catch (err) {
    setFlash(res, 'error', err.message);
    res.redirect(token ? `/auth/reset-password?token=${encodeURIComponent(token)}` : '/auth/forgot-password');
  }
});

export default router;
