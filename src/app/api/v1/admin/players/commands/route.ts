import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const body = await request.json();
        const { player_id, command, payload } = body;

        if (!player_id || !command) {
            return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
        }

        // Verify player belongs to company
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('id', player_id)
            .eq('company_id', userData?.company_id)
            .single();

        if (!player) {
            return NextResponse.json({ success: false, error: 'Player no encontrado' }, { status: 404 });
        }

        const { data: cmd, error } = await supabase
            .from('player_commands')
            .insert({
                player_id,
                command,
                payload: payload || {},
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data: cmd });
    } catch (error) {
        console.error('Error sending command:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
