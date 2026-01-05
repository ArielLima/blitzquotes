-- Add subscription status to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free';
-- 'free' = 3 quotes/month limit
-- 'active' = paid subscriber, unlimited
-- 'canceled' = was active, now reverted to free

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_subscription ON user_settings(subscription_status);
