import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';
import { randomUUID } from 'crypto';

/**
 * POST /api/v1/player/sync
 *
 * Player polls this endpoint to check for playlist updates.
 * Auth: device_key header + optional session_id for duplicate prevention.
 *
 * Headers:
 *   x-device-key:   string (required)
 *   x-session-id:   string (optional — sent after first connection)
 */
export async function POST(request: NextRequest) {
    try {
        const deviceKey = request.headers.get('x-device-key');
        const requestSessionId = request.headers.get('x-session-id');

        if (!deviceKey) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key requerido' },
                { status: 401 }
            );
        }

        const supabase = await createServiceClient();

        // Find player by device_key
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, company_id, name, group_id, session_id')
            .eq('device_key', deviceKey)
            .single();

        if (playerError || !player) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key inválido' },
                { status: 401 }
            );
        }

        // ── Session management (duplicate prevention) ────────────────────
        // If the player doesn't have a session yet, or the client presents
        // no session_id, generate a new one (first connection or re-pair).
        // If the client sends a session_id that differs from DB → new device
        // is taking over, generate new session_id (old device gets evicted).
        let activeSessionId = player.session_id;
        let sessionChanged = false;

        if (!requestSessionId || !activeSessionId || requestSessionId !== activeSessionId) {
            // Generate a new session and save it (evicts any previous connection)
            activeSessionId = randomUUID();
            sessionChanged = true;
            await supabase
                .from('players')
                .update({ session_id: activeSessionId })
                .eq('id', player.id);
        }

        // ── Schedule matching ────────────────────────────────────────────
        const now = new Date();
        const nowTime = now.toTimeString().split(' ')[0];
        const nowDow = now.getDay();

        let schedulesQuery = supabase
            .from('schedules')
            .select('id, playlist_id, start_time, end_time, days_of_week, priority, is_fallback')
            .eq('company_id', player.company_id)
            .order('priority', { ascending: false });

        if (player.group_id) {
            schedulesQuery = schedulesQuery.or(`player_id.eq.${player.id},group_id.eq.${player.group_id}`);
        } else {
            schedulesQuery = schedulesQuery.eq('player_id', player.id);
        }

        const { data: schedules } = await schedulesQuery;

        if (!schedules || schedules.length === 0) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: { up_to_date: true, version: 0, message: 'Sin playlist asignada', session_id: activeSessionId },
            });
        }

        let activeSchedule = schedules.find((s: any) => {
            if (s.days_of_week && Array.isArray(s.days_of_week)) {
                if (!s.days_of_week.includes(nowDow)) return false;
            }
            if (s.start_time && nowTime < s.start_time) return false;
            if (s.end_time && nowTime > s.end_time) return false;
            return !s.is_fallback;
        });

        if (!activeSchedule) activeSchedule = schedules.find((s: any) => s.is_fallback);

        if (!activeSchedule) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: { up_to_date: true, version: 0, message: 'Fuera de horario', session_id: activeSessionId },
            });
        }

        // ── Fetch playlist ───────────────────────────────────────────────
        const { data: playlist } = await supabase
            .from('playlists')
            .select('id, name, version, playlist_items(id, position, duration_seconds, transition_type, media:media(id, name, type, file_path, url, duration_seconds, config))')
            .eq('id', activeSchedule.playlist_id)
            .single();

        if (!playlist) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: { up_to_date: true, version: 0, message: 'Playlist no encontrada', session_id: activeSessionId },
            });
        }

        const body = await request.json().catch(() => ({}));
        const currentVersion = (body as { current_version?: number }).current_version || 0;

        // Update player status (non-blocking)
        void supabase.from('players').update({
            status: 'online',
            last_heartbeat: now.toISOString(),
        }).eq('id', player.id);

        // Log sync attempt (non-blocking)
        try {
            await supabase.from('player_logs').insert({
                player_id: player.id,
                event: 'sync_attempt',
                details: { playlist_id: playlist.id, version: playlist.version, client_version: currentVersion }
            });
        } catch { /* ignore */ }

        // If new session was issued or version is current, return with session_id
        if (!sessionChanged && currentVersion >= playlist.version) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: { up_to_date: true, version: playlist.version, session_id: activeSessionId },
            });
        }

        // ── Prepare items with signed URLs ───────────────────────────────
        const sortedItems = (playlist.playlist_items || []).sort(
            (a: { position: number }, b: { position: number }) => a.position - b.position
        );

        const itemsWithUrls = await Promise.all(
            sortedItems.map(async (item: any) => {
                const media = item.media;
                let signedUrl = null;

                if (media?.file_path) {
                    const { data } = await supabase.storage.from('media').createSignedUrl(media.file_path, 7200);
                    signedUrl = data?.signedUrl || null;
                }

                let resolvedConfig = media?.config || null;
                if (media?.type === 'widget' && resolvedConfig) {
                    try {
                        const configObj = typeof resolvedConfig === 'string' ? JSON.parse(resolvedConfig) : resolvedConfig;
                        if (configObj.backgrounds && Array.isArray(configObj.backgrounds)) {
                            const resolvedBgs = await Promise.all(
                                configObj.backgrounds.map(async (bg: any) => {
                                    const { data: bgMedia } = await supabase.from('media').select('file_path').eq('id', bg.id).single();
                                    if (bgMedia?.file_path) {
                                        const { data: signedBg } = await supabase.storage.from('media').createSignedUrl(bgMedia.file_path, 7200);
                                        return { ...bg, preview_url: signedBg?.signedUrl || bg.preview_url };
                                    }
                                    return bg;
                                })
                            );
                            resolvedConfig = { ...configObj, backgrounds: resolvedBgs };
                        } else {
                            resolvedConfig = configObj;
                        }
                    } catch { resolvedConfig = null; }
                }

                return {
                    id: item.id,
                    position: item.position,
                    duration_seconds: item.duration_seconds,
                    transition_type: item.transition_type || 'none',
                    media: {
                        id: media?.id,
                        name: media?.name,
                        type: media?.type,
                        url: media?.url || signedUrl,
                        duration_seconds: media?.duration_seconds,
                        config: resolvedConfig,
                    },
                };
            })
        );

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                up_to_date: false,
                version: playlist.version,
                session_id: activeSessionId, // Always return session_id so player can store it
                playlist: { id: playlist.id, name: playlist.name, version: playlist.version },
                items: itemsWithUrls,
            },
        });
    } catch (error) {
        console.error('Error in player sync:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
