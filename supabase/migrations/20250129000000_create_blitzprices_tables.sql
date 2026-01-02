-- BlitzPrices: Crowdsourced pricing database for contractors
-- Migration: Create core tables and enable fuzzy search

-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- COMMUNITY_PRICES: Core table storing all price submissions
-- =============================================================================
CREATE TABLE IF NOT EXISTS community_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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
  sku TEXT,

  -- Constraints
  CONSTRAINT valid_category CHECK (category IN ('materials', 'equipment', 'fees')),
  CONSTRAINT valid_unit CHECK (unit IN ('each', 'foot', 'sqft', 'gallon', 'lb', 'job')),
  CONSTRAINT positive_cost CHECK (cost >= 0)
);

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS idx_community_prices_name_trgm
  ON community_prices USING GIN (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_community_prices_region
  ON community_prices(region);
CREATE INDEX IF NOT EXISTS idx_community_prices_category
  ON community_prices(category);
CREATE INDEX IF NOT EXISTS idx_community_prices_submitted
  ON community_prices(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_prices_upc
  ON community_prices(upc) WHERE upc IS NOT NULL;

-- Trigger to auto-populate name_normalized
CREATE OR REPLACE FUNCTION normalize_community_price_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name_normalized := LOWER(TRIM(REGEXP_REPLACE(NEW.name, '\s+', ' ', 'g')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_name
  BEFORE INSERT OR UPDATE ON community_prices
  FOR EACH ROW
  EXECUTE FUNCTION normalize_community_price_name();

-- =============================================================================
-- PRICE_AGGREGATES: Pre-computed aggregates for fast API responses
-- =============================================================================
CREATE TABLE IF NOT EXISTS price_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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

-- Indexes for aggregate search
CREATE INDEX IF NOT EXISTS idx_price_aggregates_search
  ON price_aggregates USING GIN (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_price_aggregates_region
  ON price_aggregates(region);
CREATE INDEX IF NOT EXISTS idx_price_aggregates_category
  ON price_aggregates(category);

-- =============================================================================
-- BLITZPRICES_API_KEYS: For tracking external API access
-- =============================================================================
CREATE TABLE IF NOT EXISTS blitzprices_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,         -- Hashed API key
  name TEXT,                             -- "My App", "Development"
  tier TEXT NOT NULL DEFAULT 'free',     -- free, developer, pro, enterprise

  -- Rate limiting
  requests_today INTEGER DEFAULT 0,
  requests_month INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  last_reset_date DATE DEFAULT CURRENT_DATE,

  -- Limits by tier
  daily_limit INTEGER NOT NULL DEFAULT 100,
  monthly_limit INTEGER DEFAULT 2000,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_email TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- Constraints
  CONSTRAINT valid_tier CHECK (tier IN ('free', 'developer', 'pro', 'enterprise'))
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE community_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE blitzprices_api_keys ENABLE ROW LEVEL SECURITY;

-- Community prices: Anyone can read aggregated data, authenticated users can submit
CREATE POLICY "Anyone can read community prices"
  ON community_prices FOR SELECT
  USING (TRUE);

CREATE POLICY "Authenticated users can submit prices"
  ON community_prices FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Price aggregates: Public read access
CREATE POLICY "Anyone can read price aggregates"
  ON price_aggregates FOR SELECT
  USING (TRUE);

-- API keys: Only service role can manage
CREATE POLICY "Service role manages API keys"
  ON blitzprices_api_keys FOR ALL
  TO service_role
  USING (TRUE);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to search prices with fuzzy matching
CREATE OR REPLACE FUNCTION search_blitzprices(
  search_query TEXT,
  search_region TEXT,
  search_category TEXT DEFAULT NULL,
  similarity_threshold NUMERIC DEFAULT 0.3,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  name TEXT,
  category TEXT,
  unit TEXT,
  avg_cost NUMERIC,
  min_cost NUMERIC,
  max_cost NUMERIC,
  sample_size INTEGER,
  similarity NUMERIC,
  confidence TEXT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.display_name,
    pa.category,
    pa.unit,
    pa.avg_cost,
    pa.min_cost,
    pa.max_cost,
    pa.sample_size,
    similarity(pa.name_normalized, LOWER(TRIM(search_query)))::NUMERIC AS sim,
    CASE
      WHEN similarity(pa.name_normalized, LOWER(TRIM(search_query))) > 0.5 THEN 'high'
      WHEN similarity(pa.name_normalized, LOWER(TRIM(search_query))) > 0.3 THEN 'medium'
      ELSE 'low'
    END AS conf,
    pa.last_submission
  FROM price_aggregates pa
  WHERE pa.region = search_region
    AND similarity(pa.name_normalized, LOWER(TRIM(search_query))) > similarity_threshold
    AND (search_category IS NULL OR pa.category = search_category)
    AND pa.sample_size >= 5  -- Only return items with enough data points
  ORDER BY sim DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to compute/refresh aggregates for a specific item
CREATE OR REPLACE FUNCTION refresh_price_aggregate(
  item_name_normalized TEXT,
  item_region TEXT,
  item_category TEXT,
  item_unit TEXT
)
RETURNS VOID AS $$
DECLARE
  agg_stats RECORD;
  common_name TEXT;
BEGIN
  -- Calculate aggregate stats (excluding outliers)
  SELECT
    AVG(cost)::NUMERIC(10,2) as avg_cost,
    MIN(cost)::NUMERIC(10,2) as min_cost,
    MAX(cost)::NUMERIC(10,2) as max_cost,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost)::NUMERIC(10,2) as median_cost,
    COUNT(*)::INTEGER as sample_size,
    MAX(submitted_at) as last_submission
  INTO agg_stats
  FROM community_prices
  WHERE name_normalized = item_name_normalized
    AND region = item_region
    AND category = item_category
    AND unit = item_unit
    AND is_outlier = FALSE;

  -- Get most common display name
  SELECT name INTO common_name
  FROM community_prices
  WHERE name_normalized = item_name_normalized
    AND region = item_region
  GROUP BY name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Upsert the aggregate
  INSERT INTO price_aggregates (
    name_normalized, region, category, unit,
    avg_cost, min_cost, max_cost, median_cost, sample_size,
    last_submission, last_computed, display_name
  )
  VALUES (
    item_name_normalized, item_region, item_category, item_unit,
    agg_stats.avg_cost, agg_stats.min_cost, agg_stats.max_cost,
    agg_stats.median_cost, agg_stats.sample_size,
    agg_stats.last_submission, NOW(), common_name
  )
  ON CONFLICT (name_normalized, region, category, unit)
  DO UPDATE SET
    avg_cost = EXCLUDED.avg_cost,
    min_cost = EXCLUDED.min_cost,
    max_cost = EXCLUDED.max_cost,
    median_cost = EXCLUDED.median_cost,
    sample_size = EXCLUDED.sample_size,
    last_submission = EXCLUDED.last_submission,
    last_computed = EXCLUDED.last_computed,
    display_name = EXCLUDED.display_name;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update aggregates when new price is submitted
CREATE OR REPLACE FUNCTION trigger_refresh_aggregate()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_price_aggregate(
    NEW.name_normalized,
    NEW.region,
    NEW.category,
    NEW.unit
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_aggregate_on_insert
  AFTER INSERT ON community_prices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_aggregate();
