import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

/**
 * POST /api/v1/player/playback/log
 * 
 * Player reports a media playback event for analytics (Proof of Play).
 */
export async function POST(request: NextRequest) {
    try {
        const deviceKey = request.headers.get('x-device-key');
        if (!deviceKey) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key requerido' },
                { status: 401 }
            );
        }

        const supabase = await createServiceClient();

        // Identify player
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, company_id')
            .eq('device_key', deviceKey)
            .single();

        if (playerError || !player) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key inválido' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { media_id, playlist_id, started_at, ended_at, duration_seconds } = body;

        if (!media_id || !started_at) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Campos requeridos faltantes (media_id, started_at)' },
                { status: 400 }
            );
        }

        // Insert playback log
        const { error: insertError } = await supabase
            .from('playback_logs')
            .insert({
                company_id: player.company_id,
                player_id: player.id,
                media_id,
                playlist_id: playlist_id || null,
                started_at,
                ended_at: ended_at || new Date().toISOString(),
                duration_seconds: duration_seconds || 0,
                status: 'completed'
            });

        if (insertError) throw insertError;

        return NextResponse.json<ApiResponse>({
            success: true,
            data: { logged: true }
        });
    } catch (error) {
        console.error('Error in playback logging:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno' },
            { status: 500 }
        );
    }
}
