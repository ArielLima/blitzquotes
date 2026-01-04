-- Add source column to identify which function generated the trace
ALTER TABLE quote_traces ADD COLUMN source TEXT;

-- Index for filtering by source
CREATE INDEX idx_quote_traces_source ON quote_traces(source);
