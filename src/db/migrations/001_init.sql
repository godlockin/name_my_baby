-- D1 Database Schema for Name My Baby

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  creator_device_id TEXT NOT NULL,
  creator_phone TEXT,
  used_by_device_id TEXT,
  used_by_phone TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'used', 'expired')),
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  expires_at INTEGER NOT NULL
);

-- Index for looking up by device
CREATE INDEX IF NOT EXISTS idx_invite_codes_creator ON invite_codes(creator_device_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON invite_codes(status);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  phone TEXT,
  input_data TEXT NOT NULL,
  result_data TEXT,
  invite_code_used TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for looking up sessions by device
CREATE INDEX IF NOT EXISTS idx_user_sessions_device ON user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created ON user_sessions(created_at);
