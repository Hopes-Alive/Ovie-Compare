-- App-wide settings (key/value JSON). Used for chat UI theming.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings (updated_at DESC);

-- Seed empty chat design row (merged with defaults at runtime)
INSERT INTO app_settings (key, value)
VALUES ('chat_design', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
