'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Monitor, WifiOff } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// CSS Overrides internally
const mapStyle = {
    height: '600px',
    width: '100%',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--glass-border)',
    zIndex: 1
};

// Fix Leaflet blank map issue
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

function CustomMarkerIcon(color: string, iconType: 'online' | 'offline') {
    const iconHtml = renderToStaticMarkup(
        <div style={{
            background: color,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            color: 'white'
        }}>
            {iconType === 'online' ? <Monitor size={16} /> : <WifiOff size={16} />}
        </div>
    );

    return L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

// Map Updater Component to adjust bounds when players change
function MapBoundsUpdater({ players }: { players: any[] }) {
    const map = useMap();

    useEffect(() => {
        const withCoords = players.filter(p => p.latitude && p.longitude);
        if (withCoords.length > 0) {
            const bounds = L.latLngBounds(withCoords.map(p => [p.latitude, p.longitude]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        }
    }, [players, map]);

    return null;
}

export default function PlayerMapImplementation({ players, onMarkerClick }: { players: any[], onMarkerClick?: (p: any) => void }) {

    const playersWithCoords = players.filter(p => p.latitude && p.longitude);

    // Calculate center based on players
    let center: [number, number] = [19.4326, -99.1332]; // Default CDMX
    if (playersWithCoords.length > 0) {
        center = [playersWithCoords[0].latitude, playersWithCoords[0].longitude];
    }

    return (
        <MapContainer center={center} zoom={4} style={mapStyle} scrollWheelZoom={true}>
            {/* Dark map theme via CartoDB */}
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            <MapBoundsUpdater players={playersWithCoords} />

            {playersWithCoords.map((player) => {
                const now = new Date();
                const lastSeen = player.last_seen ? new Date(player.last_seen) : null;
                const isOnline = lastSeen && (now.getTime() - lastSeen.getTime() < 5 * 60 * 1000);

                const iconColor = isOnline ? '#10b981' : '#ef4444'; // Green or Red
                const iconType = isOnline ? 'online' : 'offline';

                return (
                    <Marker
                        key={player.id}
                        position={[player.latitude, player.longitude]}
                        icon={CustomMarkerIcon(iconColor, iconType)}
                        eventHandlers={{
                            click: () => {
                                if (onMarkerClick) onMarkerClick(player);
                            }
                        }}
                    >
                        <Popup>
                            <div style={{ padding: '0px', textAlign: 'center', minWidth: '150px' }}>
                                <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: '#111' }}>{player.name}</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: isOnline ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                    {isOnline ? 'En línea' : 'Desconectado'}
                                </p>
                                <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                                    {player.playlists?.name || 'Sin asignación'}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </MapContainer>
    );
}
