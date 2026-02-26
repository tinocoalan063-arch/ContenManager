import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });

        const { data: groups, error } = await supabase
            .from('player_groups')
            .select('*, players(id, name, status)')
            .eq('company_id', userData.company_id)
            .order('name');

        if (error) throw error;

        return NextResponse.json({ success: true, data: groups });
    } catch (error) {
        console.error('Error fetching groups:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });

        const body = await request.json();
        const { name, description } = body;

        const { data: group, error } = await supabase
            .from('player_groups')
            .insert({
                company_id: userData.company_id,
                name: name.trim(),
                description: description?.trim() || null,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data: group }, { status: 201 });
    } catch (error) {
        console.error('Error creating group:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });

        const { error } = await supabase.from('player_groups').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Grupo eliminado' });
    } catch (error) {
        console.error('Error deleting group:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
