# BlitzPrices

Open pricing database for the trades. Crowdsourced, real-time, regional pricing data for contractors.

**Domain:** blitzprices.com

## The Problem

- No affordable, real-time API for contractor pricing exists
- RSMeans costs thousands and updates annually (stale data)
- AI models guess prices based on training data (often wrong, outdated)
- Every contractor app rebuilds pricing from scratch
- Regional pricing varies wildly (NYC vs rural Texas)

## The Opportunity

Build the first open, crowdsourced pricing database for trades:
- Free to query (with rate limits)
- Grows from real user contributions
- Regional (by state, expandable to metro)
- Real-time (prices update as users submit)
- AI-queryable (structured API)

**Market context:** RSMeans/Gordian does $100M+ selling stale annual construction cost data. A real-time, API-first alternative is a massive opportunity.

---

## What BlitzPrices IS and IS NOT

### BlitzPrices provides:
- **Material costs** - What contractors pay at the store
- **Equipment costs** - Tool/equipment purchase prices
- **Fee costs** - Permits, disposal, typical fees

### BlitzPrices does NOT provide:
- **Labor rates** - Too personal (varies by contractor, skill, location)
- **Markup/customer prices** - Business decision, not market data
- **Trade-specific filtering** - A water heater costs the same for any trade

### The philosophy:
```
BlitzPrices  = What things COST (market data)
User Settings = Labor rate + markup (business decisions)
Math         = Customer prices (cost × markup)
```

---

## How It Grows

```
BlitzQuotes users add items (manual or price tag scan)
                    ↓
        Data flows to BlitzPrices (anonymized)
                    ↓
        Database grows with real pricing data
                    ↓
        Better suggestions for all users
                    ↓
        Open API attracts other apps/contributors
                    ↓
        Network effect → more data → more value
```

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **What to store** | Cost only | Markup is a business decision, not market data |
| **Labor rates** | NOT stored | Too personal/regional, belongs in user settings |
| **Trade field** | Optional metadata | Materials cost the same regardless of trade |
| **Region model** | State (for now) | Simple, expandable to metro areas later |
| **Privacy** | Default-on, anonymized | More data. Aggregates only when N ≥ 5 |
| **Matching** | Postgres trigram (pg_trgm) | Fuzzy matching with similarity scores |
| **No match handling** | Return `has_match: false` | Let caller decide to use AI estimate |
| **Access** | API key required | Free tier, but track usage |
| **Hosting** | Same Supabase (MVP) | Keep simple, split later if needed |

---

## Search Strategy

Using Postgres trigram extension for fuzzy matching:

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search with similarity
SELECT name, similarity(name, 'query') AS score
FROM community_prices
WHERE similarity(name, 'query') > 0.3
ORDER BY score DESC;
```

**Similarity thresholds:**
- `> 0.5` = High confidence match
- `0.3 - 0.5` = Moderate confidence, show but flag
- `< 0.3` = No match, return `has_match: false`

**What trigram handles well:**
- Typos: "watre heater" → "water heater"
- Abbreviations: "50 gal" → "50 gallon"
- Word reordering: "heater water gas" → "gas water heater"

**What it struggles with (future improvements):**
- Synonyms: "hot water tank" vs "water heater"
- Brand-only queries: "Rheem ProLine" with no product type
- Solution: Add synonyms table or vector search later

---

## Data Model

### `community_prices` table

Core table storing all price submissions:

```sql
CREATE TABLE community_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Item details
  name TEXT NOT NULL,                    -- Raw submitted name
  name_normalized TEXT,                  -- Lowercase, trimmed for search
  category TEXT NOT NULL,                -- materials, equipment, fees (NOT labor)
  unit TEXT NOT NULL,                    -- each, foot, sqft, gallon, lb, job

  -- Pricing (COST only - what contractor pays)
  cost NUMERIC(10,2) NOT NULL,

  -- Context
  region TEXT NOT NULL,                  -- State code: TX, CA, NY, etc.
  zip_code TEXT,                         -- Original ZIP (for future metro grouping)
  trade TEXT,                            -- Optional: plumbing, hvac, etc. (for analytics only)

  -- Metadata
  source TEXT NOT NULL DEFAULT 'manual', -- manual, price_tag_scan, import
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Quality/trust
  is_verified BOOLEAN DEFAULT FALSE,
  is_outlier BOOLEAN DEFAULT FALSE,      -- Flagged by outlier detection

  -- Optional: UPC/SKU if from price tag scan
  upc TEXT,
  sku TEXT
);

-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes for search
CREATE INDEX idx_community_prices_name_trgm ON community_prices USING GIN (name_normalized gin_trgm_ops);
CREATE INDEX idx_community_prices_region ON community_prices(region);
CREATE INDEX idx_community_prices_category ON community_prices(category);
CREATE INDEX idx_community_prices_submitted ON community_prices(submitted_at DESC);
```

### `price_aggregates` table (materialized/cached)

Pre-computed aggregates for fast API responses:

```sql
CREATE TABLE price_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Grouping key
  name_normalized TEXT NOT NULL,
  region TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,

  -- Aggregated stats
  avg_cost NUMERIC(10,2) NOT NULL,
  min_cost NUMERIC(10,2) NOT NULL,
  max_cost NUMERIC(10,2) NOT NULL,
  median_cost NUMERIC(10,2),
  sample_size INTEGER NOT NULL,

  -- Time-based
  last_submission TIMESTAMPTZ,
  last_computed TIMESTAMPTZ DEFAULT NOW(),

  -- Display
  display_name TEXT,                     -- Most common raw name variant

  UNIQUE(name_normalized, region, category, unit)
);

CREATE INDEX idx_price_aggregates_search ON price_aggregates USING GIN (name_normalized gin_trgm_ops);
CREATE INDEX idx_price_aggregates_region ON price_aggregates(region);
```

### `blitzprices_api_keys` table

For tracking API access:

```sql
CREATE TABLE blitzprices_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash TEXT NOT NULL UNIQUE,         -- Hashed API key
  name TEXT,                             -- "My App", "Development"
  tier TEXT NOT NULL DEFAULT 'free',     -- free, developer, pro, enterprise

  -- Rate limiting
  requests_today INTEGER DEFAULT 0,
  requests_month INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ,

  -- Limits by tier
  daily_limit INTEGER NOT NULL DEFAULT 100,
  monthly_limit INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_email TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
```

---

## API Design

### Base URL
```
https://api.blitzprices.com/v1
-- or for MVP: Supabase Edge Function
```

### Endpoints

#### Search Prices
```
GET /v1/prices/search
  ?q=50+gallon+water+heater     (required)
  &region=TX                    (required)
  &category=materials           (optional)
  &limit=10                     (optional, default 5)

Headers:
  X-API-Key: bp_xxxxxxxxxxxx

Response (match found):
{
  "query": "50 gallon water heater",
  "region": "TX",
  "has_match": true,
  "results": [
    {
      "name": "50 Gallon Gas Water Heater",
      "category": "materials",
      "unit": "each",
      "avg_cost": 485.00,
      "min_cost": 380.00,
      "max_cost": 620.00,
      "sample_size": 47,
      "similarity": 0.68,
      "confidence": "high",
      "last_updated": "2025-01-28"
    }
  ]
}

Response (no match):
{
  "query": "Navien NPE-240A tankless",
  "region": "TX",
  "has_match": false,
  "results": [],
  "suggestion": "No community data available."
}
```

#### Submit Price
```
POST /v1/prices

Headers:
  X-API-Key: bp_xxxxxxxxxxxx
  Content-Type: application/json

Body:
{
  "name": "Rheem 50 Gal Performance Gas Water Heater",
  "category": "materials",
  "unit": "each",
  "cost": 489.00,
  "region": "TX",
  "zip_code": "78701",
  "source": "price_tag_scan",
  "upc": "012345678901"
}

Response:
{
  "success": true,
  "id": "uuid",
  "message": "Price submitted successfully"
}
```

#### Get Metadata
```
GET /v1/meta/categories  → ["materials", "equipment", "fees"]
GET /v1/meta/units       → ["each", "foot", "sqft", "gallon", "lb", "job"]
GET /v1/meta/regions     → ["TX", "CA", "NY", ...]
```

---

## Rate Limits

| Tier | Daily Limit | Monthly Limit | Cost |
|------|-------------|---------------|------|
| Free | 100 | 2,000 | $0 |
| Developer | 10,000 | 200,000 | $29/mo |
| Pro | 100,000 | 2,000,000 | $99/mo |
| Enterprise | Unlimited | Unlimited | Custom |

BlitzQuotes internal: Unlimited (no API key needed from app)

---

## Data Quality Rules

### On submission:
1. **Normalize name**: lowercase, trim whitespace, remove extra spaces
2. **Validate fields**: category, unit must be from allowed list
3. **Validate category**: labor is NOT allowed (use settings instead)
4. **Outlier check**: If cost is >3 std dev from existing mean, flag `is_outlier = true`
5. **Rate limit**: Max 100 submissions per user per day

### On aggregation:
1. **Minimum sample**: Only show aggregates when `sample_size >= 5`
2. **Exclude outliers**: Don't include `is_outlier = true` in aggregates
3. **Time decay**: Weight recent submissions higher (optional, V2)
4. **Recalculate**: Run aggregation job hourly or on-demand

---

## Integration with BlitzQuotes

### Two modes for building quotes:

#### Mode 1: Manual/Search (No AI)
```
User searches: "water heater"
         ↓
BlitzPrices returns matches with costs
         ↓
User picks item, sets quantity
         ↓
App applies user's markup → customer price
         ↓
Quote built. Zero AI tokens.
```

#### Mode 2: AI-Assisted (Minimal tokens)
```
User: "Install 50 gal water heater in garage"
         ↓
Step 1: Extract keywords (simple parsing or tiny AI call)
         ↓
Step 2: BlitzPrices lookup for each keyword (FREE)
   Found: "50 gal water heater" → $485
         ↓
Step 3: Small AI call for reasoning only:
   "Job: Install 50 gal water heater
    Found: water heater $485
    What quantities and additional items needed?"
         ↓
AI returns: { qty: 1, labor_hours: 3, missing: ["permit"] }
         ↓
Step 4: BlitzPrices lookup for missing items (FREE)
         ↓
Step 5: Apply user settings:
   - Material markup: 35%
   - Labor rate: $150/hr
         ↓
Final quote:
   Water heater: $485 × 1.35 = $655
   Labor: 3hrs × $150 = $450
   Permit: $75 × 1.35 = $101
   Total: $1,206
```

**Token comparison:**
| Approach | Tokens |
|----------|--------|
| Old: Send full pricebook to AI | ~2,000-5,000 |
| New: Minimal AI for reasoning | ~200-400 |

### Quote price calculation:
```typescript
// Materials, equipment, fees
customerPrice = cost × (1 + settings.material_markup)

// Labor
laborPrice = hours × settings.labor_rate × (1 + settings.labor_markup)
```

### When user adds pricebook item → submit to BlitzPrices:
```typescript
// After saving to local pricebook
if (settings.contribute_to_community !== false) {
  await submitToBlitzPrices({
    name: item.name,
    category: item.category,  // NOT labor
    unit: item.unit,
    cost: item.cost,          // NOT price (that's after markup)
    region: settings.state,
    zip_code: settings.zip_code,
    source: item.source || 'manual'
  });
}
```

---

## MVP Implementation Plan

### Phase 1: Database
- [ ] Enable pg_trgm extension in Supabase
- [ ] Create `community_prices` table
- [ ] Create `price_aggregates` table
- [ ] Create indexes

### Phase 2: Submission Flow
- [ ] Edge function to accept submissions
- [ ] Validation (no labor category)
- [ ] Normalization
- [ ] Basic outlier detection

### Phase 3: Search API
- [ ] Edge function for search endpoint
- [ ] Trigram matching with scoring
- [ ] Confidence levels in response

### Phase 4: BlitzQuotes Integration
- [ ] Add "Search Items" mode to quote builder
- [ ] Update AI flow to use BlitzPrices first
- [ ] Add user settings for labor rate + markup
- [ ] Submit to BlitzPrices when adding pricebook items

### Phase 5: Public API (Later)
- [ ] API key management
- [ ] Rate limiting middleware
- [ ] Documentation site at blitzprices.com

---

## Categories & Units

### Categories (NO LABOR):
- `materials` - Physical items (pipes, fixtures, parts)
- `equipment` - Tools, machinery
- `fees` - Permits, disposal, service fees

### Units:
- `each` - Individual items
- `foot` - Linear foot
- `sqft` - Square foot
- `gallon` - Liquids
- `lb` - By weight
- `job` - Flat rate per job

---

## Future Enhancements

- **Vector search**: Semantic matching ("hot water tank" = "water heater")
- **Metro areas**: More granular than state when data density allows
- **Price trends**: Track changes over time
- **Brand normalization**: Map variations to canonical names
- **UPC database**: Auto-lookup from scanned barcodes
- **Bulk import**: CSV upload for pricebooks
- **Historical data**: "Prices up 12% in TX this year"
- **Synonyms table**: Map common alternate names

---

## Success Metrics

- Submissions per day/week
- Unique items in database
- Search queries per day
- Match rate (has_match: true vs false)
- Coverage by region
- API signups (when public)
