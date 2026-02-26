-- =============================================
-- Digital Signage CMS — Phase 3 Updates
-- =============================================

-- 1. Remote Player Commands
CREATE TABLE IF NOT EXISTS player_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    command TEXT NOT NULL, -- REBOOT, SCREENSHOT, CLEAR_CACHE, REFRESH
    payload JSONB DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'executed', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_player_commands_player ON player_commands(player_id);
CREATE INDEX IF NOT EXISTS idx_player_commands_status ON player_commands(status);

-- 2. Update Media Types
-- We need to drop the existing constraint and recreate it to include 'widget'
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_type_check;
ALTER TABLE media ADD CONSTRAINT media_type_check CHECK (type IN ('image', 'video', 'url', 'widget'));

-- 3. Analytics: playback_logs (Optimized for Proof of Play)
-- While player_logs exists, a specialist table for media playback is better for performance
CREATE TABLE IF NOT EXISTS playback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'completed'
);

CREATE INDEX IF NOT EXISTS idx_playback_logs_company ON playback_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_player ON playback_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_media ON playback_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_time ON playback_logs(started_at);

-- 4. RLS for new tables
ALTER TABLE player_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_logs ENABLE ROW LEVEL SECURITY;

-- player_commands: company isolation via player
CREATE POLICY "player_commands_select" ON player_commands
    FOR SELECT USING (
        player_id IN (
            SELECT id FROM players WHERE company_id IN (
                SELECT company_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "player_commands_insert" ON player_commands
    FOR INSERT WITH CHECK (
        player_id IN (
            SELECT id FROM players WHERE company_id IN (
                SELECT company_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- playback_logs: company isolation
CREATE POLICY "playback_logs_select" ON playback_logs
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- 5. Trigger for updated_at (standard procedure)
-- (Assuming the function already exists from schema.sql)
-- If not, it was:
-- CREATE OR REPLACE FUNCTION update_updated_at_column() ...

-- 6. Add "last_screenshot_url" to players for remote commands visibility
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_screenshot_url TEXT;
