-- Add job address field to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS job_address TEXT;

COMMENT ON COLUMN quotes.job_address IS 'Address where the work will be/was performed';
