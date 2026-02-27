import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDeviceKey } from '@/lib/utils';
import type { ApiResponse, Player } from '@/lib/types/database';

// GET /api/v1/admin/players — List players
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Get user's company_id
        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        const { data: players, error } = await supabase
            .from('players')
            .select('*, schedules(*, playlist:playlists(*))')
            .eq('company_id', userData.company_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json<ApiResponse<Player[]>>({
            success: true,
            data: players,
        });
    } catch (error) {
        console.error('Error fetching players:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST /api/v1/admin/players — Register a new player
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { data: userData } = await supabase
            .from('users')
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!userData || userData.role === 'editor') {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Sin permisos suficientes' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, group_name } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Nombre requerido' },
                { status: 400 }
            );
        }

        const device_key = generateDeviceKey();

        const { data: player, error } = await supabase
            .from('players')
            .insert({
                company_id: userData.company_id,
                name: name.trim(),
                device_key,
                group_name: group_name?.trim() || null,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json<ApiResponse<Player>>({
            success: true,
            data: player,
            message: 'Player registrado exitosamente',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating player:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PUT /api/v1/admin/players — Update player
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { id, name, group_name, playlist_id } = body;

        if (!id) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'ID de player requerido' },
                { status: 400 }
            );
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name) updates.name = name.trim();
        if (group_name !== undefined) updates.group_name = group_name?.trim() || null;

        const { data: player, error } = await supabase
            .from('players')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Handle playlist assignment via new schedules table
        if (playlist_id !== undefined) {
            const { schedule } = body;

            // Remove previous active scheduling for this player (simplification for MVP Dayparting)
            await supabase
                .from('schedules')
                .delete()
                .eq('player_id', id);

            if (playlist_id) {
                const scheduleData = schedule || {};
                await supabase
                    .from('schedules')
                    .insert({
                        company_id: userData.company_id,
                        player_id: id,
                        playlist_id,
                        start_time: scheduleData.start_time || '00:00:00',
                        end_time: scheduleData.end_time || '23:59:59',
                        days_of_week: scheduleData.days_of_week || [0, 1, 2, 3, 4, 5, 6],
                        is_fallback: true // For now, the main assigned playlist acts as fallback/default
                    });
            }
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: player,
            message: 'Player actualizado',
        });
    } catch (error) {
        console.error('Error updating player:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE /api/v1/admin/players — Delete player
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'ID requerido' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('players')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Player eliminado',
        });
    } catch (error) {
        console.error('Error deleting player:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
