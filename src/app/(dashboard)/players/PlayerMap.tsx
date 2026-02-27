'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface PlayerMapProps {
    players: any[];
    onMarkerClick?: (player: any) => void;
}

// Dynamic import of the actual map implementation to avoid SSR issues with Leaflet
const PlayerMapImplementation = dynamic<PlayerMapProps>(
    () => import('./PlayerMapImplementation'),
    {
        ssr: false,
        loading: () => (
            <div className="glass-card" style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px' }}>
                <Loader2 size={30} className="loading-spinner" style={{ color: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Cargando mapa...</p>
            </div>
        )
    }
);

export default function PlayerMap({ players, onMarkerClick }: PlayerMapProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return <PlayerMapImplementation players={players} onMarkerClick={onMarkerClick} />;
}
