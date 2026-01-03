-- Add labor fields to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS labor_hours NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS labor_rate NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS labor_total NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN quotes.labor_hours IS 'Number of labor hours';
COMMENT ON COLUMN quotes.labor_rate IS 'Hourly rate used for this quote';
COMMENT ON COLUMN quotes.labor_total IS 'Total labor cost (hours * rate)';
