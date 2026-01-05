# BlitzPrices Data Migration

Import BrightData scrape data into Supabase for BlitzPrices.

## Setup

1. **Create the table in Supabase:**
   - Go to Supabase Dashboard → SQL Editor
   - Run the contents of `schema.sql`

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase URL and service role key
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

**Dry run (test without writing):**
```bash
node migrate.js ./data/plumbing.json --dry-run
```

**Live import:**
```bash
node migrate.js ./data/plumbing.json
```

**Import all categories:**
```bash
# Run each category one at a time
node migrate.js ./data/plumbing.json
node migrate.js ./data/electrical.json
node migrate.js ./data/hvac.json
# ... etc
```

## What it does

1. Reads JSON file from BrightData scrape
2. Transforms each product to our schema (extracts only what we need)
3. Upserts into Supabase in batches of 50
4. Rate limits to 100ms between batches
5. Reports progress and errors

## Data transformation

**Kept:**
- source, source_product_id, source_url
- sku, model_number, upc (GTIN-13)
- name, description, manufacturer
- price, original_price, in_stock
- category, root_category
- rating, review_count
- image_url, dimensions

**Skipped:**
- Multiple images (we keep main_image only)
- Reviews text
- Q&A
- Features array
- Most metadata

## Troubleshooting

**"Missing product_id and sku"** - Product doesn't have identifiers, skipped

**"Missing product_name"** - Product has no name, skipped

**Rate limit errors** - Increase DELAY_MS in migrate.js

**Duplicate key errors** - Expected on re-runs, upsert handles this
