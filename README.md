# Palletvoid — Production Deployment & Administrator Runbook

Welcome to the **Palletvoid** complete e-commerce platform codebase.

---

## 1. System Requirements & Architecture
- **Runtime**: Node.js v18+ (tested & verified on Node v24)
- **Database**: SQLite (via `better-sqlite3` with Write-Ahead Logging `WAL` mode) — zero external database dependencies or complex setup required. Portable to MySQL/MariaDB or PostgreSQL if desired.
- **Port**: Default `5000` (configurable via `PORT` environment variable)
- **Official Brand Assets**: Embedded in `/public/logo.png` (using Palletvoid's official pallet craft insignia and tagline *"...see the pallet, feel the shine"*).

---

## 2. Quick Installation & Launch (Local / VPS / cPanel / Docker)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Initialize Database and Seed Sample Products
```bash
npm run seed
```
This automatically sets up all 13 furniture and industrial categories, realistic products with pricing in Kobo, Lagos shipping zones, store settings, and default administrator accounts.

### Step 3: Run Automated Test Suite
```bash
npm test
```
All 7 mission-critical commerce tests (stock reservation, idempotency, cart calculation, payment verification, and audit logs) will execute and pass.

### Step 4: Start the Server
```bash
# Production Mode:
npm start

# Development Watch Mode:
npm run dev
```
Visit `http://localhost:5000` in your browser.

---

## 3. Administrative Credentials & Access

Navigate to `http://localhost:5000/auth/login`:

- **Super Administrator**:
  - Email: `admin@palletvoid.com`
  - Password: `PalletvoidAdmin2026!`
- **Store Operations Manager**:
  - Email: `manager@palletvoid.com`
  - Password: `Manager2026!`
- **Sample Customer Account**:
  - Email: `customer@example.com`
  - Password: `Customer2026!`

*(Note: Change these passwords immediately in production via the account dashboard or admin tools).*

---

## 4. Payment Gateway & Bank Account Setup

### Paystack Live Configuration:
In your `.env` file:
```env
PAYMENT_MODE=live
PAYSTACK_SECRET_KEY=your_paystack_secret_key_here
PAYSTACK_PUBLIC_KEY=your_paystack_public_key_here
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret_here
```
- Set your Webhook URL in your Paystack Dashboard:
  `https://yourdomain.com/webhooks/paystack`

### Direct Bank Transfer Configuration:
Default configuration has been pre-set for UBA Bank:
- Account Name: **Palletvoid Global Resources**
- Account Number: **1025214241**
- Bank: **UBA Bank**

These can be toggled and updated live anytime in **Admin Hub &rarr; Store Settings** without restarting the application.

---

## 5. Security Checklist
- [x] Passwords hashed using bcrypt with salt rounds.
- [x] Signed, HTTP-only session cookies with CSRF and rate-limiting guards.
- [x] All database queries use parameterized prepared statements (SQL injection immune).
- [x] All monetary amounts stored as integer Kobo (eliminating IEEE 754 float rounding bugs).
- [x] Safe inventory decrement transactions with rollback on order failure.
