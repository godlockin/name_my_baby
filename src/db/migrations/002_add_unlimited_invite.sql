-- Add is_unlimited column to invite_codes table
-- This allows certain invite codes to be used infinitely without being marked as 'used'

ALTER TABLE invite_codes ADD COLUMN is_unlimited INTEGER NOT NULL DEFAULT 0;

-- Add index for querying unlimited codes
CREATE INDEX IF NOT EXISTS idx_invite_codes_unlimited ON invite_codes(is_unlimited);
