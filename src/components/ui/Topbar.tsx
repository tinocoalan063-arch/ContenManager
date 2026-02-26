'use client';

import { Bell, Search, Menu } from 'lucide-react';
import styles from './Topbar.module.css';

interface TopbarProps {
    title: string;
    subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
    return (
        <header className={styles.topbar}>
            <div className={styles.left}>
                <button className={styles.menuBtn}>
                    <Menu size={20} />
                </button>
                <div>
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
