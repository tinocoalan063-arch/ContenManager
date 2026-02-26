import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse, User } from '@/lib/types/database';

// GET /api/v1/admin/users — List users
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
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!userData || userData.role === 'editor') {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Sin permisos para ver usuarios' },
                { status: 403 }
            );
        }

        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('company_id', userData.company_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json<ApiResponse<User[]>>({
            success: true,
            data: users,
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST /api/v1/admin/users — Create user (admin only)
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
                { success: false, error: 'Solo administradores pueden crear usuarios' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { full_name, email, password, role } = body;

        if (!full_name || !email || !password) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Nombre, email y contraseña requeridos' },
                { status: 400 }
            );
        }

        if (role && !['admin', 'editor'].includes(role)) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Rol inválido' },
                { status: 400 }
            );
        }

        // Use service role to create auth user
        const serviceClient = await createServiceClient();

        const { data: newAuthUser, error: authError } = await serviceClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: authError.message },
                { status: 400 }
            );
        }

        // Create user profile
        const { data: newUser, error: profileError } = await supabase
            .from('users')
            .insert({
                id: newAuthUser.user.id,
                company_id: userData.company_id,
                full_name: full_name.trim(),
                email,
                role: role || 'editor',
            })
            .select()
            .single();

        if (profileError) throw profileError;

        return NextResponse.json<ApiResponse<User>>({
            success: true,
            data: newUser,
            message: 'Usuario creado exitosamente',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PUT /api/v1/admin/users — Update user role
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
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!userData || userData.role === 'editor') {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Sin permisos' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { id, full_name, role } = body;

        if (!id) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'ID requerido' },
                { status: 400 }
            );
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (full_name) updates.full_name = full_name.trim();
        if (role && ['admin', 'editor'].includes(role)) updates.role = role;

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json<ApiResponse>({
            success: true,
            data: updatedUser,
            message: 'Usuario actualizado',
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE /api/v1/admin/users — Delete user
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

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!userData || userData.role === 'editor') {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'Sin permisos' },
                { status: 403 }
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

        // Prevent self-deletion
        if (id === user.id) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: 'No puedes eliminar tu propio usuario' },
                { status: 400 }
            );
        }

        // Delete from users table (cascade will handle auth)
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Usuario eliminado',
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
