import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/lib/types/database';

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { full_name, email, password } = body;

        // 1. Update general Public Profile (Name)
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (full_name) updates.full_name = full_name.trim();
        if (email) updates.email = email.trim(); // sync email

        if (Object.keys(updates).length > 1) { // more than just updated_at
            const { error: profileError } = await supabase
                .from('users')
                .update(updates)
                .eq('id', user.id);

            if (profileError) throw profileError;
        }

        // 2. Update Auth (Email/Password) via Supabase Auth standard method
        const authUpdates: any = {};
        if (email && user.email !== email.trim()) authUpdates.email = email.trim();
        if (password) authUpdates.password = password;

        if (Object.keys(authUpdates).length > 0) {

            // This requires the user to input their CURRENT session token, which is handled implicitly by Next.js passing cookies
            // However, Supabase often requires the `service_role` to bypass security emails instantly in a SaaS for quick updates.
            // But since this is the logged-in user editing THEMSELVES, `supabase.auth.updateUser()` usually suffices 
            // and provides proper security defaults. If it forces confirmation, the user will get an email.

            // To ensure aggressive bypass and immediate effect as requested in earlier flows:
            const serviceClient = await createServiceClient();
            const { error: authError } = await serviceClient.auth.admin.updateUserById(user.id, {
                ...authUpdates,
                email_confirm: true // Force confirm
            });

            if (authError) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: authError.message },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Perfil actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error updating personal profile:', error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
