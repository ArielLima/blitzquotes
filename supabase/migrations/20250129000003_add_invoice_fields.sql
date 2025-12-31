-- Add invoice-related fields to quotes table
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'quote',
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_quotes_type ON quotes(type);
