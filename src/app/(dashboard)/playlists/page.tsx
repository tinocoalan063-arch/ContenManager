'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    ListVideo,
    Trash2,
    MoreVertical,
    Hash,
    Image,
    Clock,
    ChevronRight,
    Loader2,
    FileVideo,
} from 'lucide-react';
import styles from './playlists.module.css';

interface PlaylistRow {
    id: string;
    name: string;
    description: string | null;
    version: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    playlist_items?: { id: string; duration_seconds: number }[];
}

function formatDuration(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function PlaylistsPage() {
    const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        fetchPlaylists();
    }, []);

    async function fetchPlaylists() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) return;

        const { data } = await supabase
            .from('playlists')
            .select('*, playlist_items(id, duration_seconds)')
            .eq('company_id', userData.company_id)
            .order('updated_at', { ascending: false });

        setPlaylists(data || []);
        setLoading(false);
    }

    async function handleCreate() {
        if (!newName) return;
        setSaving(true);

        const res = await fetch('/api/v1/admin/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, description: newDesc || null }),
        });

        if (res.ok) {
            setShowModal(false);
            setNewName('');
            setNewDesc('');
            fetchPlaylists();
        }
        setSaving(false);
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar esta playlist?')) return;
        const res = await fetch(`/api/v1/admin/playlists?id=${id}`, { method: 'DELETE' });
        if (res.ok) fetchPlaylists();
    }

    return (
        <>
            <Topbar title="Playlists" subtitle="Secuencias de contenido multimedia" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Playlists</h1>
                        <p className={styles.headerSubtext}>{playlists.length} secuencias creadas</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} />
                        Nueva Playlist
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={20} className="loading-spinner" />
                        <span>Cargando playlists...</span>
                    </div>
                ) : playlists.length === 0 ? (
                    <div className="empty-state">
                        <FileVideo size={48} />
                        <h3>Sin playlists</h3>
                        <p>Crea tu primera playlist para organizar tu contenido multimedia.</p>
                    </div>
                ) : (
                    <div className={styles.playlistGrid}>
                        {playlists.map((playlist) => {
                            const itemCount = playlist.playlist_items?.length || 0;
                            const totalDuration = playlist.playlist_items?.reduce((acc, item) => acc + item.duration_seconds, 0) || 0;
                            return (
                                <div key={playlist.id} className={`glass-card ${styles.playlistCard}`}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardIcon}>
                                            <ListVideo size={20} />
                                        </div>
                                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDelete(playlist.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <h3 className={styles.cardTitle}>{playlist.name}</h3>
                                    <p className={styles.cardDesc}>{playlist.description || 'Sin descripción'}</p>

                                    <div className={styles.cardStats}>
                                        <div className={styles.cardStat}>
                                            <Image size={12} />
                                            <span>{itemCount} items</span>
                                        </div>
                                        <div className={styles.cardStat}>
                                            <Clock size={12} />
                                            <span>{formatDuration(totalDuration)}</span>
                                        </div>
                                        <div className={styles.cardStat}>
                                            <Hash size={12} />
                                            <span>v{playlist.version}</span>
                                        </div>
                                    </div>

                                    <div className={styles.cardFooter}>
                                        <span className={styles.cardAuthor}>
                                            {new Date(playlist.updated_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <Link href={`/playlists/${playlist.id}`} className={styles.editBtn}>
                                            Editar
                                            <ChevronRight size={14} />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Playlist Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nueva Playlist</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="label">Nombre</label>
                            <input className="input" placeholder="ej. Promo Verano 2026" value={newName} onChange={(e) => setNewName(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label className="label">Descripción (opcional)</label>
                            <input className="input" placeholder="Breve descripción de la playlist" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                                {saving ? <span className="loading-spinner"></span> : <Plus size={16} />}
                                Crear Playlist
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
