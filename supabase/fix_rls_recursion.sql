-- =============================================
-- FIX 2: RLS Recursion Fix (Using Security Definer)
-- Execute this in Supabase SQL Editor
-- =============================================

-- 1. Create a function to get company_id without triggering RLS recursion
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT company_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up old user policies
DROP POLICY IF EXISTS "users_select_own_row" ON users;
DROP POLICY IF EXISTS "users_select_company_members" ON users;
DROP POLICY IF EXISTS "users_select_own_company" ON companies;

-- 3. New non-recursive policies
-- Users table: Allow reading your own row and others in the same company
CREATE POLICY "users_read_policy" ON users
  FOR SELECT USING (
    company_id = get_my_company_id()
  );

-- Companies table
CREATE POLICY "companies_read_policy" ON companies
  FOR SELECT USING (
    id = get_my_company_id()
  );

-- Patients/Players (and everything else)
DROP POLICY IF EXISTS "players_select_own_company" ON players;
CREATE POLICY "players_read_policy" ON players
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "media_select_own_company" ON media;
CREATE POLICY "media_read_policy" ON media
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "playlists_select_own_company" ON playlists;
CREATE POLICY "playlists_read_policy" ON playlists
  FOR SELECT USING (company_id = get_my_company_id());
