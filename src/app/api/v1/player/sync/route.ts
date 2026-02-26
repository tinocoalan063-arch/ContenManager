import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

/**
 * POST /api/v1/player/sync
 *
 * Player polls this endpoint to check for playlist updates.
 * Auth: device_key header
 *
 * Request headers:
 *   x-device-key: string
 *
 * Request body:
 *   { current_version?: number }
 *
 * Response:
 *   - If up to date: { success: true, data: { up_to_date: true, version: N } }
 *   - If update needed: { success: true, data: { up_to_date: false, version: N, playlist: {...}, items: [...] } }
 */
export async function POST(request: NextRequest) {
    try {
        const deviceKey = request.headers.get('x-device-key');

        if (!deviceKey) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key requerido en header x-device-key' },
                { status: 401 }
            );
        }

        const supabase = await createServiceClient();

        // Find player by device_key
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, company_id, name')
            .eq('device_key', deviceKey)
            .single();

        if (playerError || !player) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key inválido' },
                { status: 401 }
            );
        }

        // Get all active playlist assignments for this player
        const { data: assignments } = await supabase
            .from('player_playlists')
            .select('*')
            .eq('player_id', player.id)
            .eq('is_active', true)
            .order('assigned_at', { ascending: false });

        if (!assignments || assignments.length === 0) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: { up_to_date: true, version: 0, message: 'Sin playlist asignada' },
            });
        }

        // Filtering logic based on server time
        const now = new Date();
        const nowIso = now.toISOString();
        const nowDate = nowIso.split('T')[0];
        const nowTime = nowIso.split('T')[1].split('.')[0];
        const nowDow = now.getUTCDay(); // 0-6

        // Find the best matching playlist based on schedule
        const activeAssignment = assignments.find(asn => {
            // Date check
            if (asn.start_date && nowDate < asn.start_date) return false;
            if (asn.end_date && nowDate > asn.end_date) return false;

            // Day of week check
            if (asn.days_of_week && Array.isArray(asn.days_of_week)) {
                if (!asn.days_of_week.includes(nowDow)) return false;
            }

            // Time check
            if (asn.start_time && nowTime < asn.start_time) return false;
            if (asn.end_time && nowTime > asn.end_time) return false;

            return true;
        });

        if (!activeAssignment) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: { up_to_date: true, version: 0, message: 'Fuera de horario programado' },
            });
        }

        // Get playlist with items
        const { data: playlist } = await supabase
            .from('playlists')
            .select('id, name, version, playlist_items(*, media:media(*))')
            .eq('id', activeAssignment.playlist_id)
            .single();

        if (!playlist) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: { up_to_date: true, version: 0, message: 'Playlist no encontrada' },
            });
        }

        // Log sync attempt
        await supabase.from('player_logs').insert({
            player_id: player.id,
            event: 'sync_attempt',
            details: {
                playlist_id: playlist.id,
                playlist_name: playlist.name,
                version: playlist.version
            }
        });

        // Check if player already has the latest version
        const body = await request.json().catch(() => ({}));
        const currentVersion = (body as { current_version?: number }).current_version || 0;

        if (currentVersion >= playlist.version) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: {
                    up_to_date: true,
                    version: playlist.version,
                },
            });
        }

        // Return full playlist data for the player to sync
        // Sort items by position
        const sortedItems = (playlist.playlist_items || []).sort(
            (a: { position: number }, b: { position: number }) => a.position - b.position
        );

        // Generate signed URLs for media files
        const itemsWithUrls = await Promise.all(
            sortedItems.map(async (item: {
                id: string;
                position: number;
                duration_seconds: number;
                media: {
                    id: string;
                    name: string;
                    type: string;
                    file_path: string | null;
                    url: string | null;
                    duration_seconds: number;
                } | null;
            }) => {
                let signedUrl = null;
                if (item.media?.file_path) {
                    const { data } = await supabase.storage
                        .from('media')
                        .createSignedUrl(item.media.file_path, 3600); // 1 hour expiry
                    signedUrl = data?.signedUrl || null;
                }

                return {
                    id: item.id,
                    position: item.position,
                    duration_seconds: item.duration_seconds,
                    media: {
                        id: item.media?.id,
                        name: item.media?.name,
                        type: item.media?.type,
                        url: item.media?.url || signedUrl,
                        duration_seconds: item.media?.duration_seconds,
                    },
                };
            })
        );

        // Update player status
        await supabase
            .from('players')
            .update({
                status: 'online',
                last_heartbeat: new Date().toISOString(),
            })
            .eq('id', player.id);

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                up_to_date: false,
                version: playlist.version,
                playlist: {
                    id: playlist.id,
                    name: playlist.name,
                    version: playlist.version,
                },
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
