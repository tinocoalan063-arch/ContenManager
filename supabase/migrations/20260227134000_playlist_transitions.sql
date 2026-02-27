-- Fase 25: Transiciones y Efectos de Playlists
-- Este script añade la columna 'transition_type' a la tabla playlist_items
-- para permitir efectos visuales al cambiar de un medio a otro.

ALTER TABLE public.playlist_items
ADD COLUMN IF NOT EXISTS transition_type VARCHAR(50) DEFAULT 'none';

-- Opciones planeadas en el frontend: 'none' (Corte directo), 'fade' (Desvanecimiento), 'slide' (Deslizar lado)
