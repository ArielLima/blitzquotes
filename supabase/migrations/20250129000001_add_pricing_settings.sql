-- Add new pricing settings columns to user_settings
-- These fields are needed for quote calculations with BlitzPrices

-- Add state for BlitzPrices regional pricing
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS state TEXT;

-- Add labor rate ($/hr)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS labor_rate NUMERIC(10,2) NOT NULL DEFAULT 100;

-- Add helper rate ($/hr, optional)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS helper_rate NUMERIC(10,2);

-- Rename default_markup to material_markup (keep both for backwards compatibility)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS material_markup NUMERIC(5,4) NOT NULL DEFAULT 0.35;

-- Copy existing default_markup values to material_markup
UPDATE user_settings SET material_markup = default_markup WHERE material_markup = 0.35 AND default_markup != 0.35;

-- Add equipment markup (optional, defaults to material_markup)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS equipment_markup NUMERIC(5,4);

-- Add fee markup (optional, often 0)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fee_markup NUMERIC(5,4) DEFAULT 0;

-- Add BlitzPrices contribution toggle
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS contribute_to_blitzprices BOOLEAN DEFAULT TRUE;

-- Comment on new columns
COMMENT ON COLUMN user_settings.labor_rate IS 'Hourly labor rate in dollars';
COMMENT ON COLUMN user_settings.helper_rate IS 'Hourly helper rate in dollars (optional)';
COMMENT ON COLUMN user_settings.material_markup IS 'Markup percentage for materials as decimal (e.g., 0.35 = 35%)';
COMMENT ON COLUMN user_settings.equipment_markup IS 'Markup percentage for equipment (defaults to material_markup if null)';
COMMENT ON COLUMN user_settings.fee_markup IS 'Markup percentage for fees (often 0)';
COMMENT ON COLUMN user_settings.state IS 'State code for BlitzPrices regional pricing (e.g., CA, TX)';
COMMENT ON COLUMN user_settings.contribute_to_blitzprices IS 'Whether to contribute pricing data to BlitzPrices community database';
