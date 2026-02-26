import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ApiResponse, Media } from '@/lib/types/database';

// GET /api/v1/admin/media — List media
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

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        let query = supabase
            .from('media')
            .select('*')
            .eq('company_id', userData.company_id)
            .order('created_at', { ascending: false });

        if (type && ['image', 'video', 'url'].includes(type)) {
            query = query.eq('type', type);
        }

        const { data: media, error } = await query;

        if (error) throw error;

        return NextResponse.json<ApiResponse<Media[]>>({
            success: true,
            data: media,
        });
    } catch (error) {
        console.error('Error fetching media:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST /api/v1/admin/media — Upload media metadata
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
        const { name, type, file_path, url, duration_seconds, size_bytes, mime_type } = body;

        if (!name || !type) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Nombre y tipo requeridos' },
                { status: 400 }
            );
        }

        if (!['image', 'video', 'url'].includes(type)) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Tipo inválido. Usar: image, video, url' },
                { status: 400 }
            );
        }

        const { data: media, error } = await supabase
            .from('media')
            .insert({
                company_id: userData.company_id,
                name: name.trim(),
                type,
                file_path: file_path || null,
                url: url || null,
                duration_seconds: duration_seconds || 10,
                size_bytes: size_bytes || 0,
                mime_type: mime_type || null,
                uploaded_by: user.id,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json<ApiResponse<Media>>({
            success: true,
            data: media,
            message: 'Media registrado exitosamente',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating media:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE /api/v1/admin/media — Delete media
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

        // Get media to check if it has a file to remove from storage
        const { data: media } = await supabase
            .from('media')
            .select('file_path')
            .eq('id', id)
            .single();

        // Delete from storage if file exists
        if (media?.file_path) {
            await supabase.storage.from('media').remove([media.file_path]);
        }

        const { error } = await supabase
            .from('media')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Media eliminado',
        });
    } catch (error) {
        console.error('Error deleting media:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
