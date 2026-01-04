-- Add push token field to user_settings for Expo push notifications
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Index for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_user_settings_push_token ON user_settings(push_token) WHERE push_token IS NOT NULL;
