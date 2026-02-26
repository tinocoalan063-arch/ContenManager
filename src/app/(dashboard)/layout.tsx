import Sidebar from '@/components/ui/Sidebar';
import styles from './layout.module.css';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={styles.dashboardLayout}>
            <Sidebar />
            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    );
}
