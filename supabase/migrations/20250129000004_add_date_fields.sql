-- Add date fields for quotes and invoices
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS valid_until DATE,
ADD COLUMN IF NOT EXISTS work_date DATE,
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Add index for due date queries (finding overdue invoices)
CREATE INDEX IF NOT EXISTS idx_quotes_due_date ON quotes(due_date) WHERE due_date IS NOT NULL;
