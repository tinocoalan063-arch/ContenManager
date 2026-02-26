-- =============================================
-- ADD MISSING RLS UPDATE POLICIES
-- =============================================

-- 1. Allow users to update media (for folder organization and renaming)
DROP POLICY IF EXISTS "media_update_own_company" ON media;
CREATE POLICY "media_update_own_company" ON media
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- 2. Allow users to update player_playlists (for scheduling/assignment changes)
DROP POLICY IF EXISTS "player_playlists_update" ON player_playlists;
CREATE POLICY "player_playlists_update" ON player_playlists
  FOR UPDATE USING (
    player_id IN (
      SELECT id FROM players WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- 3. Confirm policies are set
DO $$
BEGIN
    RAISE NOTICE 'Missing UPDATE policies for media and player_playlists have been added.';
END $$;
