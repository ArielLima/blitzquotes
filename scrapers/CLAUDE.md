# BlitzPrices Scrapers

**Status:** PRE-LAUNCH TODO - Build before launch to seed database

## Goal

Scrape 50-100k product items from major retailers to bootstrap BlitzPrices database. This provides immediate value for users at launch while crowdsourced data builds up over time.

## Target Retailers

| Store | Priority | Difficulty | Est. Items |
|-------|----------|------------|------------|
| Home Depot | High | Medium | 40k |
| Lowe's | High | Medium | 40k |
| Menards | Medium | Easy | 20k |
| Grainger | Low | Medium | 20k |

Skip: Amazon (hard), Ferguson (needs account)

## Categories to Scrape

Focus on trade-relevant categories:
- Plumbing (water heaters, pipes, fittings, fixtures)
- Electrical (panels, wire, outlets, switches, fixtures)
- HVAC (units, ductwork, thermostats, refrigerant)
- Building materials (lumber, drywall, insulation)

## Infrastructure

```
4x t2.nano EC2 instances (~$14/month)
Rotating proxy service (~$50-100/month)
1 request/second per instance (4 req/sec total)
```

## Scraping Strategy

- 1 req/sec per instance (human-like rate)
- Rotating proxies to distribute requests
- Randomized delays (0.8-1.2s)
- Rotate user agents
- Auto-retry on failure with backoff

## Data to Extract

```typescript
interface ScrapedItem {
  source: 'homedepot' | 'lowes' | 'menards' | 'grainger';
  source_sku: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  unit: string;  // each, per ft, per lb, etc.
  url: string;
  scraped_at: timestamp;
}
```

## Tech Stack

- Node.js + Puppeteer (headless browser for JS-rendered pages)
- Proxy service (Bright Data, Oxylabs, or cheaper alternative)
- Output to Supabase blitzprices table

## Timeline

- Build Home Depot scraper: 1-2 days
- Build Lowe's scraper: 1 day (similar structure)
- Run initial scrape: 12 hours
- Data cleanup/normalization: 1 day

**Total: ~4-5 days to 100k items**

## Post-Launch

Once crowdsourced data grows:
- Scraped data becomes fallback/baseline
- Real contractor prices override retail
- Can disable scrapers after 3-6 months
