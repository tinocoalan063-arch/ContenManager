import { createClient } from '@/lib/supabase/server';
import Topbar from '@/components/ui/Topbar';
import { Settings, User, Building, HardDrive, Shield } from 'lucide-react';
import styles from './settings.module.css';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return <div>No autorizado</div>;
    }

    // Load initial user permissions to pass down
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

    // The rest of the interactive form handling and data fetching
    // will be managed by the SettingsClient component.

    return (
        <>
            <Topbar title="Configuración" subtitle="Preferencias personales y de la empresa" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Ajustes Generales</h1>
                        <p className={styles.headerSubtext}>Administra tu perfil, contraseña y límites de la organización.</p>
                    </div>
                </div>

                <SettingsClient userId={user.id} isAdmin={isAdmin} />

            </div>
        </>
    );
}
