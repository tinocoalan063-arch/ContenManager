'use client';

import { useSidebar } from './SidebarContext';
import styles from './MobileOverlay.module.css';

export default function MobileOverlay() {
    const { isOpen, setIsOpen } = useSidebar();

    if (!isOpen) return null;

    return (
        <div
            className={styles.overlay}
            onClick={() => setIsOpen(false)}
        />
    );
}
