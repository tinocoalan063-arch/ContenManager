'use client';

import { useState, useEffect, useRef } from 'react';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
    Monitor,
    Image,
    ListVideo,
    Wifi,
    ArrowUpRight,
    Clock,
    Loader2,
    HardDrive,
    Users,
    AlertTriangle,
} from 'lucide-react';
import styles from './dashboard.module.css';

interface StatCardProps {
    title: string;
    value: string;
    subtitle: string;
    icon: any;
    trend?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
    return (
        <div className="glass-card stat-card animate-in">
            <div className="stat-icon">
                <Icon size={20} />
            </div>
            <div className="stat-info">
                <h3>{value}</h3>
                <p>{title}</p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtitle}</span>
            </div>
            {trend && <div className={styles.trend}>{trend}</div>}
        </div>
    );
}

interface DashboardStats {
    totalPlayers: number;
    onlinePlayers: number;
    offlineAlerts: number;
    totalMedia: number;
    totalPlaylists: number;
    storageUsedMB: number;
    storageLimitMB: number;
}

interface PlayerInfo {
    id: string;
    name: string;
    status: string;
    last_heartbeat: string | null;
    player_playlists?: {
        is_active: boolean;
        playlist: { name: string } | { name: string }[] | null
    }[];
}

/** Player considered offline if no heartbeat in last 2 min */
const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;
function getEffectiveStatus(player: Pick<PlayerInfo, 'status' | 'last_heartbeat'>): 'online' | 'offline' {
    if (!player.last_heartbeat) return 'offline';
    return (Date.now() - new Date(player.last_heartbeat).getTime()) <= OFFLINE_THRESHOLD_MS ? 'online' : 'offline';
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalPlayers: 0,
        onlinePlayers: 0,
        offlineAlerts: 0,
        totalMedia: 0,
        totalPlaylists: 0,
        storageUsedMB: 0,
        storageLimitMB: 5120
    });
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    // Use a ref to track current players for the real-time update logic
    const currentPlayersRef = useRef<PlayerInfo[]>([]);
    useEffect(() => {
        currentPlayersRef.current = players;
    }, [players]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) {
            setLoading(false);
            return;
        }

        const companyId = userData.company_id;

        // Fetch counts in parallel
        const [playersRes, mediaRes, playlistsRes, companyRes] = await Promise.all([
            supabase.from('players').select('id, name, status, last_heartbeat, player_playlists(is_active, playlist:playlists(name))').eq('company_id', companyId).order('created_at', { ascending: false }),
            supabase.from('media').select('id, size_bytes').eq('company_id', companyId),
            supabase.from('playlists').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
            supabase.from('companies').select('max_storage_mb, storage_limit_mb').eq('id', companyId).single(),
        ]);

        const playersList = (playersRes.data || []) as PlayerInfo[];

        // Calculate storage
        const totalSizeBytes = (mediaRes.data || []).reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
        const storageUsedMB = Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100;

        // Detect offline alerts (Online status but no heartbeat in 10 mins)
        const now = new Date();
        const offlineThreshold = new Date(now.getTime() - 10 * 60 * 1000);
        const offlineAlertsCount = playersList.filter(p => {
            if (p.status !== 'online') return false;
            if (!p.last_heartbeat) return true;
            return new Date(p.last_heartbeat) < offlineThreshold;
        }).length;

        setStats({
            totalPlayers: playersList.length,
            onlinePlayers: playersList.filter(p => getEffectiveStatus(p) === 'online').length,
            offlineAlerts: offlineAlertsCount,
            totalMedia: mediaRes.data?.length || 0,
            totalPlaylists: playlistsRes.count || 0,
            storageUsedMB,
            storageLimitMB: companyRes.data?.storage_limit_mb || companyRes.data?.max_storage_mb || 5120
        });

        setPlayers(playersList.slice(0, 5));
        setLoading(false);

        // Real-time subscription
        const channel = supabase
            .channel('dashboard-players')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'players',
                    filter: `company_id=eq.${companyId}`,
                },
                (payload) => {
                    const updatedPlayer = payload.new as PlayerInfo;
                    setPlayers((current) =>
                        current.map((p) => (p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p))
                    );

                    // Update online count stat
                    setStats(prev => {
                        const wasOnline = currentPlayersRef.current.find(p => p.id === updatedPlayer.id)?.status === 'online';
                        const isNowOnline = updatedPlayer.status === 'online';

                        if (wasOnline === isNowOnline) return prev;

                        return {
                            ...prev,
                            onlinePlayers: isNowOnline ? prev.onlinePlayers + 1 : prev.onlinePlayers - 1
                        };
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }

    function getActivePlaylist(player: PlayerInfo): string {
        const active = player.player_playlists?.find(pp => pp.is_active);
        if (!active?.playlist) return 'Sin asignar';

        const playlistData = Array.isArray(active.playlist) ? active.playlist[0] : active.playlist;
        return playlistData?.name || 'Sin asignar';
    }

    if (loading) {
        return (
            <>
                <Topbar title="Dashboard" subtitle="Resumen general del sistema" />
                <div className="loading-state" style={{ minHeight: '400px' }}>
                    <Loader2 size={24} className="loading-spinner" />
                    <span>Cargando dashboard...</span>
                </div>
            </>
        );
    }

    const onlinePercentage = stats.totalPlayers > 0 ? (stats.onlinePlayers / stats.totalPlayers) * 100 : 0;
    const storagePercentage = Math.min((stats.storageUsedMB / stats.storageLimitMB) * 100, 100);

    return (
        <>
            <Topbar title="Dashboard" subtitle="Resumen general de tu red de señalización" />

            <div className={styles.content}>
                <div className="stats-grid">
                    <StatCard
                        title="Players"
                        value={stats.totalPlayers.toString()}
                        subtitle={`${stats.onlinePlayers} en línea`}
                        icon={Monitor}
                        trend={`${Math.round(onlinePercentage)}%`}
                    />
                    <StatCard
                        title="Contenido"
                        value={stats.totalMedia.toString()}
                        subtitle="Archivos multimedia"
                        icon={Image}
                    />
                    <StatCard
                        title="Playlists"
                        value={stats.totalPlaylists.toString()}
                        subtitle="Listas de reproducción"
                        icon={ListVideo}
                    />
                    <div className={`glass-card ${styles.section} ${styles.storageCard}`}>
                        <div className={styles.storageHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HardDrive size={18} className={styles.sectionIcon} />
                                <h2 style={{ fontSize: '0.9rem', margin: 0 }}>Almacenamiento</h2>
                            </div>
                            <span className={styles.sectionBadge}>{Math.round(storagePercentage)}%</span>
                        </div>
                        <div className={styles.storageProgress}>
                            <div
                                className={styles.storageFill}
                                style={{ width: `${storagePercentage}%`, background: storagePercentage > 90 ? '#ef4444' : '' }}
                            />
                        </div>
                        <div className={styles.storageLabels}>
                            <span>{stats.storageUsedMB} MB / {stats.storageLimitMB} MB</span>
                        </div>
                    </div>
                </div>

                {stats.offlineAlerts > 0 && (
                    <div className={styles.alertBanner}>
                        <div className={styles.alertIcon}>
                            <AlertTriangle size={20} />
                        </div>
                        <div className={styles.alertText}>
                            <p><strong>Atención:</strong> {stats.offlineAlerts === 1 ? '1 player ha perdido conexión' : `${stats.offlineAlerts} players han perdido conexión`} hace más de 10 minutos.</p>
                            <Link href="/players" className={styles.alertLink}>Gestionar Players</Link>
                        </div>
                    </div>
                )}

                <div className={styles.grid}>
                    <div className={`glass-card ${styles.section}`}>
                        <div className={styles.sectionHeader}>
                            <h2>Estado de Players</h2>
                            <span className={styles.sectionBadge}>{stats.totalPlayers} dispositivos</span>
                        </div>
                        {players.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>
                                No hay players registrados aún.
                            </p>
                        ) : (
                            <div className={styles.playerList}>
                                {players.map((player) => (
                                    <div key={player.id} className={styles.playerRow}>
                                        <div className={styles.playerInfo}>
                                            <span className={`badge ${getEffectiveStatus(player) === 'online' ? 'badge-online' : 'badge-offline'}`}>
                                                {getEffectiveStatus(player)}
                                            </span>
                                            <div>
                                                <p className={styles.playerName}>{player.name}</p>
                                                <p className={styles.playerPlaylist}>{getActivePlaylist(player)}</p>
                                            </div>
                                        </div>
                                        <span className={styles.playerTime}>
                                            {player.last_heartbeat
                                                ? new Date(player.last_heartbeat).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                                : 'Nunca'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={`glass-card ${styles.section}`}>
                        <div className={styles.sectionHeader}>
                            <h2>Resumen</h2>
                            <Clock size={16} className={styles.sectionIcon} />
                        </div>
                        <div className={styles.activityList}>
                            <div className={styles.activityRow}>
                                <div className={styles.activityDot} data-type="player"></div>
                                <div className={styles.activityContent}>
                                    <p>{stats.onlinePlayers} de {stats.totalPlayers} players conectados</p>
                                    <span>Estado actual</span>
                                </div>
                            </div>
                            <div className={styles.activityRow}>
                                <div className={styles.activityDot} data-type="media"></div>
                                <div className={styles.activityContent}>
                                    <p>{stats.totalMedia} archivos en la biblioteca</p>
                                    <span>Media total</span>
                                </div>
                            </div>
                            <div className={styles.activityRow}>
                                <div className={styles.activityDot}></div>
                                <div className={styles.activityContent}>
                                    <p>{stats.totalPlaylists} playlists creadas</p>
                                    <span>Contenido organizado</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
