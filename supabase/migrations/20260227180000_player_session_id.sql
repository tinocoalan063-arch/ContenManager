-- Migration: Add session_id column to players table
-- Run this in Supabase SQL Editor
-- Path: supabase/migrations/20260227180000_player_session_id.sql

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS session_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.players.session_id IS 
'Tracks the active connection session. Only the device holding this session_id can sync/heartbeat. Prevents duplicate simultaneous connections with the same device_key.';
