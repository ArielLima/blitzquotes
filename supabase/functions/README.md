# Supabase Edge Functions

BlitzQuotes backend services running on Supabase Edge Functions.

## Functions

### `ai/`
AI-powered quote generation using OpenRouter.

**Endpoint:** `POST /functions/v1/ai`

```json
{
  "action": "generate_quote",
  "job_description": "Replace 50 gallon gas water heater",
  "trade": "plumbing",
  "settings": {
    "labor_rate": 150,
    "material_markup": 0.35,
    "default_tax_rate": 0.08
  }
}
```

### `blitzprices/`
Search and submit prices to the BlitzPrices database.

**Search:** `GET /functions/v1/blitzprices?q=water+heater&region=TX`

**Submit:** `POST /functions/v1/blitzprices`
```json
{
  "name": "50 Gallon Gas Water Heater",
  "category": "materials",
  "unit": "each",
  "cost": 485.00,
  "region": "TX"
}
```

### `quote-view/`
Public customer quote viewing page. Returns JSON for the quote viewer.

**Endpoint:** `GET /functions/v1/quote-view?id=<quote-id>`

Returns quote details, business info, and payment link.

## Deployment

```bash
# Deploy all functions
make deploy-functions

# Deploy individual function
supabase functions deploy ai
supabase functions deploy blitzprices
supabase functions deploy quote-view

# Or use make targets
make deploy-ai
make deploy-blitzprices
make deploy-quote-view
```

## Environment Secrets

Set via Supabase CLI:

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxx
```

## Local Development

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve
```
