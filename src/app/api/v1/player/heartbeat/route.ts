import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

/**
 * POST /api/v1/player/heartbeat
 *
 * Player sends periodic heartbeats to report its status.
 * If x-session-id doesn't match the stored session_id, responds with
 * { duplicate: true } so the old device stops playback.
 *
 * Headers:
 *   x-device-key:  string (required)
 *   x-session-id:  string (optional — for duplicate prevention)
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

        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, session_id')
            .eq('device_key', deviceKey)
            .single();

        if (playerError || !player) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key inválido' },
                { status: 401 }
            );
        }

        // ── Duplicate detection ──────────────────────────────────────────
        // If the DB has a session_id and the request sends a DIFFERENT one,
        // a new device has taken over → tell this old device to stop.
        if (player.session_id && requestSessionId && requestSessionId !== player.session_id) {
            return NextResponse.json<ApiResponse>({
                success: true,
                data: {
                    duplicate: true,
                    message: 'Este device_key está activo en otro dispositivo.',
                },
            });
        }

        const body = await request.json().catch(() => ({}));
        const { status, current_version } = body as { status?: string; current_version?: number };

        // Update player heartbeat
        await supabase
            .from('players')
            .update({
                status: 'online',
                last_heartbeat: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', player.id);

        // Log heartbeat (non-blocking)
        try {
            await supabase.from('player_logs').insert({
                player_id: player.id,
                event: 'heartbeat',
                details: {
                    status: status || 'online',
                    current_version: current_version || null,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch { /* ignore */ }

        // Fetch pending commands
        const { data: pendingCommands } = await supabase
            .from('player_commands')
            .select('id, command, payload')
            .eq('player_id', player.id)
            .eq('status', 'pending');

        if (pendingCommands && pendingCommands.length > 0) {
            await supabase
                .from('player_commands')
                .update({ status: 'sent' })
                .in('id', pendingCommands.map(c => c.id));
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                acknowledged: true,
                duplicate: false,
                server_time: new Date().toISOString(),
                commands: pendingCommands || [],
            },
        });
    } catch (error) {
        console.error('Error in heartbeat:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
