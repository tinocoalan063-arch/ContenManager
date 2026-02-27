-- Fase 23: Mapa en Vivo de Dispositivos (Geolocalización)
-- Este script añade las columnas necesarias a la tabla players para almacenar sus coordenadas GPS

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

-- Valores predeterminados opcionales para evitar nulos drásticos si se desea (ej: 0.0)
-- Por ahora se permite NULL indicando que un player no tiene ubicación asignada aún.
