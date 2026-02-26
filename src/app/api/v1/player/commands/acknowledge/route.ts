import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

/**
 * POST /api/v1/player/commands/acknowledge
 * 
 * Player reports the result of a command execution.
 */
export async function POST(request: NextRequest) {
    try {
        const deviceKey = request.headers.get('x-device-key');
        if (!deviceKey) return NextResponse.json({ success: false, error: 'Device key requerido' }, { status: 401 });

        const supabase = await createServiceClient();

        // Identify player
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id')
            .eq('device_key', deviceKey)
            .single();

        if (playerError || !player) {
            return NextResponse.json({ success: false, error: 'Device key inválido' }, { status: 401 });
        }

        const body = await request.json();
        const { command_id, status, result_payload } = body;

        if (!command_id || !status) {
            return NextResponse.json({ success: false, error: 'Campos requeridos faltantes' }, { status: 400 });
        }

        // Verify command belongs to player
        const { data: command } = await supabase
            .from('player_commands')
            .select('id, command')
            .eq('id', command_id)
            .eq('player_id', player.id)
            .single();

        if (!command) {
            return NextResponse.json({ success: false, error: 'Comando no encontrado o no pertenece al player' }, { status: 404 });
        }

        // Update command status
        const { error: updateError } = await supabase
            .from('player_commands')
            .update({
                status: status === 'success' ? 'executed' : 'failed',
                payload: result_payload ? { ...result_payload } : {},
                executed_at: new Date().toISOString()
            })
            .eq('id', command_id);

        if (updateError) throw updateError;

        // Special handling for screenshots
        if (command.command === 'SCREENSHOT' && status === 'success' && result_payload?.screenshot_url) {
            await supabase
                .from('players')
                .update({ last_screenshot_url: result_payload.screenshot_url })
                .eq('id', player.id);
        }

        // Log the event
        await supabase.from('player_logs').insert({
            player_id: player.id,
            event: `command_${command.command.toLowerCase()}_${status}`,
            details: result_payload || {}
        });

        return NextResponse.json({ success: true, message: 'Resultado registrado' });
    } catch (error) {
        console.error('Error in command acknowledge:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
