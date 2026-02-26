-- =============================================
-- FIX 4: Supabase Storage RLS Policies
-- Execute this in Supabase SQL Editor
-- =============================================

-- Ensure RLS is enabled for storage
-- (Note: Usually enabled by default in Supabase, but good to be sure)

-- 1. Policy to allow users to upload files to their company folder
CREATE POLICY "Allow company uploads" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_my_company_id()::text
  );

-- 2. Policy to allow users to view files in their company folder
CREATE POLICY "Allow company selects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_my_company_id()::text
  );

-- 3. Policy to allow users to delete files in their company folder
CREATE POLICY "Allow company deletes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_my_company_id()::text
  );

-- 4. Policy to allow public access to the media bucket (if intended)
-- OR specific policy for players using device key (more advanced)
-- For Phase 1, we use Signed URLs which bypass RLS on SELECT if the URL is valid.
-- However, the admin panel needs SELECT to show previews.
