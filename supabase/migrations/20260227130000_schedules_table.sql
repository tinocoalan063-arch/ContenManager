-- Fase 24: Programación Avanzada (Dayparting)
-- Este script crea la tabla de horarios (schedules) que permite programar qué Playlist
-- se reproduce en qué días y en qué horarios, tanto para Players individuales como para Grupos.

CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    
    -- Se puede asignar a un Player individual o a un Grupo
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.player_groups(id) ON DELETE CASCADE,
    
    -- Condiciones de tiempo
    start_time TIME NOT NULL, -- Ej: '08:00:00'
    end_time TIME NOT NULL,   -- Ej: '18:00:00'
    
    -- Arreglo de enteros para días de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
    days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
    
    -- Prioridad (por defecto 1). Si se solapan dos programaciones, gana la de mayor prioridad.
    priority INTEGER DEFAULT 1,
    
    -- Determina si esta es la playlist "por defecto" (fallback) cuando nada más encaja
    is_fallback BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Restricción para asegurar que se asigna a un player O a un grupo, pero no a ambos a la vez
    CONSTRAINT chk_schedule_target CHECK (
        (player_id IS NOT NULL AND group_id IS NULL) OR 
        (player_id IS NULL AND group_id IS NOT NULL) OR
        (is_fallback = true)
    )
);

-- Habilitar RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Users can view schedules of their company" ON public.schedules;
CREATE POLICY "Users can view schedules of their company" 
ON public.schedules FOR SELECT 
USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert schedules for their company" ON public.schedules;
CREATE POLICY "Users can insert schedules for their company" 
ON public.schedules FOR INSERT 
WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update schedules of their company" ON public.schedules;
CREATE POLICY "Users can update schedules of their company" 
ON public.schedules FOR UPDATE 
USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete schedules of their company" ON public.schedules;
CREATE POLICY "Users can delete schedules of their company" 
ON public.schedules FOR DELETE 
USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
);

-- Índices para búsquedas rápidas al calcular qué reproducir en el backend/player
CREATE INDEX idx_schedules_company ON public.schedules(company_id);
CREATE INDEX idx_schedules_player ON public.schedules(player_id);
CREATE INDEX idx_schedules_group ON public.schedules(group_id);
