-- =============================================
-- Phase 2: Database Updates
-- 1. Player Groups
-- 2. Scheduling Columns
-- 3. Company Settings
-- =============================================

-- 1. Player Groups
CREATE TABLE IF NOT EXISTS player_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add group_id to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES player_groups(id) ON DELETE SET NULL;

-- 2. Scheduling Columns in player_playlists
ALTER TABLE player_playlists 
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS days_of_week INTEGER[]; -- 0=Sunday, 1=Monday, etc.

-- 3. Company enhancements
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS storage_limit_mb INTEGER NOT NULL DEFAULT 5120,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- =============================================
-- RLS for new table
-- =============================================
ALTER TABLE player_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_groups_read_policy" ON player_groups
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "player_groups_insert_policy" ON player_groups
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "player_groups_update_policy" ON player_groups
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "player_groups_delete_policy" ON player_groups
  FOR DELETE USING (company_id = get_my_company_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_groups_company ON player_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_players_group ON players(group_id);
