import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

/**
 * POST /api/v1/player/heartbeat
 *
 * Player sends periodic heartbeats to report its status.
 * Auth: device_key header
 *
 * Request headers:
 *   x-device-key: string
 *
 * Request body:
 *   { status?: string, current_version?: number }
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

        // Find player
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id')
            .eq('device_key', deviceKey)
            .single();

        if (playerError || !player) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Device key inválido' },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const { status, current_version } = body as {
            status?: string;
            current_version?: number;
        };

        // Update player heartbeat
        const { error: updateError } = await supabase
            .from('players')
            .update({
                status: 'online',
                last_heartbeat: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', player.id);

        if (updateError) throw updateError;

        // Log heartbeat event
        await supabase
            .from('player_logs')
            .insert({
                player_id: player.id,
                event: 'heartbeat',
                details: {
                    status: status || 'online',
                    current_version: current_version || null,
                    timestamp: new Date().toISOString(),
                },
            });

        // Fetch pending commands
        const { data: pendingCommands } = await supabase
            .from('player_commands')
            .select('id, command, payload')
            .eq('player_id', player.id)
            .eq('status', 'pending');

        // Mark them as sent
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
