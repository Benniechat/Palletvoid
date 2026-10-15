# Palletvoid Platform Architecture & Implementation Plan

## 1. Executive Summary
Palletvoid is Nigeria's foremost pallet crafts and industrial pallet manufacturer based in Ijaiye, Lagos.
This architecture implements a high-performance, robust, modular monolithic platform using:
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js with custom server-side rendering, secure session handling, CSRF guards, and clean modular routers
- **Database**: SQLite / SQL via `better-sqlite3` with transactional integrity, foreign keys, and migration scripts (easily portable to PostgreSQL or MariaDB if required, with zero external server dependencies needed for local and production deployment)
- **Payment Gateway**: Modular Payment Adapter pattern supporting Paystack (with full server-side verification, idempotent webhook processing, and signature validation), Direct Bank Transfer with admin manual verification audit logs, and conditional Payment on Delivery (POD)
- **Security**: OWASP compliant, bcrypt password hashing, HTTP-only secure cookie sessions, parameterized SQL queries, rate limiting, and strict CSRF protection
- **UI/UX**: Custom refined design system honoring the Palletvoid brand colors (#C18A4A warm gold, #5D9B4C eco green, #000000 charcoal black, warm ivory and natural wood textures) with full responsive mobile-first navigation and native components.

## 2. Core Modules
1. **Authentication & RBAC**: Roles (Super Admin, Store Manager, Order Manager, Inventory Manager, Customer). Password reset tokens, registration, guest session cart merging.
2. **Product & Inventory Engine**: Products with SKUs, variations (dimensions, finish, material), categories, stock reservations, made-to-order lead times, low stock warnings, and stock movement logs.
3. **Cart & Checkout**: Server-calculated pricing, shipping zones (Lagos Mainland, Lagos Island, Ogun, Interstate, Bulk Freight), coupon discounts, idempotent checkout orders.
4. **Payment System**: Adapter interface (`PaymentAdapter`), Paystack implementation, Bank Transfer confirmation audit trail, POD eligibility rule evaluation.
5. **Administration Suite**: Real-time sales metrics, product and variation management, image uploads, order fulfilment pipeline, refund and cancellation workflow, content management (announcements, partners, FAQs, policies), and store settings.
6. **Customer Portal**: Account profile, multiple delivery addresses, order history, track order status, and wishlist.
