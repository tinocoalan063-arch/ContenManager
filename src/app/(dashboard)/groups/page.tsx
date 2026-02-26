'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Layers,
    Monitor,
    Trash2,
    Loader2,
    ChevronRight,
    Search,
    UserPlus,
    X,
} from 'lucide-react';
import styles from './groups.module.css';

interface Group {
    id: string;
    name: string;
    description: string | null;
    players: { id: string, name: string, status: string }[];
}

interface MiniPlayer {
    id: string;
    name: string;
    status: string;
    group_id: string | null;
}

export default function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [allPlayers, setAllPlayers] = useState<MiniPlayer[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddPlayersModal, setShowAddPlayersModal] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

    const supabase = createClient();

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) return;

        const companyId = userData.company_id;

        // Fetch groups and all players in parallel
        const [groupsRes, playersRes] = await Promise.all([
            fetch('/api/v1/admin/groups').then(r => r.json()),
            supabase.from('players').select('id, name, status, group_id').eq('company_id', companyId)
        ]);

        if (groupsRes.success) {
            setGroups(groupsRes.data);
            if (groupsRes.data.length > 0 && !selectedGroupId) {
                setSelectedGroupId(groupsRes.data[0].id);
            }
        }

        setAllPlayers(playersRes.data || []);
        setLoading(false);
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    const unassignedPlayers = allPlayers.filter(p => !p.group_id);

    async function handleCreateGroup() {
        if (!name) return;
        setSaving(true);
        const res = await fetch('/api/v1/admin/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
        });

        if (res.ok) {
            setName('');
            setDescription('');
            setShowCreateModal(false);
            fetchData();
        }
        setSaving(false);
    }

    async function handleDeleteGroup(id: string) {
        if (!confirm('¿Eliminar este grupo? Los players volverán a estar sin grupo.')) return;
        const res = await fetch(`/api/v1/admin/groups?id=${id}`, { method: 'DELETE' });
        if (res.ok) fetchData();
    }

    async function handleAddPlayersToGroup() {
        if (selectedPlayers.length === 0 || !selectedGroupId) return;
        setSaving(true);

        // Update each player parallelly (could be improved with a batch API)
        await Promise.all(selectedPlayers.map(playerId =>
            supabase.from('players').update({ group_id: selectedGroupId }).eq('id', playerId)
        ));

        setSelectedPlayers([]);
        setShowAddPlayersModal(false);
        fetchData();
        setSaving(false);
    }

    async function removePlayerFromGroup(playerId: string) {
        if (!confirm('¿Quitar este player del grupo?')) return;
        const { error } = await supabase.from('players').update({ group_id: null }).eq('id', playerId);
        if (!error) fetchData();
    }

    return (
        <>
            <Topbar title="Grupos" subtitle="Organiza tus players por ubicación o propósito" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Gestión de Grupos</h1>
                        <p className={styles.headerSubtext}>{groups.length} grupos creados</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={16} />
                        Nuevo Grupo
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={24} className="loading-spinner" />
                        <span>Cargando grupos...</span>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="empty-state">
                        <Layers size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <h3>Sin grupos</h3>
                        <p>Crea tu primer grupo para gestionar players de forma masiva.</p>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {/* Sidebar */}
                        <div className={styles.groupSelection}>
                            {groups.map(group => (
                                <div
                                    key={group.id}
                                    className={`${styles.groupItem} ${selectedGroupId === group.id ? styles.groupItemActive : ''}`}
                                    onClick={() => setSelectedGroupId(group.id)}
                                >
                                    <div>
                                        <div className={styles.groupName}>{group.name}</div>
                                        <div className={styles.playerCount}>{group.players?.length || 0} players</div>
                                    </div>
                                    <ChevronRight size={14} style={{ opacity: selectedGroupId === group.id ? 1 : 0.3 }} />
                                </div>
                            ))}
                        </div>

                        {/* Main Area */}
                        <div className={`glass-card ${styles.mainArea}`}>
                            {selectedGroup ? (
                                <>
                                    <div className={styles.mainHeader}>
                                        <div>
                                            <h2>{selectedGroup.name}</h2>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {selectedGroup.description || 'Sin descripción'}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddPlayersModal(true)}>
                                                <UserPlus size={14} />
                                                Agregar Players
                                            </button>
                                            <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDeleteGroup(selectedGroup.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.playersList}>
                                        {selectedGroup.players && selectedGroup.players.length > 0 ? (
                                            selectedGroup.players.map(player => (
                                                <div key={player.id} className={styles.playerItem}>
                                                    <div className={styles.playerInfo}>
                                                        <Monitor size={16} className={styles.playerIcon} />
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>{player.name}</div>
                                                            <span className={`badge ${player.status === 'online' ? 'badge-online' : 'badge-offline'}`} style={{ fontSize: '0.6rem' }}>
                                                                {player.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn btn-icon btn-sm"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        onClick={() => removePlayerFromGroup(player.id)}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px' }}>
                                                No hay players en este grupo aún.
                                            </p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <p>Selecciona un grupo para ver sus detalles.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Group Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nuevo Grupo</h2>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="label">Nombre del Grupo</label>
                            <input
                                className="input"
                                placeholder="ej. Recepción, Cafetería..."
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label">Descripción</label>
                            <textarea
                                className="input"
                                placeholder="Opcional..."
                                style={{ minHeight: '80px' }}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" disabled={saving || !name} onClick={handleCreateGroup}>
                                {saving ? <Loader2 size={16} className="loading-spinner" /> : <Plus size={16} />}
                                Crear Grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Players Modal */}
            {showAddPlayersModal && (
                <div className="modal-overlay" onClick={() => setShowAddPlayersModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Agregar Players al Grupo</h2>
                            <button className="modal-close" onClick={() => setShowAddPlayersModal(false)}>✕</button>
                        </div>

                        <div className={styles.unassignedPlayersList}>
                            {unassignedPlayers.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                                    No hay players disponibles para asignar.
                                </p>
                            ) : (
                                unassignedPlayers.map(player => (
                                    <div
                                        key={player.id}
                                        className={styles.unassignedItem}
                                        onClick={() => {
                                            setSelectedPlayers(prev =>
                                                prev.includes(player.id)
                                                    ? prev.filter(id => id !== player.id)
                                                    : [...prev, player.id]
                                            );
                                        }}
                                        style={{ cursor: 'pointer', background: selectedPlayers.includes(player.id) ? 'var(--accent-subtle)' : '' }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedPlayers.includes(player.id)}
                                            readOnly
                                        />
                                        <Monitor size={14} />
                                        <span>{player.name}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowAddPlayersModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" disabled={saving || selectedPlayers.length === 0} onClick={handleAddPlayersToGroup}>
                                {saving ? <Loader2 size={16} className="loading-spinner" /> : <UserPlus size={16} />}
                                Asignar {selectedPlayers.length} Players
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
