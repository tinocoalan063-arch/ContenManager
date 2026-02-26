'use client';

import { useState, useEffect, useRef } from 'react';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Monitor,
    Copy,
    Trash2,
    ListVideo,
    RefreshCw,
    Loader2,
    MonitorOff,
    Calendar,
    Clock,
    Terminal,
    RotateCcw,
    Camera,
    Eraser,
} from 'lucide-react';
import styles from './players.module.css';

interface PlayerRow {
    id: string;
    name: string;
    device_key: string;
    status: 'online' | 'offline';
    last_heartbeat: string | null;
    group_name: string | null;
    player_playlists?: {
        playlist_id: string;
        playlist: { name: string } | { name: string }[] | null;
        is_active: boolean;
    }[];
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export default function PlayersPage() {
    const [players, setPlayers] = useState<PlayerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
    const [playlists, setPlaylists] = useState<{ id: string, name: string }[]>([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState('');
    const [showCommandModal, setShowCommandModal] = useState(false);
    const [commanding, setCommanding] = useState(false);
    const [schedule, setSchedule] = useState({
        start_date: '',
        end_date: '',
        start_time: '00:00:00',
        end_time: '23:59:59',
        days_of_week: [0, 1, 2, 3, 4, 5, 6]
    });

    const [newName, setNewName] = useState('');
    const [newGroup, setNewGroup] = useState('');
    const [saving, setSaving] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const supabase = createClient();

    // Use a ref to track current players for real-time logic
    const currentPlayersRef = useRef<PlayerRow[]>([]);
    useEffect(() => {
        currentPlayersRef.current = players;
    }, [players]);

    useEffect(() => {
        if (showAssignModal) {
            fetchPlaylists();
        }
    }, [showAssignModal]);

    async function fetchPlaylists() {
        const { data } = await supabase.from('playlists').select('id, name');
        setPlaylists(data || []);
    }

    useEffect(() => {
        fetchPlayers();
    }, []);

    async function fetchPlayers() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id, role')
            .eq('id', user.id)
            .single();

        if (!userData) return;
        setCurrentUserRole(userData.role);

        const companyId = userData.company_id;

        const { data } = await supabase
            .from('players')
            .select('*, player_playlists(is_active, playlist_id, playlist:playlists(name))')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        const playersList = (data || []) as PlayerRow[];
        setPlayers(playersList);
        setLoading(false);

        // Real-time subscription
        const channel = supabase
            .channel('players-list-status')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'players',
                    filter: `company_id=eq.${companyId}`,
                },
                (payload) => {
                    const updatedPlayer = payload.new as PlayerRow;
                    setPlayers((current) =>
                        current.map((p) => (p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p))
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }

    async function handleSendCommand(command: string) {
        if (!selectedPlayer) return;
        setCommanding(true);

        try {
            const res = await fetch('/api/v1/admin/players/commands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: selectedPlayer.id,
                    command,
                    payload: {}
                }),
            });

            if (res.ok) {
                alert(`Comando ${command} enviado con éxito`);
                setShowCommandModal(false);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            console.error('Error sending command:', error);
            alert('Error al enviar comando');
        } finally {
            setCommanding(false);
        }
    }

    async function handleCreate() {
        if (!newName) return;
        setSaving(true);

        const res = await fetch('/api/v1/admin/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, group_name: newGroup || null }),
        });

        if (res.ok) {
            setShowModal(false);
            setNewName('');
            setNewGroup('');
            fetchPlayers();
        }
        setSaving(false);
    }

    async function handleAssign() {
        if (!selectedPlayer || !selectedPlaylist) return;
        setSaving(true);

        const res = await fetch('/api/v1/admin/players', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: selectedPlayer.id,
                playlist_id: selectedPlaylist,
                schedule: {
                    ...schedule,
                    // Empty strings become null on backend? Better be explicit
                    start_date: schedule.start_date || null,
                    end_date: schedule.end_date || null,
                    start_time: schedule.start_time || null,
                    end_time: schedule.end_time || null,
                }
            }),
        });

        if (res.ok) {
            setShowAssignModal(false);
            setSelectedPlayer(null);
            setSelectedPlaylist('');
            fetchPlayers();
        }
        setSaving(false);
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este player?')) return;
        const res = await fetch(`/api/v1/admin/players?id=${id}`, { method: 'DELETE' });
        if (res.ok) fetchPlayers();
    }

    function toggleDay(day: number) {
        setSchedule(prev => ({
            ...prev,
            days_of_week: prev.days_of_week.includes(day)
                ? prev.days_of_week.filter(d => d !== day)
                : [...prev.days_of_week, day]
        }));
    }

    function openAssignModal(player: PlayerRow) {
        setSelectedPlayer(player);
        const activePP = player.player_playlists?.find(pp => pp.is_active);
        if (activePP) {
            setSelectedPlaylist(activePP.playlist_id || '');
        } else {
            setSelectedPlaylist('');
        }
        setShowAssignModal(true);
    }

    function copyKey(key: string) {
        navigator.clipboard.writeText(key);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    }

    function getActivePlaylist(player: PlayerRow): string | null {
        const active = player.player_playlists?.find(pp => pp.is_active);
        if (!active?.playlist) return null;

        const playlistData = Array.isArray(active.playlist) ? active.playlist[0] : active.playlist;
        return playlistData?.name || null;
    }

    const onlineCount = players.filter(p => p.status === 'online').length;

    return (
        <>
            <Topbar title="Players" subtitle="Gestión de dispositivos de reproducción" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Players</h1>
                        <p className={styles.headerSubtext}>{players.length} dispositivos registrados</p>
                    </div>
                    {currentUserRole !== 'editor' && (
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            <Plus size={16} />
                            Registrar Player
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={20} className="loading-spinner" />
                        <span>Cargando players...</span>
                    </div>
                ) : players.length === 0 ? (
                    <div className="empty-state">
                        <MonitorOff size={48} />
                        <h3>Sin players</h3>
                        <p>Registra tu primer player para comenzar a distribuir contenido.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Estado</th>
                                    <th>Nombre</th>
                                    <th>Device Key</th>
                                    <th>Grupo</th>
                                    <th>Playlist</th>
                                    <th>Última conexión</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {players.map((player) => {
                                    const playlistName = getActivePlaylist(player);
                                    return (
                                        <tr key={player.id}>
                                            <td>
                                                <span className={`badge ${player.status === 'online' ? 'badge-online' : 'badge-offline'}`}>
                                                    {player.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.playerCell}>
                                                    <Monitor size={16} className={styles.playerIcon} />
                                                    <span className={styles.playerName}>{player.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.deviceKeyCell}>
                                                    <code className={styles.deviceKey}>{player.device_key}</code>
                                                    <button
                                                        className={styles.copyBtn}
                                                        title={copiedKey === player.device_key ? '¡Copiado!' : 'Copiar'}
                                                        onClick={() => copyKey(player.device_key)}
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.groupText}>{player.group_name || '—'}</span>
                                            </td>
                                            <td>
                                                {playlistName ? (
                                                    <span className={styles.playlistTag}>
                                                        <ListVideo size={12} />
                                                        {playlistName}
                                                    </span>
                                                ) : (
                                                    <span className={styles.noPlaylist}>Sin asignar</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={styles.timeText}>
                                                    {player.last_heartbeat
                                                        ? new Date(player.last_heartbeat).toLocaleString('es-MX', {
                                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                                        })
                                                        : 'Nunca'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="btn btn-icon btn-secondary btn-sm" title="Programación" onClick={() => openAssignModal(player)}>
                                                        <Calendar size={14} />
                                                    </button>
                                                    <button className="btn btn-icon btn-secondary btn-sm" title="Asignar Playlist" onClick={() => openAssignModal(player)}>
                                                        <ListVideo size={14} />
                                                    </button>
                                                    {currentUserRole !== 'editor' && (
                                                        <>
                                                            <button
                                                                className="btn btn-secondary btn-sm btn-icon"
                                                                title="Comandos Remotos"
                                                                onClick={() => {
                                                                    setSelectedPlayer(player);
                                                                    setShowCommandModal(true);
                                                                }}
                                                            >
                                                                <Terminal size={14} />
                                                            </button>
                                                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(player.id)}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Register Player Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Registrar Nuevo Player</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="label">Nombre del Player</label>
                            <input
                                className="input"
                                placeholder="ej. Lobby Principal"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Grupo (opcional)</label>
                            <input
                                className="input"
                                placeholder="ej. Edificio A"
                                value={newGroup}
                                onChange={(e) => setNewGroup(e.target.value)}
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                                {saving ? <span className="loading-spinner"></span> : <Plus size={16} />}
                                Registrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Playlist Modal */}
            {showAssignModal && selectedPlayer && (
                <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Asignar Playlist: {selectedPlayer.name}</h2>
                            <button className="modal-close" onClick={() => setShowAssignModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="label">Seleccionar Playlist</label>
                            <select
                                className="input"
                                value={selectedPlaylist}
                                onChange={(e) => setSelectedPlaylist(e.target.value)}
                            >
                                <option value="">Seleccione una playlist...</option>
                                {playlists.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.schedulerSection}>
                            <h3 className="section-title">Programación Avanzada</h3>

                            <div className={styles.schedulerGrid}>
                                <div className="form-group">
                                    <label className="label"><Calendar size={12} /> Fecha Inicio</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={schedule.start_date}
                                        onChange={(e) => setSchedule({ ...schedule, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label"><Calendar size={12} /> Fecha Fin</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={schedule.end_date}
                                        onChange={(e) => setSchedule({ ...schedule, end_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.schedulerGrid}>
                                <div className="form-group">
                                    <label className="label"><Clock size={12} /> Hora Inicio</label>
                                    <input
                                        type="time"
                                        className="input"
                                        value={schedule.start_time}
                                        onChange={(e) => setSchedule({ ...schedule, start_time: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label"><Clock size={12} /> Hora Fin</label>
                                    <input
                                        type="time"
                                        className="input"
                                        value={schedule.end_time}
                                        onChange={(e) => setSchedule({ ...schedule, end_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="label">Días de la Semana</label>
                                <div className={styles.daysGrid}>
                                    {DAYS.map((day, i) => (
                                        <button
                                            key={i}
                                            className={`${styles.dayBtn} ${schedule.days_of_week.includes(i) ? styles.dayBtnActive : ''}`}
                                            onClick={() => toggleDay(i)}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleAssign} disabled={saving || !selectedPlaylist}>
                                {saving ? <span className="loading-spinner"></span> : <ListVideo size={16} />}
                                Guardar Programación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remote Commands Modal */}
            {showCommandModal && selectedPlayer && (
                <div className="modal-overlay" onClick={() => setShowCommandModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Comandos Remotos: {selectedPlayer.name}</h2>
                            <button className="modal-close" onClick={() => setShowCommandModal(false)}>✕</button>
                        </div>

                        <p className={styles.modalText}>
                            Selecciona una acción para enviar al dispositivo. El dispositivo ejecutará el comando en su próxima sincronización.
                        </p>

                        <div className={styles.commandGrid}>
                            <button
                                className={styles.commandBtn}
                                onClick={() => handleSendCommand('REBOOT')}
                                disabled={commanding}
                            >
                                <RotateCcw size={20} />
                                <span>Reiniciar</span>
                            </button>
                            <button
                                className={styles.commandBtn}
                                onClick={() => handleSendCommand('SCREENSHOT')}
                                disabled={commanding}
                            >
                                <Camera size={20} />
                                <span>Capturar Pantalla</span>
                            </button>
                            <button
                                className={styles.commandBtn}
                                onClick={() => handleSendCommand('CLEAR_CACHE')}
                                disabled={commanding}
                            >
                                <Eraser size={20} />
                                <span>Limpiar Caché</span>
                            </button>
                            <button
                                className={styles.commandBtn}
                                onClick={() => handleSendCommand('REFRESH')}
                                disabled={commanding}
                            >
                                <RotateCcw size={20} />
                                <span>Refrescar Contenido</span>
                            </button>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowCommandModal(false)}
                                disabled={commanding}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
