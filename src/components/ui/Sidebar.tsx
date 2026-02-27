'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Monitor,
    Image,
    ListVideo,
    Users,
    Settings,
    LogOut,
    Zap,
    ChevronRight,
    Activity,
    Layers,
    BarChart3,
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { useSidebar } from './SidebarContext';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/players', label: 'Players', icon: Monitor },
    { href: '/media', label: 'Media', icon: Image },
    { href: '/playlists', label: 'Playlists', icon: ListVideo },
    { href: '/groups', label: 'Grupos', icon: Layers },
    { href: '/analytics', label: 'Estadísticas', icon: BarChart3 },
    { href: '/users', label: 'Usuarios', icon: Users },
    { href: '/logs', label: 'Eventos', icon: Activity },
];

interface Branding {
    theme?: 'dark' | 'light';
    accentColor?: string;
    appName?: string;
    logoBase64?: string;
}

export default function Sidebar({ branding }: { branding?: Branding }) {
    const pathname = usePathname();
    const { isOpen, setIsOpen } = useSidebar();

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarMobileOpen : styles.sidebarMobileClosed}`}>
            {/* Logo */}
            <div className={styles.logo}>
                {branding?.logoBase64 ? (
                    <img src={branding.logoBase64} alt="App Logo" className={styles.customLogoIcon} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                ) : (
                    <div className={styles.logoIcon}>
                        <Zap size={20} />
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center' }}>
                    <span className={styles.logoText} style={{ lineHeight: 1 }}>
                        {branding?.appName || 'SmartSignage'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>by JPAT Digital</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                <div className={styles.navSection}>
                    <span className={styles.navLabel}>Principal</span>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                onClick={() => setIsOpen(false)}
                            >
                                <item.icon size={18} />
                                <span>{item.label}</span>
                                {isActive && <ChevronRight size={14} className={styles.navArrow} />}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Footer */}
            <div className={styles.footer}>
                <Link href="/settings" className={styles.navItem} onClick={() => setIsOpen(false)}>
                    <Settings size={18} />
                    <span>Configuración</span>
                </Link>
                <button className={styles.logoutBtn}>
                    <LogOut size={18} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
