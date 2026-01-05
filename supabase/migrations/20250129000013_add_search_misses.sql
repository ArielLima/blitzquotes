-- Track searches that returned no results
-- Helps identify gaps in our pricing database

CREATE TABLE IF NOT EXISTS search_misses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'US',
  category TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',  -- 'direct_search', 'quote_generation', 'app'
  user_id UUID REFERENCES auth.users,       -- optional, for logged-in users
  hit_count INTEGER NOT NULL DEFAULT 1,     -- increment on duplicate queries
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,                  -- set when we add this item to DB

  UNIQUE(query, region)                     -- deduplicate by query+region
);

-- Index for finding most requested missing items
CREATE INDEX IF NOT EXISTS idx_search_misses_hit_count ON search_misses(hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_search_misses_last_seen ON search_misses(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_misses_unresolved ON search_misses(resolved_at) WHERE resolved_at IS NULL;

-- RLS: Allow service role full access, users can read their own
ALTER TABLE search_misses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage search_misses"
  ON search_misses FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to log a search miss (upserts: increments hit_count if exists)
CREATE OR REPLACE FUNCTION log_search_miss(
  p_query TEXT,
  p_region TEXT DEFAULT 'US',
  p_category TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'unknown',
  p_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO search_misses (query, region, category, source, user_id, hit_count, first_seen_at, last_seen_at)
  VALUES (LOWER(TRIM(p_query)), UPPER(p_region), p_category, p_source, p_user_id, 1, NOW(), NOW())
  ON CONFLICT (query, region) DO UPDATE SET
    hit_count = search_misses.hit_count + 1,
    last_seen_at = NOW(),
    source = COALESCE(EXCLUDED.source, search_misses.source),
    user_id = COALESCE(EXCLUDED.user_id, search_misses.user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
