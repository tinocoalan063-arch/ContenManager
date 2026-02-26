-- =============================================
-- FIX: RLS Policies - Circular Reference Fix
-- Execute this in Supabase SQL Editor
-- =============================================

-- The original "users_select_same_company" policy has a circular reference.
-- A user can't read from 'users' because the policy itself queries 'users'.
-- Fix: Allow users to read their own row directly by auth.uid().

-- Drop the old policy
DROP POLICY IF EXISTS "users_select_same_company" ON users;

-- 1. Users can always read their own row
CREATE POLICY "users_select_own_row" ON users
  FOR SELECT USING (id = auth.uid());

-- 2. Users can also read other users in their company
-- This works because policy #1 allows reading own row first
CREATE POLICY "users_select_company_members" ON users
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Also add missing DELETE policy for users
CREATE POLICY "users_delete_same_company" ON users
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Add INSERT policy for player_logs (needed for heartbeat)
CREATE POLICY "player_logs_insert" ON player_logs
  FOR INSERT WITH CHECK (true);

-- Update player_playlists to allow updates
CREATE POLICY "player_playlists_update" ON player_playlists
  FOR UPDATE USING (
    player_id IN (
      SELECT id FROM players WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );
