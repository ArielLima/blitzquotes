# BlitzQuotes

AI-powered quoting app for contractors. Send professional quotes in 60 seconds.

## Overview

BlitzQuotes helps solo and small trade contractors (plumbers, HVAC, electricians, etc.) create and send quotes fast. Describe the job, get a complete quote with line items and pricing, send to customer, get paid.

**Two ways to build quotes:**
1. **Manual mode** - Search BlitzPrices database, pick items, add custom items
2. **AI mode** - Describe job, AI suggests materials and quantities

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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | React Native + Expo Router |
| State | Zustand |
| Backend/DB | Supabase (Auth + Postgres) |
| Pricing Data | BlitzPrices (crowdsourced) |
| AI | OpenRouter (GPT-4o-mini) |
| Payments | BYOP (Venmo, PayPal, Stripe, etc.) |

## Project Structure

```
blitzquotes/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Login, register
│   ├── (tabs)/            # Main app tabs
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
│       └── quote-view/   # Customer quote page
├── scrapers/             # BlitzPrices data scrapers
└── blitzprices/          # BlitzPrices spec
```

## Environment Variables

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
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

## License

Private - All rights reserved
