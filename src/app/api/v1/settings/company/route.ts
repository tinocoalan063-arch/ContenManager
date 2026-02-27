import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const { data: userData } = await supabase
            .from('users')
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!userData || userData.role === 'editor') {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Sin permisos' }, { status: 403 });
        }

        const { data: companyData, error } = await supabase
            .from('companies')
            .select('name, max_storage_mb, storage_limit_mb, settings')
            .eq('id', userData.company_id)
            .single();

        if (error) throw error;

        // Fetch total media usage for calculating percentage
        const { data: mediaFiles } = await supabase
            .from('media')
            .select('size_bytes')
            .eq('company_id', userData.company_id);

        const totalUsedBytes = (mediaFiles || []).reduce((acc, m) => acc + (m.size_bytes || 0), 0);

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                ...companyData,
                total_used_bytes: totalUsedBytes
            }
        });
    } catch (error) {
        console.error('Error fetching company settings:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const { data: userData } = await supabase
            .from('users')
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!userData || userData.role === 'editor') {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Solo administradores pueden cambiar los ajustes de la empresa' }, { status: 403 });
        }

        const body = await request.json();
        const { name, settings } = body;

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name) updates.name = name.trim();
        if (settings) updates.settings = settings;

        const serviceClient = await createServiceClient();
        const { data: updatedCompany, error } = await serviceClient
            .from('companies')
            .update(updates)
            .eq('id', userData.company_id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json<ApiResponse>({
            success: true,
            data: updatedCompany,
            message: 'Configuración de empresa actualizada'
        });
    } catch (error) {
        console.error('Error updating company settings:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
