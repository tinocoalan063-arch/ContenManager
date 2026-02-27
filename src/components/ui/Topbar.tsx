'use client';

import { Bell, Search, Menu } from 'lucide-react';
import styles from './Topbar.module.css';
import { useSidebar } from './SidebarContext';

interface TopbarProps {
    title: string;
    subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
    const { toggle } = useSidebar();

    return (
        <header className={styles.topbar}>
            <div className={styles.left}>
                <button className={styles.menuBtn} onClick={toggle}>
                    <Menu size={20} />
                </button>

                <div className={styles.titleContainer}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
            </div>

            <div className={styles.right}>
                <div className={styles.searchBox}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className={styles.searchInput}
                    />
                </div>

                <button className={styles.iconBtn}>
                    <Bell size={18} />
                    <span className={styles.notifDot}></span>
                </button>

                <div className={styles.avatar}>
                    <span>AT</span>
                </div>
            </div>
        </header>
    );
}
