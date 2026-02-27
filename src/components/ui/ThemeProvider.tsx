'use client';

import { useEffect, createContext, useContext } from 'react';

interface Branding {
    theme?: 'dark' | 'light';
    accentColor?: string;
    appName?: string;
    logoBase64?: string;
}

export const BrandingContext = createContext<Branding | undefined>(undefined);
export const useBranding = () => useContext(BrandingContext);

export default function ThemeProvider({
    children,
    branding
}: {
    children: React.ReactNode;
    branding?: Branding;
}) {
    useEffect(() => {
        if (!branding) return;

        const root = document.documentElement;

        // Apply Accent Color
        if (branding.accentColor) {
            root.style.setProperty('--accent', branding.accentColor);
            root.style.setProperty('--accent-hover', adjustColorBrightness(branding.accentColor, -15));
        } else {
            // Revert to defaults if cleared
            root.style.removeProperty('--accent');
            root.style.removeProperty('--accent-hover');
        }

        // Apply Theme (Dark vs Light)
        if (branding.theme === 'light') {
            root.style.setProperty('--bg-primary', '#f8fafc');
            root.style.setProperty('--bg-secondary', '#f1f5f9');
            root.style.setProperty('--bg-tertiary', '#e2e8f0');
            root.style.setProperty('--bg-elevated', '#ffffff');
            root.style.setProperty('--text-primary', '#0f172a');
            root.style.setProperty('--text-secondary', '#334155');
            root.style.setProperty('--text-muted', '#64748b');
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.85)');
            root.style.setProperty('--glass-bg-hover', 'rgba(255, 255, 255, 0.95)');
            root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
            root.style.setProperty('--glass-border-hover', 'rgba(0, 0, 0, 0.2)');
        } else {
            // Revert back to the default dark theme defined in global.css
            root.style.removeProperty('--bg-primary');
            root.style.removeProperty('--bg-secondary');
            root.style.removeProperty('--bg-tertiary');
            root.style.removeProperty('--bg-elevated');
            root.style.removeProperty('--text-primary');
            root.style.removeProperty('--text-secondary');
            root.style.removeProperty('--text-muted');
            root.style.removeProperty('--glass-bg');
            root.style.removeProperty('--glass-bg-hover');
            root.style.removeProperty('--glass-border');
            root.style.removeProperty('--glass-border-hover');
        }

    }, [branding]);

    return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

// Helper function to darken/lighten a hex color for the hover state
function adjustColorBrightness(hex: string, percent: number) {
    // Remove hash
    hex = hex.replace(/^\s*#|\s*$/g, '');

    // Convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
    if (hex.length === 3) {
        hex = hex.replace(/(.)/g, '$1$1');
    }

    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);

    r = Math.max(0, Math.min(255, r + (r * percent / 100)));
    g = Math.max(0, Math.min(255, g + (g * percent / 100)));
    b = Math.max(0, Math.min(255, b + (b * percent / 100)));

    return '#' +
        Math.round(r).toString(16).padStart(2, '0') +
        Math.round(g).toString(16).padStart(2, '0') +
        Math.round(b).toString(16).padStart(2, '0');
}
