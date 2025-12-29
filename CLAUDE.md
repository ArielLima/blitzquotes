# BlitzQuotes

AI-powered quoting app for contractors. Send professional quotes in 60 seconds.

**Domain:** blitzquotes.com

## Overview

BlitzQuotes helps solo and small trade contractors (plumbers, HVAC, electricians, etc.) create and send quotes fast. Describe the job, get a complete quote with line items and pricing, send to customer, get paid.

**Two ways to build quotes:**
1. **Search mode** - Search BlitzPrices database directly, pick items, done (no AI)
2. **AI mode** - Describe job, AI figures out what's needed, prices from database

**Target users:** Solo contractors and small shops (1-5 employees) who currently use paper, Notes app, or spreadsheets for quotes.

## The Problem

- 45% of small contractors still use paper/spreadsheets for quotes
- Creating a quote takes 20-30 minutes (lookup prices, calculate, format)
- Quotes look unprofessional (scribbled notes, plain text messages)
- Contractors forget to include materials, permits, or markup
- No easy way to track what's been sent, viewed, or paid

## The Solution

1. Describe the job in plain English: "Replace 50 gallon gas water heater"
2. App finds materials from BlitzPrices + AI suggests quantities
3. Apply your labor rate and markup automatically
4. Contractor adjusts if needed, taps Send
5. Customer gets professional quote link, can pay directly
6. Contractor tracks status: sent → viewed → paid

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | React Native with Expo + Expo Router |
| State | Zustand |
| Backend/DB | Supabase (Auth + Postgres + Realtime) |
| Pricing Data | BlitzPrices (crowdsourced database) |
| AI | OpenRouter (gpt-4o-mini) - for reasoning only |
| Payments | Bring Your Own (Venmo, PayPal, Zelle, etc.) — Stripe recommended |
| Customer Quote View | Next.js on Vercel (or Supabase Edge Function) |

---

## BlitzPrices Integration

BlitzQuotes is powered by BlitzPrices - an open, crowdsourced pricing database.

See `/blitzprices/CLAUDE.md` for full details.

### How it works:

```
BlitzPrices provides: Material/equipment COSTS (what you pay)
User Settings provide: Labor rate + markup (your business decisions)
Math provides:         Customer prices (cost × markup)
```

### Two quote-building modes:

#### Mode 1: Search (No AI, instant)
```
User searches: "water heater"
         ↓
BlitzPrices returns:
  - 50 Gallon Gas Water Heater ($485)
  - 50 Gallon Electric Water Heater ($425)
         ↓
User picks one, sets qty
         ↓
App applies markup from settings
         ↓
Done. Zero tokens.
```

#### Mode 2: AI-Assisted (minimal tokens)
```
User: "Install 50 gal water heater in garage"
         ↓
Step 1: BlitzPrices search for "water heater" → Found: $485
         ↓
Step 2: Small AI call (reasoning only):
   "Job: Install water heater
    Found: water heater $485
    What qty and labor hours needed?
    What else might be needed?"
         ↓
AI: { qty: 1, labor_hours: 3, extras: ["permit", "disposal"] }
         ↓
Step 3: BlitzPrices lookup for extras
         ↓
Step 4: Apply user's labor rate + markup
         ↓
Final quote assembled
```

**Token savings:** ~200-400 tokens vs 2,000-5,000 with old approach.

---

## Core Features (MVP)

### 1. Onboarding
- Select trade (plumbing, HVAC, electrical, general)
- Enter business name + ZIP code
- Set labor rate and markup
- Pricebook builds over time from quotes (not upfront)

### 2. Pricebook
- User's catalog of items with costs
- Categories: materials, equipment, fees (NOT labor - that's in settings)
- Snap price tags to add items quickly
- Auto-submits to BlitzPrices (anonymized)

### 3. Quote Builder
- **Search mode**: Search items directly, pick and add
- **AI mode**: Describe job, get suggestions
- Prices from BlitzPrices, labor from settings
- Auto-calculates with markup and tax
- Add customer name/phone

### 4. Send & Track
- Generate shareable link
- Send via SMS or copy link
- Track status: draft → sent → viewed → paid
- Mark as paid manually

### 5. Settings
- **Business info**: Name, phone, email, address
- **Labor rate**: Your hourly rate (e.g., $150/hr)
- **Markup**: Material markup % (e.g., 35%)
- **Tax rate**: Default tax % (e.g., 8%)
- **Payment method**: Stripe, Venmo, PayPal, etc.

---

## Data Model

```typescript
// Pricebook Item (user's local items)
interface PricebookItem {
  id: string;
  user_id: string;
  name: string;
  category: 'materials' | 'equipment' | 'fees';  // NOT labor
  unit: string;
  cost: number;           // what contractor pays
  // NO price field - calculated from cost × markup
  default_qty: number;
  source?: 'manual' | 'price_tag_scan' | 'blitzprices';
  created_at: timestamp;
}

// Quote
interface Quote {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  job_description: string;
  line_items: LineItem[];
  labor_hours: number;
  labor_rate: number;      // snapshot from settings at quote time
  labor_total: number;
  materials_subtotal: number;
  markup_percent: number;  // snapshot from settings
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid';
  created_at: timestamp;
  sent_at?: timestamp;
  viewed_at?: timestamp;
  paid_at?: timestamp;
}

interface LineItem {
  pricebook_item_id?: string;
  name: string;
  category: 'materials' | 'equipment' | 'fees';
  qty: number;
  unit: string;
  cost: number;         // cost per unit
  unit_price: number;   // cost × (1 + markup)
  total: number;        // qty × unit_price
  source: 'pricebook' | 'blitzprices' | 'ai_estimate';
}

// User Settings
interface UserSettings {
  user_id: string;

  // Business info
  business_name: string;
  business_phone?: string;
  business_email?: string;
  business_address?: string;
  state?: string;              // For BlitzPrices region
  zip_code?: string;
  logo_url?: string;
  trade: string;

  // Pricing settings (KEY - these drive quote pricing)
  labor_rate: number;          // $/hr (e.g., 150)
  helper_rate?: number;        // $/hr for helper (optional)
  material_markup: number;     // decimal (e.g., 0.35 for 35%)
  equipment_markup?: number;   // if different from materials
  fee_markup?: number;         // if different (often 0)

  // Tax
  default_tax_rate: number;    // decimal (e.g., 0.08 for 8%)

  // Payment
  payment_method: string;
  payment_link?: string;
  payment_details?: string;

  // Community
  contribute_to_blitzprices: boolean;  // default true

  created_at: timestamp;
  updated_at: timestamp;
}
```

---

## Supabase Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pricebook items (user's local items)
CREATE TABLE pricebook_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'materials',  -- materials, equipment, fees
  unit TEXT NOT NULL DEFAULT 'each',
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  default_qty NUMERIC(10,2) NOT NULL DEFAULT 1,
  source TEXT DEFAULT 'manual',  -- manual, price_tag_scan, blitzprices
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  job_description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  labor_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  labor_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  labor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  materials_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  markup_percent NUMERIC(5,4) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

-- User settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users,

  -- Business info
  business_name TEXT,
  business_phone TEXT,
  business_email TEXT,
  business_address TEXT,
  state TEXT,
  zip_code TEXT,
  logo_url TEXT,
  trade TEXT NOT NULL DEFAULT 'general',

  -- Pricing (KEY FIELDS)
  labor_rate NUMERIC(10,2) NOT NULL DEFAULT 100,
  helper_rate NUMERIC(10,2),
  material_markup NUMERIC(5,4) NOT NULL DEFAULT 0.35,
  equipment_markup NUMERIC(5,4),
  fee_markup NUMERIC(5,4) DEFAULT 0,

  -- Tax
  default_tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,

  -- Payment
  payment_method TEXT DEFAULT 'none',
  payment_link TEXT,
  payment_details TEXT,

  -- Community
  contribute_to_blitzprices BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE pricebook_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own pricebook items"
  ON pricebook_items FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own quotes"
  ON quotes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own settings"
  ON user_settings FOR ALL USING (auth.uid() = user_id);

-- Public read for quotes (for customer view)
CREATE POLICY "Anyone can view quotes by ID"
  ON quotes FOR SELECT USING (TRUE);

-- Public read for user settings (for customer quote view)
CREATE POLICY "Anyone can view user settings"
  ON user_settings FOR SELECT USING (TRUE);
```

---

## Quote Price Calculation

```typescript
function calculateQuoteTotal(
  lineItems: LineItem[],
  laborHours: number,
  settings: UserSettings
): QuoteTotals {
  // Materials/equipment/fees subtotal (already has markup applied per item)
  const materialsSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  // Labor total
  const laborTotal = laborHours * settings.labor_rate;

  // Subtotal
  const subtotal = materialsSubtotal + laborTotal;

  // Tax (usually on materials only, not labor - varies by state)
  const taxableAmount = materialsSubtotal; // or subtotal depending on state
  const tax = taxableAmount * settings.default_tax_rate;

  // Total
  const total = subtotal + tax;

  return { materialsSubtotal, laborTotal, subtotal, tax, total };
}

function calculateItemPrice(cost: number, category: string, settings: UserSettings): number {
  const markup =
    category === 'equipment' ? (settings.equipment_markup ?? settings.material_markup) :
    category === 'fees' ? (settings.fee_markup ?? 0) :
    settings.material_markup;

  return cost * (1 + markup);
}
```

---

## AI Integration (Minimal)

AI is used for **reasoning only**, not price lookups:

```typescript
async function generateQuoteSuggestions(
  jobDescription: string,
  foundItems: BlitzPricesResult[],
  settings: UserSettings
): Promise<QuoteSuggestion> {
  // AI gets: job description + items we already found
  // AI returns: quantities, labor hours, what's missing

  const response = await callOpenRouter({
    model: 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You're helping a ${settings.trade} contractor build a quote.
Given a job description and items already found, suggest:
1. Quantities for each item
2. Estimated labor hours
3. Any missing items needed

Return JSON only.`
      },
      {
        role: 'user',
        content: `Job: "${jobDescription}"

Items found:
${foundItems.map(i => `- ${i.name}: $${i.avg_cost}`).join('\n')}

Return:
{
  "items": [{ "name": "item name", "qty": 1 }],
  "labor_hours": 3,
  "missing": ["permit", "disposal"]
}`
      }
    ]
  });

  return parseJSON(response);
}
```

---

## App Screens

```
Authentication
├── /login              → Email/password login
├── /register           → Sign up
└── /forgot-password    → Password reset

Onboarding (first launch)
├── /onboarding         → Trade selection
├── /onboarding/business → Business name, ZIP, labor rate, markup

Main App (tabs)
├── / (index)           → Quote list + "New Quote" FAB
├── /pricebook          → Pricebook items list + search
└── /settings           → Business settings, labor rate, markup, payment

Quote Flow
├── /quote/new          → Create quote (search or AI mode)
├── /quote/[id]         → View/edit quote
└── /quote/[id]/preview → Preview customer view

Pricebook
├── /pricebook/add      → Add new item (+ camera for price tags)
└── /pricebook/[id]     → Edit item
```

---

## Settings Page Structure

```
Settings
├── Business Info
│   ├── Business name
│   ├── Phone
│   ├── Email
│   ├── Address
│   └── Logo
│
├── Pricing                    ← KEY SECTION
│   ├── Labor rate ($/hr)      → e.g., $150/hr
│   ├── Helper rate ($/hr)     → optional
│   ├── Material markup (%)    → e.g., 35%
│   ├── Equipment markup (%)   → optional, defaults to material
│   └── Default tax rate (%)   → e.g., 8%
│
├── Payment Method
│   ├── Method selector
│   └── Payment link/details
│
└── Community
    └── Contribute pricing data → toggle (default on)
```

---

## Project Structure

```
blitzquotes/
├── app/                      # Expo Router pages
│   ├── (auth)/
│   ├── (tabs)/
│   ├── onboarding/
│   ├── quote/
│   └── pricebook/
├── blitzprices/              # BlitzPrices spec and integration
│   └── CLAUDE.md             # Full BlitzPrices documentation
├── components/
├── lib/
│   ├── supabase.ts
│   ├── blitzprices.ts        # BlitzPrices API client
│   ├── store.ts
│   └── utils.ts
├── supabase/
│   └── functions/
│       ├── ai/               # AI reasoning (minimal)
│       └── blitzprices/      # BlitzPrices search/submit
├── types/
├── CLAUDE.md                 # This file
└── package.json
```

---

## Environment Variables

```bash
# .env.local (do not commit)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
OPENROUTER_API_KEY=sk-or-xxx
```

---

## Development Commands

```bash
npm install           # Install dependencies
npx expo start        # Start dev server
npx expo run:ios      # Run on iOS
npx expo run:android  # Run on Android
eas build             # Production build
eas submit            # Submit to stores
```

---

## Pre-Production Checklist

- [ ] Enable email confirmation in Supabase
- [ ] Set up deep linking for auth
- [ ] Set OpenRouter API key as Supabase secret
- [ ] Enable pg_trgm extension for BlitzPrices search
- [ ] Create BlitzPrices tables
- [ ] Test on real devices (iOS + Android)
- [ ] Set up EAS Build

---

## Design Principles

1. **Mobile-first** — Contractors are on job sites, not desks
2. **Speed over features** — Quote in 60 seconds or less
3. **Database first, AI second** — Real prices from BlitzPrices, AI for reasoning
4. **User controls pricing** — Labor rate and markup are settings, not AI guesses
5. **Contribute and benefit** — Users add data, everyone gets better prices

---

## Notes

- Labor rate and markup are in settings, not guessed by AI
- AI is only for reasoning (quantities, labor hours, what's missing)
- BlitzPrices provides material costs, user settings provide business logic
- Keep it simple: Quote → Send → Get Paid
