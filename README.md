# BlitzQuotes

AI-powered quoting app for contractors. Send professional quotes in 60 seconds.

## Overview

BlitzQuotes helps solo and small trade contractors (plumbers, HVAC, electricians, etc.) create and send quotes fast. Describe the job, get a complete quote with line items and pricing, send to customer, get paid.

**Target users:** Solo contractors and small shops (1-5 employees) who currently use paper, Notes app, or spreadsheets for quotes.

## Current Features

### Quote Creation
- **AI Mode** - Describe the job in plain English, AI generates line items with quantities and pricing (powered by Claude Sonnet 4)
- **Manual Mode** - Build quotes by searching BlitzPrices or adding custom items
- **2-Pass AI Generation** - AI extracts items, searches BlitzPrices, then builds accurate quote
- **Edit Line Items** - Tap any line item to edit name, price, or quantity
- **Custom Items** - Add items not in BlitzPrices directly in the quote builder
- **Labor Tracking** - Add labor hours with your configured rate
- **Profit Calculator** - See your profit breakdown (not shown to customer)
- **Photo Attachments** - Attach photos of work area, damage, or materials
- **Job Site Address** - Track location with smart address autocomplete (Radar API)

### Quote Management
- **Quotes Tab** - View pending quotes (Draft → Sent → Viewed)
- **View Notifications** - See when customers view your quotes
- **Edit & Delete** - Modify any quote, not just drafts
- **Filter & Search** - Filter by status, search by customer or job
- **Valid Until Dates** - Set expiration dates on quotes

### Jobs & Invoices
- **Jobs Tab** - Track confirmed work (Approved → Invoiced → Paid)
- **Customer Approval** - Customers approve quotes from the quote link
- **Convert to Invoice** - One tap to convert approved quotes to invoices
- **Auto Invoice Numbers** - Sequential invoice numbering (INV-001, INV-002...)
- **Work & Due Dates** - Track when work was completed and payment due dates
- **Revenue & Profit Stats** - See Expected, Collected, and Profit totals
- **YTD Filter** - View jobs from current year, last 7/30/90 days, or all time
- **Mark as Paid** - Track when you've been paid

### Sending & Payments
- **Share via SMS** - Send quote/invoice link directly via text message
- **Send via Email** - Opens email app with pre-filled subject and message (requires customer email)
- **Share Anywhere** - WhatsApp, or copy link
- **Customer View** - Professional web page at q.blitzquotes.com
- **PDF Export** - Download professional PDF from customer view page
- **Approve & Pay Flow** - Customers approve quotes, then pay invoices
- **Payment Links** - Supports Venmo, PayPal, Cash App, Zelle, Stripe, Square

### Settings
- **Business Profile** - Name, phone, email, address, logo
- **Logo Upload** - Add your business logo to quotes and invoices
- **Pricing Settings** - Labor rate, material markup, contractor discount
- **Tax Configuration** - Default tax rate
- **Payment Setup** - Configure your preferred payment method

### Professional Polish
- **Phone Formatting** - Numbers formatted for US/Canada/UK/international
- **Custom Branding** - Your logo and address on customer-facing pages
- **PDF Documents** - Clean, professional PDFs with paid/due status

## Planned Features

### High Priority (Release)
- [x] **Push notifications** - Alert when customer views/approves quote
- [ ] **Quick templates** - Save common jobs as one-tap templates (covered by duplication)

### Medium Priority (Post-Release)
- [ ] **Customer signatures** - Digital signatures on invoices
- [ ] **Reports/Export** - Monthly revenue summary, CSV export
- [ ] **Recurring invoices** - For maintenance contracts
- [ ] **Partial payments** - Track deposits and payment plans

### Future Ideas
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
| Backend/DB | Supabase (Auth + Postgres + Storage) |
| Pricing Data | BlitzPrices (crowdsourced) |
| AI | OpenRouter (Claude Sonnet 4) |
| Address Autocomplete | Radar API (100k free/month) |
| Payments | BYOP (Venmo, PayPal, Stripe, etc.) |
| Customer Pages | Cloudflare Pages |

## Project Structure

```
blitzquotes/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Login, register
│   ├── (tabs)/            # Main app tabs (quotes, jobs, settings)
│   ├── onboarding/        # First-time setup
│   └── quote/             # Quote creation/viewing
├── components/            # Shared React components
├── lib/                   # Utilities and clients
│   ├── supabase.ts       # Supabase client
│   ├── blitzprices.ts    # BlitzPrices API
│   ├── store.ts          # Zustand store
│   └── utils.ts          # Helpers
├── supabase/
│   ├── functions/        # Edge functions
│   │   ├── ai/           # AI quote generation (with tracing)
│   │   ├── blitzprices/  # Price search/submit
│   │   └── quote-view/   # Customer quote API
│   └── migrations/       # Database migrations
├── tools/
│   └── trace-viewer/     # Debug AI quote generation (React + Vite)
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
EXPO_PUBLIC_RADAR_KEY=your-radar-publishable-key
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

## Development Tools

### Trace Viewer
Debug AI quote generation step-by-step:

```bash
cd tools/trace-viewer
npm install
npm run dev
# Opens at http://localhost:5173
```

Features:
- View all AI traces with date/time filtering
- Filter by source (generate_quote, etc.)
- See input/output for each step
- Copy trace as JSON for debugging

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Full project specification
- [blitzprices/CLAUDE.md](./blitzprices/CLAUDE.md) - BlitzPrices database spec
- [scrapers/CLAUDE.md](./scrapers/CLAUDE.md) - Web scraper documentation
- [tools/trace-viewer/README.md](./tools/trace-viewer/README.md) - Trace viewer docs

## License

Private - All rights reserved
