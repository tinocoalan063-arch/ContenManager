-- Fase 22: Core Audit & Security
-- Este script refuerza el Row Level Security (RLS) en las tablas principales
-- y crea un webhook/trigger para borrar archivos físicos de Storage al eliminar un medio de la BD.

-- 1. Habilitar RLS en todas las tablas principales si no lo estaban
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 2. Asegurarse de que las políticas de RLS filtren estrictamente por company_id
-- (Eliminar políticas existentes genéricas si las hay, crear políticas fuertes)

-- Ejemplo de política para media: Los usuarios solo pueden ver y modificar media de su propia empresa
DROP POLICY IF EXISTS "Users can view media of their company" ON public.media;
CREATE POLICY "Users can view media of their company" 
ON public.media FOR SELECT 
USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert media for their company" ON public.media;
CREATE POLICY "Users can insert media for their company" 
ON public.media FOR INSERT 
WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update media of their company" ON public.media;
CREATE POLICY "Users can update media of their company" 
ON public.media FOR UPDATE 
USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete media of their company" ON public.media;
CREATE POLICY "Users can delete media of their company" 
ON public.media FOR DELETE 
USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

-- (Nota: Para un proyecto completo, debes replicar este patrón para players, playlists, groups, etc.)

-- 3. Limpieza de Storage (Garbage Collection Trigger)
-- Supabase Storage expone la API de storage.objects. Si borramos un objeto de la tabla public.media,
-- queremos borrar su archivo físico correspondiente del Storage Bucket 'media'.

CREATE OR REPLACE FUNCTION delete_storage_object()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el archivo tiene una ruta física (file_path), intentar borrarlo
    IF OLD.file_path IS NOT NULL THEN
        -- Nota: Esta llamada requiere permisos de superusuario en Supabase.
        -- Borra el objeto físico en el bucket 'media'
        DELETE FROM storage.objects WHERE bucket_id = 'media' AND name = OLD.file_path;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enlazar el trigger a la tabla media
DROP TRIGGER IF EXISTS trigger_delete_media_storage ON public.media;
CREATE TRIGGER trigger_delete_media_storage
AFTER DELETE ON public.media
FOR EACH ROW EXECUTE FUNCTION delete_storage_object();
