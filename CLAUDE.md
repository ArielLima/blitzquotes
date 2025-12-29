# BlitzQuotes

AI-powered quoting app for contractors. Send professional quotes in 60 seconds.

## Overview

BlitzQuotes helps solo and small trade contractors (plumbers, HVAC, electricians, etc.) create and send quotes fast using AI. Describe the job, get a complete quote with line items and pricing, send to customer, get paid.

**Target users:** Solo contractors and small shops (1-5 employees) who currently use paper, Notes app, or spreadsheets for quotes.

**Domain:** blitzquotes.com

## The Problem

- 45% of small contractors still use paper/spreadsheets for quotes
- Creating a quote takes 20-30 minutes (lookup prices, calculate, format)
- Quotes look unprofessional (scribbled notes, plain text messages)
- Contractors forget to include materials, permits, or markup
- No easy way to track what's been sent, viewed, or paid

## The Solution

1. Describe the job in plain English: "Replace 50 gallon gas water heater"
2. AI generates complete quote with line items from contractor's pricebook
3. Contractor adjusts if needed, taps Send
4. Customer gets professional quote link, can pay directly
5. Contractor tracks status: sent → viewed → paid

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | React Native with Expo + Expo Router |
| State | Zustand |
| Backend/DB | Supabase (Auth + Postgres + Realtime) |
| AI | OpenRouter (Claude Haiku for cost efficiency) |
| Payments | Bring Your Own (Venmo, PayPal, Zelle, etc.) — Stripe recommended |
| Customer Quote View | Next.js on Vercel (or Supabase Edge Function) |

## Core Features (MVP)

### 1. Onboarding
- Select trade (plumbing, HVAC, electrical, general)
- Enter business name
- AI generates starter pricebook based on trade
- Optional: add payment link

### 2. Pricebook
- User's catalog of items with costs/prices
- Categories: labor, materials, equipment, fees
- AI suggests items, user sets their actual prices
- Learns from quotes over time

### 3. Quote Builder
- Text input: "Replace 50 gallon gas water heater in garage"
- AI parses job → suggests line items from pricebook
- User adjusts quantities/prices
- Auto-calculates subtotal, tax, total
- Add customer name/phone

### 4. Send & Track
- Generate shareable link
- Send via SMS or copy link
- Track status: draft → sent → viewed → paid
- Mark as paid manually (or auto via Stripe webhook in V2)

### 5. Payments (Flexible)

**"Bring Your Own Payment Link"** — contractors use their existing payment method:

| Method | How It Works |
|--------|--------------|
| **Stripe** (recommended) | Best UX, can pre-fill amount, auto-mark paid later |
| Venmo | Opens Venmo profile |
| PayPal | Opens PayPal.me link |
| Zelle | Shows email/phone to send to |
| CashApp | Opens CashApp link |
| Square | Opens Square invoice |
| None | Just show total, customer pays however |

Contractor sets this once in Settings. Customer sees "Pay $X" button on quote.

### 6. Dashboard
- List of quotes with status badges
- Quick stats: quotes sent, paid, revenue this month

## Data Model

```typescript
// Pricebook Item
interface PricebookItem {
  id: string;
  user_id: string;
  name: string;           // "50 gal gas water heater"
  category: string;       // "materials" | "labor" | "equipment" | "fees"
  unit: string;           // "each" | "hour" | "foot" | "sqft"
  cost: number;           // what contractor pays
  price: number;          // what contractor charges
  default_qty: number;    // usually 1
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
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  notes?: string;
  status: "draft" | "sent" | "viewed" | "paid";
  created_at: timestamp;
  sent_at?: timestamp;
  viewed_at?: timestamp;
  paid_at?: timestamp;
}

interface LineItem {
  pricebook_item_id?: string;
  name: string;
  description?: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

// User Settings
interface UserSettings {
  user_id: string;
  business_name: string;
  business_phone?: string;
  business_email?: string;
  business_address?: string;
  zip_code?: string;          // For regional pricing estimates
  logo_url?: string;
  trade: string;              // "plumbing" | "hvac" | "electrical" | "general"
  default_tax_rate: number;   // e.g., 0.08 for 8%
  default_markup: number;     // e.g., 0.35 for 35%
  // Payment settings
  payment_method: string;     // "stripe" | "venmo" | "paypal" | "zelle" | "cashapp" | "square" | "none"
  payment_link?: string;      // URL or username depending on method
  payment_details?: string;   // For Zelle: email/phone to display
}
```

## Supabase Schema

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Pricebook items
create table pricebook_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  category text not null default 'materials',
  unit text not null default 'each',
  cost numeric(10,2) not null default 0,
  price numeric(10,2),
  default_qty numeric(10,2) not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quotes
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  job_description text,
  line_items jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  tax_rate numeric(5,4) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  notes text,
  status text not null default 'draft',
  created_at timestamptz default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz
);

-- User settings
create table user_settings (
  user_id uuid primary key references auth.users,
  business_name text,
  business_phone text,
  business_email text,
  business_address text,
  zip_code text,
  logo_url text,
  trade text not null default 'general',
  default_tax_rate numeric(5,4) not null default 0,
  default_markup numeric(5,4) not null default 0.35,
  payment_method text default 'none',
  payment_link text,
  payment_details text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies
alter table pricebook_items enable row level security;
alter table quotes enable row level security;
alter table user_settings enable row level security;

create policy "Users can CRUD their own pricebook items"
  on pricebook_items for all using (auth.uid() = user_id);

create policy "Users can CRUD their own quotes"
  on quotes for all using (auth.uid() = user_id);

create policy "Users can CRUD their own settings"
  on user_settings for all using (auth.uid() = user_id);

-- Public read for quotes (for customer view)
create policy "Anyone can view quotes by ID"
  on quotes for select using (true);

-- Public read for user settings (for customer quote view to show business info)
create policy "Anyone can view user settings"
  on user_settings for select using (true);
```

## AI Integration

### OpenRouter Setup

```typescript
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function generateQuoteItems(
  pricebook: PricebookItem[],
  jobDescription: string,
  trade: string
): Promise<LineItem[]> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-haiku",
      messages: [
        {
          role: "system",
          content: `You are a ${trade} contractor quoting assistant. Given a pricebook and job description, return suggested line items as JSON.

Rules:
- Only suggest items that exist in the pricebook (match by name)
- Estimate reasonable quantities based on the job
- Include labor hours based on job complexity
- Don't forget common extras (permits, disposal fees, travel)
- Be practical and accurate for real-world ${trade} jobs`
        },
        {
          role: "user",
          content: `Pricebook:\n${JSON.stringify(pricebook, null, 2)}\n\nJob description: "${jobDescription}"\n\nReturn ONLY a JSON array of line items:\n[{ "pricebook_item_id": "uuid", "name": "item name", "qty": 1, "unit": "each", "unit_price": 100, "total": 100 }]`
        }
      ],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Parse JSON from response (handle markdown code blocks if present)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
}
```

### Starter Pricebook Generation

```typescript
async function generateStarterPricebook(trade: string): Promise<PricebookItem[]> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-haiku",
      messages: [
        {
          role: "system",
          content: `Generate a starter pricebook for a ${trade} contractor. Include common materials, labor rates, and fees. Use realistic average prices. Return as JSON array.`
        },
        {
          role: "user",
          content: `Generate 20-30 common pricebook items for a ${trade} contractor.

Return ONLY a JSON array:
[{
  "name": "Item name",
  "category": "materials|labor|equipment|fees",
  "unit": "each|hour|foot|sqft",
  "cost": 50,
  "price": 75,
  "default_qty": 1
}]`
        }
      ],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
}
```

## App Screens

```
Authentication
├── /login              → Email/password login
├── /register           → Sign up
└── /forgot-password    → Password reset

Onboarding (first launch)
├── /onboarding         → Trade selection
├── /onboarding/business → Business name, contact
└── /onboarding/pricebook → Review AI-generated starter pricebook

Main App (tabs)
├── / (index)           → Quote list + "New Quote" FAB
├── /pricebook          → Pricebook items list
└── /settings           → Business settings, payment setup

Quote Flow
├── /quote/new          → Create quote (job description → AI → line items)
├── /quote/[id]         → View/edit quote
└── /quote/[id]/preview → Preview customer view

Pricebook
├── /pricebook/add      → Add new item
└── /pricebook/[id]     → Edit item
```

## Customer Quote View (Web)

Hosted at: `https://blitzquotes.com/q/[quote_id]`

Simple Next.js page or Supabase Edge Function:

```tsx
// Fetch quote and user settings
// Display:
// - Business name/logo
// - Quote details and line items
// - Total
// - Pay button (based on payment_method)
// - Update viewed_at timestamp on load
```

**Pay Button Logic:**

```typescript
function getPaymentButton(settings: UserSettings, total: number) {
  switch (settings.payment_method) {
    case 'stripe':
      // Stripe Payment Link with amount
      return `${settings.payment_link}?amount=${total * 100}`;
    case 'venmo':
      // Venmo deep link
      return `venmo://paycharge?txn=pay&recipients=${settings.payment_link}&amount=${total}`;
    case 'paypal':
      return `${settings.payment_link}/${total}`;
    case 'cashapp':
      return `https://cash.app/${settings.payment_link}/${total}`;
    case 'zelle':
      // Can't deep link, show instructions
      return null; // Display "Send ${total} to ${settings.payment_details} via Zelle"
    case 'square':
      return settings.payment_link;
    default:
      return null; // Just show total
  }
}
```

## Project Structure

```
blitzquotes/
├── app/                      # Expo Router pages
│   ├── (auth)/              # Auth screens (login, register)
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/              # Main tab navigation
│   │   ├── index.tsx        # Quote list (home)
│   │   ├── pricebook.tsx    # Pricebook list
│   │   ├── settings.tsx     # Settings
│   │   └── _layout.tsx
│   ├── onboarding/
│   │   ├── index.tsx        # Trade selection
│   │   ├── business.tsx     # Business info
│   │   └── pricebook.tsx    # Review starter pricebook
│   ├── quote/
│   │   ├── new.tsx          # New quote
│   │   ├── [id].tsx         # View/edit quote
│   │   └── [id]/
│   │       └── preview.tsx  # Preview customer view
│   ├── pricebook/
│   │   ├── add.tsx          # Add item
│   │   └── [id].tsx         # Edit item
│   ├── _layout.tsx          # Root layout
│   └── index.tsx            # Entry (redirect based on auth)
├── components/
│   ├── QuoteCard.tsx        # Quote list item
│   ├── LineItemRow.tsx      # Editable line item
│   ├── PricebookItemRow.tsx # Pricebook list item
│   ├── StatusBadge.tsx      # Quote status badge
│   ├── PaymentMethodPicker.tsx
│   └── TradeSelector.tsx
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── openrouter.ts        # AI functions
│   ├── payments.ts          # Payment link helpers
│   ├── store.ts             # Zustand store
│   └── utils.ts             # Helpers (formatCurrency, etc.)
├── types/
│   └── index.ts             # TypeScript types
├── constants/
│   └── trades.ts            # Trade options and defaults
├── hooks/
│   ├── useQuotes.ts
│   ├── usePricebook.ts
│   └── useSettings.ts
├── CLAUDE.md                # This file
├── app.json                 # Expo config
├── package.json
├── tsconfig.json
└── .env.local               # Environment variables (git ignored)
```

## Environment Variables

```bash
# .env.local (do not commit)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
OPENROUTER_API_KEY=sk-or-xxx
```

## Development Commands

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Build for production
eas build --platform all

# Submit to stores
eas submit --platform all
```

## MVP Build Steps

### Phase 1: Foundation
- [ ] Initialize Expo project with Expo Router
- [ ] Set up Supabase project and schema
- [ ] Implement auth flow (login, register, logout)
- [ ] Create basic tab navigation
- [ ] Set up Zustand store

### Phase 2: Core Features
- [ ] Build pricebook CRUD (list, add, edit, delete)
- [ ] Integrate OpenRouter for AI
- [ ] Create onboarding flow with trade selection
- [ ] Generate starter pricebook via AI

### Phase 3: Quote Flow
- [ ] Quote creation screen with job description input
- [ ] AI-powered line item generation
- [ ] Line item editing (adjust qty, price, add/remove)
- [ ] Quote list/dashboard with status

### Phase 4: Customer Experience
- [ ] Build customer quote view (web page)
- [ ] Implement quote sharing (copy link, SMS)
- [ ] Add "viewed" tracking
- [ ] Payment link integration

### Phase 5: Polish
- [ ] Payment method settings
- [ ] Business profile settings
- [ ] Quote status management (mark as paid)
- [ ] UI polish, loading states, error handling
- [ ] TestFlight / Play Store internal testing

## Pricing Model

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 5 quotes/month |
| Pro | $29/mo | Unlimited quotes, AI, payments |
| Team | $49/mo | Multi-user, shared pricebook (future) |

## Business Context

### Target Market
- 473,108 SMB specialty trade contractors in US (<5 employees)
- 45% still use paper/spreadsheets (NIST)
- Primary trades: plumbing, HVAC, electrical

### Competitors
| Competitor | Price | Gap |
|------------|-------|-----|
| ServiceTitan | $125-400/mo | Enterprise, overkill for solo |
| Jobber | $25-199/mo | Complex, not trade-specific |
| Housecall Pro | $59-149/mo | Bloated features |
| Joist | Free-$15/mo | Basic, no AI |

### Positioning
- Simpler than Jobber
- Cheaper than Housecall Pro
- Smarter than Joist (AI)
- Built for solo/micro contractors

### Revenue Target
- Year 1: $200-400K ARR (700-1,400 customers @ $29/mo)
- Year 2-3: $1M ARR (2,900 customers)

## Design Principles

1. **Mobile-first** — Contractors are on job sites, not desks
2. **Speed over features** — Quote in 60 seconds or less
3. **AI assists, doesn't replace** — Always allow manual entry
4. **Professional output** — Quotes should look better than competitors
5. **Offline-capable** — Jobs happen in basements with no signal (future)

## Pre-Production Checklist

Before going live, make sure to:

- [ ] **Enable email confirmation** in Supabase (Authentication → Providers → Email → "Confirm email")
- [ ] **Set up deep linking** for auth redirects (add `scheme: "blitzquotes"` to app.json, configure Supabase redirect URLs)
- [ ] **Set OpenRouter API key** as Supabase secret: `supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxx`
- [ ] **Configure production environment** variables
- [ ] **Test on real devices** (iOS + Android)
- [ ] **Set up EAS Build** for app store submissions

## Notes

- Keep scope tight. Quote → Send → Get Paid. That's it.
- Free tier is the lead magnet. Convert when they hit limit.
- Recommend Stripe for payment method — best UX for everyone.
- Don't build invoicing, scheduling, or CRM. That's scope creep.
- Launch fast, iterate based on real user feedback.
