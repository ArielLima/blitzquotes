-- Add contractor_discount to user_settings
-- This stores the discount contractors get off retail prices (e.g., 0.15 for 15% off)
-- BlitzPrices stores retail prices, and this discount is applied to calculate contractor cost

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS contractor_discount NUMERIC(5,4) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.contractor_discount IS 'Discount off retail prices (e.g., 0.15 = 15% off). Cost = retail × (1 - discount)';
