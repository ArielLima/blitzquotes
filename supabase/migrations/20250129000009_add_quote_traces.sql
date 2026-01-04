-- Quote generation traces for debugging AI workflow
CREATE TABLE quote_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,  -- Groups all steps for one quote generation
  step TEXT NOT NULL,      -- e.g., 'extract_materials', 'search_blitzprices', 'select_items'
  step_number INT NOT NULL,
  duration_ms INT,
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast trace lookup
CREATE INDEX idx_quote_traces_trace_id ON quote_traces(trace_id);
CREATE INDEX idx_quote_traces_created_at ON quote_traces(created_at DESC);

-- Allow service role full access (Edge Functions use service role)
ALTER TABLE quote_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage traces"
  ON quote_traces FOR ALL
  USING (true)
  WITH CHECK (true);

-- Optional: auto-delete traces older than 7 days (to save space)
-- You can run this manually or set up a cron job
-- DELETE FROM quote_traces WHERE created_at < NOW() - INTERVAL '7 days';
