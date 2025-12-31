# BlitzQuotes

AI-powered quoting app for contractors. Send professional quotes in 60 seconds.

## Overview

BlitzQuotes helps solo and small trade contractors (plumbers, HVAC, electricians, etc.) create and send quotes fast. Describe the job, get a complete quote with line items and pricing, send to customer, get paid.

**Target users:** Solo contractors and small shops (1-5 employees) who currently use paper, Notes app, or spreadsheets for quotes.

## Current Features

### Quote Creation
- **AI Mode** - Describe the job in plain English, AI generates line items with quantities and pricing
- **Manual Mode** - Build quotes by searching BlitzPrices or adding custom items
- **Mode Memory** - App remembers your preferred mode (AI vs Manual)
- **Custom Items** - Add items not in BlitzPrices directly in the quote builder
- **Labor Tracking** - Add labor hours with your configured rate
- **Profit Calculator** - See your profit breakdown (not shown to customer)

### Quote Management
- **Status Tracking** - Draft → Sent → Viewed → Paid
- **View Notifications** - See when customers view your quotes
- **Edit & Delete** - Modify any quote, not just drafts
- **Filter & Search** - Filter by status, see totals by category

### Sending & Payments
- **Share via SMS** - Send quote link directly via text message
- **Share Anywhere** - Email, WhatsApp, or copy link
- **Customer View** - Professional web page for customers at q.blitzquotes.com
- **Payment Links** - Supports Venmo, PayPal, Cash App, Zelle, Stripe, Square
- **Mark as Paid** - Track when you've been paid

### Settings
- **Business Profile** - Name, phone, email, address
- **Pricing Settings** - Labor rate, material markup, contractor discount
- **Tax Configuration** - Default tax rate
- **Payment Setup** - Configure your preferred payment method

## Planned Features

### Coming Soon
- [ ] **Invoices** - Convert quotes to invoices after job completion
- [ ] **Invoice Numbers** - Auto-generated invoice numbering
- [ ] **Due Dates** - Payment terms and due date tracking

### Future Ideas
- [ ] Recurring invoices
- [ ] Partial payments tracking
- [ ] PDF export for quotes/invoices
- [ ] Customer signature capture
- [ ] Photo attachments on quotes
- [ ] Multi-user / team support
- [ ] QuickBooks / accounting integration

---

## BlitzPrices

BlitzQuotes is powered by **BlitzPrices** - an open, crowdsourced pricing database for the trades.

### The Problem
- No affordable, real-time API for contractor pricing exists
- RSMeans costs thousands and updates annually (stale data)
- AI models guess prices based on training data (often wrong)
- Regional pricing varies wildly (NYC vs rural Texas)

### How BlitzPrices Works

```
BlitzPrices stores:    RETAIL prices (what stores charge)
Your settings:         Contractor discount + markup
The math:
  └─ Contractor cost = retail × (1 - your discount)
  └─ Customer price  = contractor cost × (1 + your markup)
```

**Example:**
```
Retail price (BlitzPrices):    $500
Your contractor discount (15%): -$75
Your cost:                      $425
Your markup (35%):             +$149
Customer sees:                  $574
You profit:                     $149
```

### Data Sources
1. **Crowdsourced** - Contractors contribute real prices they've paid
2. **Scraped** - Retail prices from Home Depot, Lowe's, etc.
3. **Community** - Prices improve as more contractors use the app

### Privacy
- All price submissions are anonymized
- Only aggregated data (5+ submissions) is shown
- You can opt out of contributing in settings

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | React Native + Expo Router |
| State | Zustand |
| Backend/DB | Supabase (Auth + Postgres) |
| Pricing Data | BlitzPrices (crowdsourced) |
| AI | OpenRouter (GPT-4o-mini) |
| Payments | BYOP (Venmo, PayPal, Stripe, etc.) |
| Customer Pages | Cloudflare Pages |

## Project Structure

```
blitzquotes/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Login, register
│   ├── (tabs)/            # Main app tabs (quotes, pricebook, settings)
│   ├── onboarding/        # First-time setup
│   └── quote/             # Quote creation/viewing
├── components/            # Shared React components
├── lib/                   # Utilities and clients
│   ├── supabase.ts       # Supabase client
│   ├── blitzprices.ts    # BlitzPrices API
│   ├── store.ts          # Zustand store
│   └── utils.ts          # Helpers
├── supabase/
│   └── functions/        # Edge functions
│       ├── ai/           # AI quote generation
│       ├── blitzprices/  # Price search/submit
│       └── quote-view/   # Customer quote API
├── scrapers/             # BlitzPrices data scrapers (Puppeteer)
└── blitzprices/          # BlitzPrices specification
```

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Add your Supabase credentials to .env.local

# Start development server
npx expo start
```

## Environment Variables

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_QUOTE_PAGE_URL=https://q.blitzquotes.com
```

## Development

```bash
# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Deploy Supabase functions
supabase functions deploy ai
supabase functions deploy blitzprices
supabase functions deploy quote-view
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Full project specification
- [blitzprices/CLAUDE.md](./blitzprices/CLAUDE.md) - BlitzPrices database spec
- [scrapers/CLAUDE.md](./scrapers/CLAUDE.md) - Web scraper documentation
- [supabase/functions/README.md](./supabase/functions/README.md) - Edge function API docs

## License

Private - All rights reserved
