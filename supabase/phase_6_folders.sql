-- 1. Fix Media Type Constraint (Add 'widget')
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_type_check;
ALTER TABLE media ADD CONSTRAINT media_type_check CHECK (type IN ('image', 'video', 'url', 'widget'));

-- 1.5 Add config column for widgets
ALTER TABLE media ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- 2. Create Folders Table
CREATE TABLE IF NOT EXISTS media_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES media_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add folder_id to Media
ALTER TABLE media ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES media_folders(id) ON DELETE SET NULL;

-- 4. Enable RLS on Folders
ALTER TABLE media_folders ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Folders
DROP POLICY IF EXISTS "media_folders_select_own_company" ON media_folders;
CREATE POLICY "media_folders_select_own_company" ON media_folders
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "media_folders_insert_own_company" ON media_folders;
CREATE POLICY "media_folders_insert_own_company" ON media_folders
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "media_folders_update_own_company" ON media_folders;
CREATE POLICY "media_folders_update_own_company" ON media_folders
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "media_folders_delete_own_company" ON media_folders;
CREATE POLICY "media_folders_delete_own_company" ON media_folders
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_media_folders_company ON media_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_media_folder_id ON media(folder_id);
