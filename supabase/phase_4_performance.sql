-- Phase 4: Performance Optimization & Indexing

-- Index for analytics and log queries
CREATE INDEX IF NOT EXISTS idx_playback_logs_company_date ON playback_logs (company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_logs_player ON playback_logs (player_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_media ON playback_logs (media_id);

-- Index for real-time operation and command delivery
CREATE INDEX IF NOT EXISTS idx_player_commands_status ON player_commands (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_player_commands_player_status ON player_commands (player_id, status);

-- Index for common filters
CREATE INDEX IF NOT EXISTS idx_players_company ON players (company_id);
CREATE INDEX IF NOT EXISTS idx_media_company ON media (company_id);
CREATE INDEX IF NOT EXISTS idx_playlists_company ON playlists (company_id);
CREATE INDEX IF NOT EXISTS idx_player_groups_company ON player_groups (company_id);

-- Maintenance: Cleanup old logs (Optional policy)
-- DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';
