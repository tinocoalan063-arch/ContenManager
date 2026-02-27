'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SceneLayer {
    id: string;
    type: string;
    name: string;
    url?: string;
    html?: string;
    rssUrl?: string;
    qrData?: string;
    x: number;
    y: number;
    scale: number;
    active: boolean;
}

interface MediaItem {
    id: string;
    name: string;
    type: 'image' | 'video' | 'url' | 'widget';
    url: string | null;
    duration_seconds: number;
    config?: {
        backgrounds?: { id: string; preview_url: string; duration: number }[];
        layers?: SceneLayer[];
        slideBgMode?: 'cover' | 'contain';
    } | null;
}

interface PlaylistItem {
    id: string;
    position: number;
    duration_seconds: number;
    transition_type: 'none' | 'fade' | 'slide';
    media: MediaItem;
}

interface PlayerState {
    deviceKey: string;
    playlistName: string;
    playlistVersion: number;
    items: PlaylistItem[];
    cachedAt: number;
}

// ─── HTML Generator (mirrors CMS logic) ──────────────────────────────────────

function generateSlideHtml(backgrounds: any[], layers: any[], bgMode = 'cover'): string {
    return `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #000; overflow: hidden; font-family: sans-serif; }
        </style>
        <div id="slide" style="position:relative; width:100vw; height:100vh; overflow:hidden; background:#000;">
            <div id="bg-slideshow" style="width:100%; height:100%; position:absolute; top:0; left:0;">
                ${backgrounds.map((bg, idx) => `
                    <img src="${bg.preview_url}" id="bg-${idx}"
                        style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:${bgMode}; opacity:${idx === 0 ? 1 : 0}; transition:opacity 0.8s ease-in-out;" />
                `).join('')}
            </div>

            ${layers.filter(l => l.active).map(layer => {
        let content = '';
        if (layer.type === 'clock') {
            content = `<div id="clock-${layer.id}" style="color:#fff; text-align:right; text-shadow:0 4px 15px rgba(0,0,0,0.8); white-space:nowrap;">
                        <div class="time" style="font-size:8vw; font-weight:bold; line-height:1;">00:00</div>
                        <div class="date" style="font-size:3vw; opacity:0.9; margin-top:10px;">Cargando...</div>
                    </div>`;
        } else if (layer.type === 'weather') {
            content = `<div style="color:#fff; display:flex; align-items:center; gap:20px; text-shadow:0 4px 15px rgba(0,0,0,0.8); white-space:nowrap;">
                        <div style="font-size:6vw;">☀️</div>
                        <div><div style="font-size:5vw; font-weight:bold; line-height:1;">24°C</div><div style="font-size:2vw; opacity:0.9;">Localidad</div></div>
                    </div>`;
        } else if (layer.type === 'rss') {
            const text = layer.rssUrl || 'Última hora: informacion en tiempo real...';
            content = `<div style="width:100vw; background:rgba(0,0,0,0.85); color:#fff; padding:14px 0; border-top:3px solid #a78bfa; display:flex; align-items:center;">
                        <div style="background:#a78bfa; padding:5px 20px; font-weight:bold; font-size:3vw; margin-right:20px; border-radius:0 8px 8px 0; white-space:nowrap;">ÚLTIMA HORA</div>
                        <marquee style="font-size:2.5vw; flex:1;" scrollamount="6" truespeed>${text}</marquee>
                    </div>`;
        } else if (layer.type === 'qr') {
            const data = encodeURIComponent(layer.qrData || 'https://example.com');
            content = `<div style="background:#fff; padding:10px; border-radius:8px; display:inline-block;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=000000&bgcolor=ffffff&data=${data}" style="width:100%; height:100%; object-fit:contain; display:block;" />
                    </div>`;
        } else if (layer.type === 'image') {
            content = `<img src="${layer.url}" style="width:100%; height:100%; object-fit:contain;" />`;
        } else if (layer.type === 'video') {
            content = `<video src="${layer.url}" autoplay loop muted style="width:100%; height:100%; object-fit:contain;"></video>`;
        }
        return `<div style="position:absolute; left:${layer.x}%; top:${layer.y}%; transform:translate(-50%,-50%) scale(${layer.scale}); z-index:10; pointer-events:none;">
                    ${content}
                </div>`;
    }).join('')}

            <script>
                const bgs = ${JSON.stringify(backgrounds.map(bg => bg.duration))};
                let current = 0;
                function nextBg() {
                    const ce = document.getElementById('bg-' + current);
                    if(ce) ce.style.opacity = 0;
                    current = (current + 1) % (bgs.length || 1);
                    const ne = document.getElementById('bg-' + current);
                    if(ne) ne.style.opacity = 1;
                    if(bgs.length > 1) setTimeout(nextBg, (bgs[current] || 5) * 1000);
                }
                if (bgs.length > 1) setTimeout(nextBg, (bgs[0] || 5) * 1000);

                function updateClocks() {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                    document.querySelectorAll('[id^="clock-"]').forEach(el => {
                        const t = el.querySelector('.time'); const d = el.querySelector('.date');
                        if(t) t.innerText = timeStr; if(d) d.innerText = dateStr;
                    });
                }
                setInterval(updateClocks, 1000); updateClocks();
            </script>
        </div>
    `;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ds_player_state';
const DEVICE_KEY_STORAGE = 'ds_player_device_key';
const SESSION_ID_STORAGE = 'ds_player_session_id';
const SYNC_INTERVAL = 30_000; // 30 seconds
const HEARTBEAT_INTERVAL = 60_000; // 60 seconds
const TRANSITION_DURATION = 800; // ms

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onSave }: { onSave: (key: string) => void }) {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [testing, setTesting] = useState(false);

    const handleSubmit = async () => {
        if (!input.trim()) { setError('Introduce un device key válido'); return; }
        setTesting(true); setError('');
        try {
            const res = await fetch('/api/v1/player/sync', {
                method: 'POST',
                headers: { 'x-device-key': input.trim(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_version: -1 }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setError('Device key inválido. Verifica en el CMS.');
            } else {
                onSave(input.trim());
            }
        } catch {
            setError('No se pudo conectar al servidor. Verifica tu red.');
        } finally {
            setTesting(false);
        }
    };

    return (
        <div style={{
            width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #0f0f1a, #1a0a2e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            gap: '32px', fontFamily: "'Inter', sans-serif", color: '#fff', cursor: 'default',
        }}>
            {/* Logo */}
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 16px',
                    background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '32px', boxShadow: '0 0 40px rgba(167,139,250,0.4)',
                }}>📺</div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Digital Signage</h1>
                <p style={{ color: '#a78bfa', fontWeight: 600, marginTop: '4px', fontSize: '0.95rem' }}>Player App v1.0</p>
            </div>

            {/* Card */}
            <div style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px', padding: '36px', width: '420px', maxWidth: '90vw',
                backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>Emparejar Dispositivo</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '24px', margin: '0 0 24px' }}>
                    Introduce el <strong style={{ color: '#a78bfa' }}>device_key</strong> del Player creado en el CMS.
                </p>

                <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Device Key
                </label>
                <input
                    type="text"
                    value={input}
                    onChange={e => { setInput(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={{
                        width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.07)',
                        border: `1px solid ${error ? '#f43f5e' : 'rgba(255,255,255,0.12)'}`,
                        borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none',
                        boxSizing: 'border-box', transition: 'all 0.2s ease', cursor: 'text',
                        fontFamily: 'monospace',
                    }}
                    autoFocus
                />

                {error && (
                    <p style={{ color: '#f43f5e', fontSize: '0.8rem', marginTop: '8px' }}>⚠ {error}</p>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={testing}
                    style={{
                        marginTop: '20px', width: '100%', padding: '14px',
                        background: testing ? 'rgba(167,139,250,0.4)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                        border: 'none', borderRadius: '10px', color: '#fff', fontSize: '1rem',
                        fontWeight: 700, cursor: testing ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease', boxShadow: testing ? 'none' : '0 4px 20px rgba(167,139,250,0.4)',
                    }}
                >
                    {testing ? 'Verificando...' : 'Conectar Dispositivo ▶'}
                </button>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>
                El Device Key se encuentra en el panel de Players del CMS.
            </p>
        </div>
    );
}

// ─── Main Player Component ────────────────────────────────────────────────────

export default function PlayerPage() {
    const [deviceKey, setDeviceKey] = useState<string | null>(null);
    const [items, setItems] = useState<PlaylistItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [version, setVersion] = useState(0);
    const [transitionClass, setTransitionClass] = useState('');
    const [status, setStatus] = useState<'loading' | 'syncing' | 'playing' | 'offline' | 'no-content' | 'duplicate'>('loading');
    const [playlistName, setPlaylistName] = useState('');

    const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const itemTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Init: read device key from localStorage ──────────────────────────────
    useEffect(() => {
        const storedKey = localStorage.getItem(DEVICE_KEY_STORAGE);
        if (storedKey) {
            setDeviceKey(storedKey);
        } else {
            setStatus('loading'); // will render setup screen
        }
    }, []);

    // ── Load cached playlist ─────────────────────────────────────────────────
    useEffect(() => {
        if (!deviceKey) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const cached: PlayerState = JSON.parse(raw);
                if (cached.items && cached.items.length > 0) {
                    setItems(cached.items);
                    setVersion(cached.playlistVersion || 0);
                    setPlaylistName(cached.playlistName || '');
                    setStatus('playing');
                }
            }
        } catch { /* ignore */ }
    }, [deviceKey]);

    // ── Sync ─────────────────────────────────────────────────────────────────
    const sync = useCallback(async () => {
        if (!deviceKey) return;
        setStatus(prev => prev === 'playing' ? 'playing' : 'syncing');

        try {
            const sessionId = localStorage.getItem(SESSION_ID_STORAGE);
            const headers: Record<string, string> = {
                'x-device-key': deviceKey,
                'Content-Type': 'application/json',
            };
            if (sessionId) headers['x-session-id'] = sessionId;

            const res = await fetch('/api/v1/player/sync', {
                method: 'POST',
                headers,
                body: JSON.stringify({ current_version: version }),
            });

            if (!res.ok) {
                setStatus(items.length > 0 ? 'playing' : 'offline');
                return;
            }

            const json = await res.json();
            if (!json.success) {
                setStatus(items.length > 0 ? 'playing' : 'offline');
                return;
            }

            const d = json.data;

            // Save session_id returned by server
            if (d.session_id) {
                localStorage.setItem(SESSION_ID_STORAGE, d.session_id);
            }

            if (d.up_to_date) {
                setStatus(items.length > 0 ? 'playing' : 'no-content');
                return;
            }

            if (d.items && d.items.length > 0) {
                const newItems: PlaylistItem[] = d.items;
                setItems(newItems);
                setVersion(d.version);
                setCurrentIndex(0);
                setPlaylistName(d.playlist?.name || '');
                setStatus('playing');

                const newState: PlayerState = {
                    deviceKey,
                    playlistName: d.playlist?.name || '',
                    playlistVersion: d.version,
                    items: newItems,
                    cachedAt: Date.now(),
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            } else {
                setStatus(items.length > 0 ? 'playing' : 'no-content');
            }
        } catch {
            setStatus(items.length > 0 ? 'playing' : 'offline');
        }
    }, [deviceKey, version, items.length]);

    // ── Heartbeat ────────────────────────────────────────────────────────────
    const heartbeat = useCallback(async () => {
        if (!deviceKey) return;
        try {
            const sessionId = localStorage.getItem(SESSION_ID_STORAGE);
            const headers: Record<string, string> = {
                'x-device-key': deviceKey,
                'Content-Type': 'application/json',
            };
            if (sessionId) headers['x-session-id'] = sessionId;

            const res = await fetch('/api/v1/player/heartbeat', {
                method: 'POST',
                headers,
                body: JSON.stringify({ status: 'online', current_version: version }),
            });
            const json = await res.json();
            if (json.success && json.data?.duplicate) {
                setStatus('duplicate');
            }
        } catch { /* ignore */ }
    }, [deviceKey, version]);

    // ── Start timers after deviceKey is set ──────────────────────────────────
    useEffect(() => {
        if (!deviceKey) return;

        sync(); // initial sync

        syncTimerRef.current = setInterval(sync, SYNC_INTERVAL);
        heartbeatTimerRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);
        heartbeat(); // initial heartbeat

        return () => {
            if (syncTimerRef.current) clearInterval(syncTimerRef.current);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        };
    }, [deviceKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Item advance timer ───────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || items.length === 0) return;

        const currentItem = items[currentIndex];
        const durationMs = (currentItem?.duration_seconds || 10) * 1000;

        if (itemTimerRef.current) clearTimeout(itemTimerRef.current);

        itemTimerRef.current = setTimeout(() => {
            const nextIdx = (currentIndex + 1) % items.length;
            const nextItem = items[nextIdx];
            const transition = nextItem?.transition_type || 'none';

            if (transition === 'fade') setTransitionClass('player-fade-enter');
            else if (transition === 'slide') setTransitionClass('player-slide-enter');
            else setTransitionClass('');

            setTimeout(() => {
                setCurrentIndex(nextIdx);
                setTimeout(() => setTransitionClass(''), TRANSITION_DURATION);
            }, 50);
        }, durationMs);

        return () => { if (itemTimerRef.current) clearTimeout(itemTimerRef.current); };
    }, [currentIndex, items, status]);

    // ── Handle device key save from setup ───────────────────────────────────
    const handleSaveDeviceKey = (key: string) => {
        localStorage.setItem(DEVICE_KEY_STORAGE, key);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SESSION_ID_STORAGE); // Force new session
        setDeviceKey(key);
        setItems([]);
        setVersion(0);
        setStatus('syncing');
    };

    // ─── Render: No device key → Setup ──────────────────────────────────────
    if (!deviceKey || status === 'loading') {
        return <SetupScreen onSave={handleSaveDeviceKey} />;
    }

    // ─── Render: Duplicate device ────────────────────────────────────────────
    if (status === 'duplicate') {
        return (
            <div style={{
                width: '100vw', height: '100vh', background: '#0f0f1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '16px', color: 'rgba(255,255,255,0.7)',
                fontFamily: 'sans-serif', textAlign: 'center',
            }}>
                <div style={{ fontSize: '64px' }}>🔴</div>
                <h2 style={{ margin: 0, color: '#f43f5e', fontWeight: 700 }}>Dispositivo en uso</h2>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', maxWidth: '360px' }}>
                    Este device_key está siendo usado por otro dispositivo. Solo puede estar conectado 1 a la vez.
                </p>
                <button
                    onClick={() => {
                        localStorage.removeItem(DEVICE_KEY_STORAGE);
                        localStorage.removeItem(SESSION_ID_STORAGE);
                        localStorage.removeItem(STORAGE_KEY);
                        window.location.reload();
                    }}
                    style={{
                        marginTop: '12px', padding: '12px 24px',
                        background: '#7c3aed', border: 'none', borderRadius: '10px',
                        color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                    }}
                >
                    Cambiar device_key
                </button>
            </div>
        );
    }

    // ─── Render: Syncing for first time ──────────────────────────────────────
    if (status === 'syncing' && items.length === 0) {
        return (
            <div style={{
                width: '100vw', height: '100vh', background: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '20px', color: '#a78bfa'
            }}>
                <div style={{
                    width: '48px', height: '48px', border: '3px solid rgba(167,139,250,0.2)',
                    borderTopColor: '#a78bfa', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Conectando con el servidor...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ─── Render: No Content ───────────────────────────────────────────────────
    if (status === 'no-content' && items.length === 0) {
        return (
            <div style={{
                width: '100vw', height: '100vh', background: '#0f0f1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '16px', color: 'rgba(255,255,255,0.4)',
            }}>
                <div style={{ fontSize: '64px' }}>📺</div>
                <h2 style={{ margin: 0, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Sin contenido programado</h2>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Asigna una playlist en el CMS para este dispositivo.</p>
            </div>
        );
    }

    // ─── Render: Offline with no cache ───────────────────────────────────────
    if (status === 'offline' && items.length === 0) {
        return (
            <div style={{
                width: '100vw', height: '100vh', background: '#0f0f1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '16px', color: 'rgba(255,255,255,0.4)',
            }}>
                <div style={{ fontSize: '64px' }}>📡</div>
                <h2 style={{ margin: 0, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Sin señal</h2>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Verifica la conexión a internet del dispositivo.</p>
            </div>
        );
    }

    // ─── Render: Playback ─────────────────────────────────────────────────────
    const currentItem = items[currentIndex];
    if (!currentItem) return null;

    const media = currentItem.media;
    const config = media?.config;

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>
            <style>{`
                @keyframes playerFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes playerSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .player-fade-enter {
                    animation: playerFadeIn ${TRANSITION_DURATION}ms ease-in-out forwards;
                }
                .player-slide-enter {
                    animation: playerSlideIn ${TRANSITION_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1) forwards;
                }
            `}</style>

            {/* Content */}
            <div
                key={`${currentItem.id}-${currentIndex}`}
                className={transitionClass}
                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            >
                {media.type === 'image' && (
                    <img
                        src={media.url || ''}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}

                {media.type === 'video' && (
                    <video
                        key={media.url || currentIndex}
                        src={media.url || ''}
                        autoPlay
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}

                {media.type === 'url' && (
                    <iframe
                        src={media.url || ''}
                        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                        title={media.name}
                    />
                )}

                {media.type === 'widget' && config && (
                    <iframe
                        srcDoc={generateSlideHtml(
                            config.backgrounds || [],
                            config.layers || [],
                            config.slideBgMode || 'cover'
                        )}
                        style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                        title={media.name}
                    />
                )}
            </div>

            {/* Offline Indicator (subtle, non-intrusive) */}
            {status === 'offline' && items.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: '12px', right: '12px', zIndex: 100,
                    background: 'rgba(0,0,0,0.7)', borderRadius: '8px', padding: '6px 12px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: '0.7rem',
                }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24' }} />
                    Modo offline — reproduciendo caché
                </div>
            )}

            {/* Progress indicator (thin bar at bottom) */}
            {items.length > 1 && (
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px',
                    background: 'rgba(255,255,255,0.08)', zIndex: 50,
                }}>
                    <div style={{
                        height: '100%', background: 'rgba(167,139,250,0.6)',
                        width: `${((currentIndex + 1) / items.length) * 100}%`,
                        transition: 'width 0.4s ease',
                    }} />
                </div>
            )}

            {/* Dev info overlay (only visible in dev mode) */}
            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: 'absolute', top: '10px', left: '10px', zIndex: 200,
                    background: 'rgba(0,0,0,0.7)', borderRadius: '8px', padding: '8px 12px',
                    fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5,
                }}>
                    <div>🎬 {playlistName} v{version}</div>
                    <div>📺 Item {currentIndex + 1}/{items.length}: {media.name}</div>
                    <div>⚡ {media.type} | {currentItem.duration_seconds}s | {currentItem.transition_type}</div>
                    <div>🔄 Status: {status}</div>
                    <button
                        onClick={() => {
                            localStorage.removeItem(DEVICE_KEY_STORAGE);
                            localStorage.removeItem(STORAGE_KEY);
                            window.location.reload();
                        }}
                        style={{ marginTop: '6px', padding: '2px 8px', background: '#f43f5e', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.65rem' }}
                    >
                        Reset
                    </button>
                </div>
            )}
        </div>
    );
}
