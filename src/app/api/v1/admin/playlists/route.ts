import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ApiResponse, Playlist } from '@/lib/types/database';

// GET /api/v1/admin/playlists — List playlists
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

        const { data: playlists, error } = await supabase
            .from('playlists')
            .select('*, playlist_items(*, media:media(*))')
            .eq('company_id', userData.company_id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json<ApiResponse<Playlist[]>>({
            success: true,
            data: playlists,
        });
    } catch (error) {
        console.error('Error fetching playlists:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST /api/v1/admin/playlists — Create playlist
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
        const { name, description } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Nombre requerido' },
                { status: 400 }
            );
        }

        const { data: playlist, error } = await supabase
            .from('playlists')
            .insert({
                company_id: userData.company_id,
                name: name.trim(),
                description: description?.trim() || null,
                version: 1,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json<ApiResponse<Playlist>>({
            success: true,
            data: playlist,
            message: 'Playlist creada exitosamente',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating playlist:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PUT /api/v1/admin/playlists — Update playlist (with version increment)
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

        const body = await request.json();
        const { id, name, description, items } = body;

        if (!id) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'ID de playlist requerido' },
                { status: 400 }
            );
        }

        // Get current version
        const { data: currentPlaylist } = await supabase
            .from('playlists')
            .select('version')
            .eq('id', id)
            .single();

        const newVersion = (currentPlaylist?.version || 0) + 1;

        // Update playlist metadata
        const updates: Record<string, unknown> = {
            version: newVersion,
            updated_at: new Date().toISOString(),
        };
        if (name) updates.name = name.trim();
        if (description !== undefined) updates.description = description?.trim() || null;

        const { data: playlist, error } = await supabase
            .from('playlists')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Update items if provided
        if (items && Array.isArray(items)) {
            // Delete existing items
            await supabase
                .from('playlist_items')
                .delete()
                .eq('playlist_id', id);

            // Insert new items
            if (items.length > 0) {
                const itemsToInsert = items.map((item: { media_id: string; position: number; duration_seconds: number }, index: number) => ({
                    playlist_id: id,
                    media_id: item.media_id,
                    position: item.position ?? index,
                    duration_seconds: item.duration_seconds ?? 10,
                }));

                await supabase
                    .from('playlist_items')
                    .insert(itemsToInsert);
            }
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: playlist,
            message: `Playlist actualizada a versión ${newVersion}`,
        });
    } catch (error) {
        console.error('Error updating playlist:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE /api/v1/admin/playlists — Delete playlist
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
            .from('playlists')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Playlist eliminada',
        });
    } catch (error) {
        console.error('Error deleting playlist:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
