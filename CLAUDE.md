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
| AI | OpenRouter (claude-sonnet-4) - for reasoning only |
| Payments | Bring Your Own (Venmo, PayPal, Zelle, etc.) — Stripe recommended |
| Customer Quote View | Next.js on Vercel (or Supabase Edge Function) |

---

## BlitzPrices Integration

BlitzQuotes is powered by BlitzPrices - an open, crowdsourced pricing database.

See `/blitzprices/CLAUDE.md` for full details.

### How it works:

```
BlitzPrices provides: RETAIL prices (what stores charge)
User Settings provide: Contractor discount + labor rate + markup
Math provides:
  - Contractor cost = retail × (1 - discount)
  - Customer price = contractor cost × (1 + markup)
```

**Example:**
```
Retail price (BlitzPrices):    $500
Contractor discount (15%):     -$75
Contractor cost:               $425
Markup (35%):                  +$149
Customer price:                $574
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

#### Mode 2: AI-Assisted (2-pass approach)
```
User: "Install XYZ 50 gal water heater in garage with 3/4 copper lines"
         ↓
Step 1: AI Call #1 - Extract required items (~2 sec)
   "What specific items are needed for this job?"
         ↓
   Returns: ["XYZ 50gal water heater", "3/4 copper pipe",
             "copper fittings", "gas flex line", "permit"]
         ↓
Step 2: Parallel BlitzPrices searches (~1 sec)
   - Search each item
   - Weight results (brand match > category match)
   - Return best matches with prices
         ↓
Step 3: AI Call #2 - Build final quote (~4-5 sec)
   "Here's what we found in the database:
    - XYZ 50gal water heater: $485
    - 3/4 copper pipe: $3.50/ft
    - ...
    Fill gaps, set quantities, estimate labor hours"
         ↓
   Returns: Complete quote with line items + labor
         ↓
Step 4: Apply user's markup + tax
         ↓
Final quote assembled (~10-12 sec total)
```

**Why 2-pass is better:**
- AI understands job context (e.g., "garage" = might need longer lines)
- Brand names get matched properly in database
- Second AI pass fills gaps intelligently
- More accurate than single-pass keyword extraction

**Loading UX shows progress:**
```
⏳ Analyzing job requirements...
⏳ Searching 50,000+ prices...
⏳ Building your quote...
✓ Done!
```

**Cost:** ~$0.012/quote → ~$1.20/month for 100 quotes (worth it for accuracy)

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
- Track quote/invoice lifecycle (see below)

---

## Quote → Invoice Flow

```
Quote:   Draft → Sent → Viewed → Approved
                                    ↓
                            [Contractor does work]
                                    ↓
Invoice:                        Invoiced → Paid
```

**Quote phase:** Customer approves (not pays) the quote
**Invoice phase:** Contractor converts to invoice, customer pays

**Customer actions:**
- Quote view: "Approve" button
- Invoice view: "Pay" button

**Contractor actions:**
- "Mark Approved" (if customer approved via text/call)
- "Convert to Invoice" (when approved, creates invoice)
- "Mark Paid" (if customer paid outside app)

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

// Quote/Invoice (same table, type distinguishes)
interface Quote {
  id: string;
  user_id: string;
  type: 'quote' | 'invoice';           // quote until converted
  invoice_number?: string;             // auto-generated: INV-001, INV-002...
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  job_description: string;
  line_items: LineItem[];
  labor_hours: number;
  labor_rate: number;
  labor_total: number;
  materials_subtotal: number;
  markup_percent: number;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'invoiced' | 'paid';
  created_at: timestamp;
  sent_at?: timestamp;
  viewed_at?: timestamp;
  approved_at?: timestamp;
  invoiced_at?: timestamp;
  paid_at?: timestamp;
}

interface LineItem {
  pricebook_item_id?: string;
  name: string;
  category: 'materials' | 'equipment' | 'fees';
  qty: number;
  unit: string;
  retail_price: number;     // retail price from BlitzPrices
  contractor_cost: number;  // retail × (1 - discount)
  unit_price: number;       // contractor_cost × (1 + markup)
  total: number;            // qty × unit_price
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
  contractor_discount: number; // decimal (e.g., 0.15 for 15% off retail)
  material_markup: number;     // decimal (e.g., 0.35 for 35%)
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
  contractor_discount NUMERIC(5,4) NOT NULL DEFAULT 0,  -- discount off retail
  material_markup NUMERIC(5,4) NOT NULL DEFAULT 0.35,
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
// Calculate contractor cost from retail price (apply discount)
function calculateContractorCost(retailPrice: number, settings: UserSettings): number {
  return retailPrice * (1 - settings.contractor_discount);
}

// Calculate customer price from contractor cost (apply markup)
function calculateCustomerPrice(
  contractorCost: number,
  category: string,
  settings: UserSettings
): number {
  const markup =
    category === 'fees' ? (settings.fee_markup ?? 0) :
    settings.material_markup;

  return contractorCost * (1 + markup);
}

function calculateQuoteTotal(
  lineItems: LineItem[],
  laborHours: number,
  settings: UserSettings
): QuoteTotals {
  // Materials/equipment/fees - customer prices (already has discount + markup applied)
  const materialsSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  // Materials cost - what contractor pays
  const materialsCost = lineItems.reduce((sum, item) => sum + (item.contractor_cost * item.qty), 0);

  // Labor total
  const laborTotal = laborHours * settings.labor_rate;

  // Subtotal
  const subtotal = materialsSubtotal + laborTotal;

  // Tax (usually on materials only, not labor - varies by state)
  const tax = materialsSubtotal * settings.default_tax_rate;

  // Total
  const total = subtotal + tax;

  // Profit breakdown
  const materialsProfit = materialsSubtotal - materialsCost;
  const totalProfit = materialsProfit + laborTotal;

  return { materialsSubtotal, materialsCost, laborTotal, subtotal, tax, total, materialsProfit, totalProfit };
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
│   ├── Contractor discount (%)→ e.g., 15% off retail
│   ├── Material markup (%)    → e.g., 35%
│   ├── Fee markup (%)         → often 0
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
│   ├── (auth)/              # Login, register, forgot password
│   ├── (tabs)/              # Main tabs (quotes, jobs, settings)
│   ├── onboarding/          # First-time setup flow
│   └── quote/               # Quote creation, viewing, editing
├── blitzprices/             # BlitzPrices spec and integration
│   └── CLAUDE.md            # Full BlitzPrices documentation
├── components/              # Shared React components
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── blitzprices.ts       # BlitzPrices API client
│   ├── notifications.ts     # Push notification helpers
│   ├── store.ts             # Zustand store
│   └── utils.ts             # Helpers (formatting, etc.)
├── supabase/
│   ├── functions/
│   │   ├── ai/              # AI quote generation (with tracing)
│   │   ├── blitzprices/     # BlitzPrices search/submit
│   │   └── quote-view/      # Customer quote API
│   └── migrations/          # Database migrations
├── tools/
│   └── trace-viewer/        # Debug AI traces (React + Vite)
├── scrapers/                # BlitzPrices data scrapers
├── types/
├── CLAUDE.md                # This file
└── package.json
```

---

## Environment Variables

```bash
# .env.local (do not commit)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_RADAR_KEY=prj_live_pk_xxx  # Address autocomplete
OPENROUTER_API_KEY=sk-or-xxx           # Set in Supabase secrets
```

---

## Development Commands

```bash
npm install                      # Install dependencies
npx expo start                   # Start dev server
npx expo run:ios                 # Run on iOS simulator
npx expo run:android             # Run on Android emulator
npx expo run:ios --device        # Run on physical iOS device
npx expo start --dev-client --tunnel  # Run with tunnel for physical device
```

## EAS Build Commands

```bash
eas login                                    # Login to Expo
eas build --profile development --platform ios    # Dev build for testing
eas build --profile production --platform ios     # Production build
eas submit --platform ios                    # Submit to App Store
```

---

## Pre-Production Checklist

- [ ] **Landing page + legal docs** (blitzquotes.com) - Required for App Store
  - Marketing landing page with app screenshots
  - Terms of Service (/terms)
  - Privacy Policy (/privacy)
  - Support/contact page or email
- [ ] **In-app App Store requirements**
  - Account deletion option in Settings (Apple requires this)
  - Restore Purchases button (required for subscriptions) ✓ already in paywall
  - Links to Terms of Service and Privacy Policy in Settings
  - "Manage Subscription" link (can open iOS system settings)
- [ ] **Paywall legal compliance**
  - Terms of Service link
  - Privacy Policy link
  - Auto-renewal disclosure: "Payment charged to Apple ID. Auto-renews unless canceled 24hrs before period ends. Manage in Settings."
- [ ] Enable email confirmation in Supabase (Authentication > Email settings)
- [ ] Set up deep linking for auth (email confirmation links open app)
- [ ] **Run scrapers to seed BlitzPrices with 50-100k items** (see `/scrapers/CLAUDE.md`)
- [ ] Test on real devices (iOS + Android)
- [ ] **Supabase Pro + Branching** - Safe deployments with preview branches
  - Upgrade to Pro plan ($25/mo)
  - Enable database branching for preview environments
  - Protects against bad AI prompts or migrations breaking prod
- [ ] **App version control** - Force update mechanism when app version is outdated
  - Store minimum allowed version in Supabase or remote config
  - Check on app launch, show blocking modal if update required
- [x] Set up EAS Build
- [x] Enable pg_trgm extension for BlitzPrices search (in migration)
- [x] Create BlitzPrices tables (in migration)
- [x] Set OpenRouter API key as Supabase secret

---

## Roadmap

### Recently Completed
- [x] **Photo Attachments** - Attach photos directly to quotes, jobs, and invoices
  - Add photos from camera or gallery with one tap
  - Photos auto-upload to Supabase storage
  - View photos full-screen, remove with confirmation
  - Photos display on customer-facing quote page
  - No need to go through edit flow - add directly from detail page
- [x] **Job Site Address** - Track where work is being done
  - Address field on all quotes/jobs/invoices
  - Address autocomplete powered by Radar API (100k free/month)
  - Shows on customer view and PDF exports
- [x] **Address Autocomplete** - Professional address entry with Radar SDK
  - Real-time address suggestions as you type
  - Full address formatting with city, state, zip
  - Works in quote creation and editing
- [x] **PDF Export** - Download quotes/invoices as PDF from customer web view
  - Professional document styling with jsPDF
  - Contractor logo in header (when available)
  - Construction-appropriate color scheme (orange accent)
  - Shows "PAID" badge for paid invoices, "Amount Due" otherwise
  - Phone number formatting for US/Canada/UK/international
- [x] **Phone Number Formatting** - Consistent formatting throughout app
  - US/Canada: (555) 123-4567
  - UK: 020 1234 5678
  - International: +44 123 456 7890
- [x] **Improved Jobs Tab** - Better stats and filtering
  - Compact stat cards (Expected, Collected, Profit)
  - Whole dollar amounts in stats (no cents)
  - YTD filter for date range
- [x] **2-Pass AI Quote Generation** - More accurate quote building
  - AI Call #1: Extract required items from job description
  - Parallel BlitzPrices searches with weighted matching
  - AI Call #2: Build final quote with found items, fill gaps
- [x] **Edit individual line items** - Tap to edit name, price, qty after quote generation
- [x] **Invoices** - Full quote to invoice flow
  - Quote → Job (approved) → Invoice status flow
  - Auto-generate invoice numbers (INV-001, INV-002, etc.)
  - Work date and due date with native date pickers
  - Customer can approve quotes from the shared link
  - Mark as paid functionality
  - Valid until date for quotes
- [x] **Custom Invoice Branding** - Business logo and address on customer-facing pages
- [x] **Settings: Logo upload** - Image picker uploads to Supabase storage
- [x] **Settings: Address field** - Business address input field
- [x] **AI Model Upgrade** - Switched from gpt-5-mini to claude-sonnet-4 for better results
- [x] **Email Sending** - Send quotes/invoices via email
  - Opens native email app with pre-filled subject and body
  - Shows customer email in send modal
  - Grayed out if no email address saved
- [x] **AI Tracing System** - Debug AI quote generation step-by-step
  - Tracer class logs each step with input/output/duration
  - quote_traces table in Supabase with source filtering
  - Trace viewer React app (tools/trace-viewer)
  - Copy traces as JSON for debugging
- [x] **Improved JSON Parsing** - Balanced bracket extraction for AI responses
  - Handles AI adding comments or extra text
  - Raw response included in errors for debugging

### High Priority (Release)
- [x] **Push notifications** - Alert when customer views/approves quote
  - Expo Push Notifications via quote-view edge function
  - "Quote Viewed" and "Quote Approved!" notifications
  - Deep link to quote detail on tap
- [ ] **Subscription paywall** - RevenueCat integration (IN PROGRESS)
  - [x] RevenueCat SDK integrated and configured
  - [x] PaywallModal with monthly/yearly plan selection
  - [x] 3 free quotes/month quota checking
  - [x] Customer Center for subscription management
  - [ ] Create products in App Store Connect
  - [ ] Link products in RevenueCat dashboard
  - [ ] Switch to production API key
  - [ ] Test real purchases
- [ ] **Social auth** - Apple Sign In + Google Sign In
  - Required for App Store if any social login exists
  - Faster onboarding for users

### Medium Priority (Post-Release)
- [ ] **Customer signature capture** - Digital signatures on invoices
- [ ] **Basic reports/export** - Monthly revenue summary, CSV export for taxes
- [ ] **Recurring invoices** - For maintenance contracts
- [ ] **Partial payments tracking** - Track deposits and payment plans

### Future Ideas
- [ ] Multi-user / team support
- [ ] QuickBooks / accounting integration
- [ ] Fix scraper selectors (delay until closer to release)

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
