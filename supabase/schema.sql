-- =============================================
-- Digital Signage CMS — Database Schema (MVP)
-- Execute this in Supabase SQL Editor
-- =============================================

-- 1. Companies (Multi-tenant)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  max_storage_mb INTEGER NOT NULL DEFAULT 5120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users (linked to auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'editor')) DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Players
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline')) DEFAULT 'offline',
  last_heartbeat TIMESTAMPTZ,
  group_name TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Media
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'url')),
  file_path TEXT,
  url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 10,
  size_bytes BIGINT DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Playlist Items (media in a playlist with order)
CREATE TABLE IF NOT EXISTS playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Player-Playlist assignments
CREATE TABLE IF NOT EXISTS player_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, playlist_id)
);

-- 8. Player Logs
CREATE TABLE IF NOT EXISTS player_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_players_company ON players(company_id);
CREATE INDEX IF NOT EXISTS idx_players_device_key ON players(device_key);
CREATE INDEX IF NOT EXISTS idx_media_company ON media(company_id);
CREATE INDEX IF NOT EXISTS idx_playlists_company ON playlists(company_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_position ON playlist_items(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_player_playlists_player ON player_playlists(player_id);
CREATE INDEX IF NOT EXISTS idx_player_playlists_playlist ON player_playlists(playlist_id);
CREATE INDEX IF NOT EXISTS idx_player_logs_player ON player_logs(player_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own company
CREATE POLICY "users_select_own_company" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Users can see users in their company
CREATE POLICY "users_select_same_company" ON users
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Users can manage users in their company (admin only handled at app level)
CREATE POLICY "users_insert_same_company" ON users
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "users_update_same_company" ON users
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Players: company isolation
CREATE POLICY "players_select_own_company" ON players
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "players_insert_own_company" ON players
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "players_update_own_company" ON players
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "players_delete_own_company" ON players
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Media: company isolation
CREATE POLICY "media_select_own_company" ON media
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "media_insert_own_company" ON media
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "media_delete_own_company" ON media
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Playlists: company isolation
CREATE POLICY "playlists_select_own_company" ON playlists
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "playlists_insert_own_company" ON playlists
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "playlists_update_own_company" ON playlists
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "playlists_delete_own_company" ON playlists
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Playlist Items: via playlist company
CREATE POLICY "playlist_items_select" ON playlist_items
  FOR SELECT USING (
    playlist_id IN (
      SELECT id FROM playlists WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "playlist_items_insert" ON playlist_items
  FOR INSERT WITH CHECK (
    playlist_id IN (
      SELECT id FROM playlists WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "playlist_items_update" ON playlist_items
  FOR UPDATE USING (
    playlist_id IN (
      SELECT id FROM playlists WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "playlist_items_delete" ON playlist_items
  FOR DELETE USING (
    playlist_id IN (
      SELECT id FROM playlists WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Player Playlists: via player company
CREATE POLICY "player_playlists_select" ON player_playlists
  FOR SELECT USING (
    player_id IN (
      SELECT id FROM players WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "player_playlists_insert" ON player_playlists
  FOR INSERT WITH CHECK (
    player_id IN (
      SELECT id FROM players WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "player_playlists_delete" ON player_playlists
  FOR DELETE USING (
    player_id IN (
      SELECT id FROM players WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Player Logs: via player company
CREATE POLICY "player_logs_select" ON player_logs
  FOR SELECT USING (
    player_id IN (
      SELECT id FROM players WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );
