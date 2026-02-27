import Sidebar from '@/components/ui/Sidebar';
import styles from './layout.module.css';
import { createClient } from '@/lib/supabase/server';
import ThemeProvider from '@/components/ui/ThemeProvider';
import { SidebarProvider } from '@/components/ui/SidebarContext';
import MobileOverlay from '@/components/ui/MobileOverlay';
import MobileNavbar from '@/components/ui/MobileNavbar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let branding = undefined;

    if (user) {
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (userData) {
            const { data: companyData } = await supabase.from('companies').select('settings').eq('id', userData.company_id).single();
            if (companyData?.settings?.branding) {
                branding = companyData.settings.branding;
            }
        }
    }

    return (
        <ThemeProvider branding={branding}>
            <SidebarProvider>
                <div className={styles.dashboardLayout}>
                    <Sidebar branding={branding} />
                    <MobileOverlay />
                    <main className={styles.mainContent}>
                        <MobileNavbar branding={branding} />
                        {children}
                    </main>
                </div>
            </SidebarProvider>
        </ThemeProvider>
    );
}
