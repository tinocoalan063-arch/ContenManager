import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Digital Signage Player',
    description: 'Reproductor de contenido digital',
};

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <style>{`
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #000 !important;
                    overflow: hidden !important;
                    cursor: none !important;
                }
                * { box-sizing: border-box; }
            `}</style>
            <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
                {children}
            </div>
        </>
    );
}

