# 🔥 Firepit POS

A full-featured, **offline-first** Point of Sale system for **Fire Pit Tandoori Pizza** — built with React, TypeScript, Electron, and IndexedDB (Dexie). Runs as a desktop app on the shop counter with zero internet dependency.

## Features

**Cashier**
- Fast menu browsing with category groups, search, and quick-edit mode
- Dine-in / Takeaway / Delivery order types, table management
- Modifiers (extra cheese, spice level…), item notes, held orders
- Split payments, discounts, loyalty points (earn & redeem)
- Kitchen Display Screen (KDS) with live order columns
- Receipt printing, delivery + rider assignment

**Admin**
- Dashboard, sales reports, shift management (open/close, cash reconciliation)
- Menu, category, modifier, and recipe management
- Inventory with low-stock alerts
- Customers + loyalty program, expenses, suppliers & payables
- Staff management: roles, PINs, salary, leaves, advances
- Activity log (audit trail of every important action)
- Developer Tools: dedupe, re-index sort orders, **full backup export / import**, factory reset

**Offline-first**
- All data lives in IndexedDB on the machine — no server, no internet needed
- Installable PWA for browser use; packaged Electron `.exe` / portable for the counter

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript + Tailwind CSS 4 |
| State | Zustand |
| Database | Dexie (IndexedDB), versioned schema migrations |
| Charts | Recharts |
| Desktop | Electron 42 + electron-builder (NSIS + portable) |
| PWA | vite-plugin-pwa (Workbox) |
| Lint | Oxlint |

## Getting Started

```bash
npm install
npm run dev          # web dev server → http://localhost:5173
```

### Desktop (Electron)

```bash
npm run electron:dev    # dev: Vite + Electron together
npm run electron:build  # production: builds web + packages Windows installer into release/
```

### Other scripts

```bash
npm run build    # tsc + vite production build
npm run lint     # oxlint (must be 0 warnings)
npm run preview  # preview the production build
```

## First Login

Seeded on first run:

| Portal | Default PIN |
|---|---|
| Admin | `1234` |
| Cashier | `5678` |

Change these immediately after logging in (Admin → Staff, or each portal's profile menu).
Forgot a PIN? The login screen's **Forgot PIN?** flow requires the **recovery code** —
find it in **Admin → Settings → Security** and store it somewhere safe. Only the shop
owner should know it.

## Backup & Restore

**Admin → Developer Tools → Export Backup** downloads a JSON snapshot of *every*
database table. **Import Backup** restores one (replacing all current data, atomically).
Export before any destructive operation. The file contains one-way hashed PINs —
keep it somewhere safe.

## Data & Money Safety

- **Payments are transactional**: order + shift totals + table status + loyalty/discount/rider
  updates are written in a single IndexedDB transaction — a crash mid-payment can't leave
  half-written records.
- **PINs** are SHA-256 hashed (salted) before storage; plaintext PINs never touch the DB.
- **Session restore** is validated against the database — a tampered `localStorage` entry
  can't escalate privileges.
- Currency is whole rupees; tax/discount math is rounded to whole rupees at calculation time.

## Project Structure

```
electron/            Electron main process (window, menu)
src/
  components/
    auth/            Login screen + PIN reset flow
    cashier/         POS terminal (cart, payment, KDS, delivery…)
    admin/           Back-office (dashboard, reports, inventory, HR…)
    ui/              Shared Modal / ConfirmDialog
  db/database.ts     Dexie schema, migrations, seed data, PIN hashing
  store/             Zustand app store (session, cart, order context)
  types/             Shared TypeScript interfaces
  utils/             Currency/date formatting, activity logger
```

## Database Migrations

Schema changes go in `src/db/database.ts` as a new `this.version(N).stores({...})` block —
Dexie migrates existing installs automatically. Never edit an old version block after
it has shipped to a machine.
