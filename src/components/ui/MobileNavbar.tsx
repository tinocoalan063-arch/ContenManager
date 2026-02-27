'use client';

import { Menu, Zap } from 'lucide-react';
import styles from './MobileNavbar.module.css';
import { useSidebar } from './SidebarContext';

interface Branding {
    theme?: 'dark' | 'light';
    accentColor?: string;
    appName?: string;
    logoBase64?: string;
}

export default function MobileNavbar({ branding }: { branding?: Branding }) {
    const { toggle } = useSidebar();

    return (
        <header className={styles.mobileNavbar}>
            <div className={styles.left}>
                <button className={styles.menuBtn} onClick={toggle}>
                    <Menu size={24} />
                </button>
                <div className={styles.branding}>
                    {branding?.logoBase64 ? (
                        <img
                            src={branding.logoBase64}
                            alt="Logo"
                            style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }}
                        />
                    ) : (
                        <div className={styles.logoIcon}>
                            <Zap size={16} fill="currentColor" />
                        </div>
                    )}
                    <div className={styles.appName}>
                        {branding?.appName || 'SmartSignage'}
                    </div>
                </div>
            </div>

            <div className={styles.right}>
                <div className={styles.avatar}>AT</div>
            </div>
        </header>
    );
}
