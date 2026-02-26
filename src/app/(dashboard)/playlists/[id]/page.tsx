'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Save,
    ArrowLeft,
    GripVertical,
    Trash2,
    Plus,
    Clock,
    Search,
    Image as ImageIcon,
    Video as VideoIcon,
    Globe,
    Loader2,
    Play,
    Info,
    FolderOpen,
    ChevronRight,
} from 'lucide-react';
import styles from '../editor.module.css';

interface MediaItem {
    id: string;
    name: string;
    type: 'image' | 'video' | 'url' | 'widget';
    duration_seconds: number;
    file_path: string | null;
    url: string | null;
    preview_url?: string;
}

interface PlaylistItem {
    id?: string;
    media_id: string;
    position: number;
    duration_seconds: number;
    media: MediaItem;
}

export default function PlaylistEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();

    const [playlist, setPlaylist] = useState<any>(null);
    const [items, setItems] = useState<PlaylistItem[]>([]);
    const [library, setLibrary] = useState<MediaItem[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    // Preview states
    const [showPreview, setShowPreview] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewProgress, setPreviewProgress] = useState(0);

    useEffect(() => {
        loadData();
    }, [id]);

    useEffect(() => {
        if (!loading) fetchLibrary();
    }, [currentFolderId]);

    async function loadData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return;

        const { data: playlistData } = await supabase
            .from('playlists')
            .select('*, playlist_items(*, media(*))')
            .eq('id', id)
            .single();

        if (playlistData) {
            setPlaylist(playlistData);
            const sortedItems = (playlistData.playlist_items || []).sort((a: any, b: any) => a.position - b.position);

            // Generate signed URLs for existing items to avoid "black" elements
            const itemsWithPreviews = await Promise.all(
                sortedItems.map(async (item: any) => {
                    if (item.media.type === 'url') return { ...item, media: { ...item.media, preview_url: item.media.url } };
                    if (!item.media.file_path) return item;

                    const { data: signedData } = await supabase.storage
                        .from('media')
                        .createSignedUrl(item.media.file_path, 3600);

                    return {
                        ...item,
                        media: { ...item.media, preview_url: signedData?.signedUrl }
                    };
                })
            );
            setItems(itemsWithPreviews);
        }

        await fetchLibrary();
        setLoading(false);
    }

    async function fetchLibrary() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return;

        const companyId = userData.company_id;

        // Fetch media and folders parallel
        const mediaQuery = supabase.from('media').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
        if (currentFolderId) {
            mediaQuery.eq('folder_id', currentFolderId);
        } else {
            mediaQuery.is('folder_id', null);
        }

        const foldersQuery = supabase.from('media_folders').select('*').eq('company_id', companyId).order('name', { ascending: true });
        if (currentFolderId) {
            foldersQuery.eq('parent_id', currentFolderId);
        } else {
            foldersQuery.is('parent_id', null);
        }

        const [mediaRes, foldersRes] = await Promise.all([mediaQuery, foldersQuery]);

        if (mediaRes.data) {
            const itemsWithPreviews = await Promise.all(
                mediaRes.data.map(async (item: any) => {
                    if (item.type === 'url') return { ...item, preview_url: item.url };
                    if (!item.file_path) return item;

                    const { data: signedData } = await supabase.storage
                        .from('media')
                        .createSignedUrl(item.file_path, 3600);

                    return { ...item, preview_url: signedData?.signedUrl };
                })
            );
            setLibrary(itemsWithPreviews);
        }

        if (foldersRes.data) {
            setFolders(foldersRes.data);
        }

        // Update breadcrumbs
        if (currentFolderId) {
            const path: any[] = [];
            let folderId = currentFolderId;
            while (folderId) {
                const { data: f } = await supabase.from('media_folders').select('id, name, parent_id').eq('id', folderId).single();
                if (f) {
                    path.unshift(f);
                    folderId = f.parent_id;
                } else break;
            }
            setBreadcrumbs(path);
        } else {
            setBreadcrumbs([]);
        }
    }

    const addItem = (media: MediaItem) => {
        const newItem: PlaylistItem = {
            media_id: media.id,
            position: items.length,
            duration_seconds: media.type === 'video' ? media.duration_seconds : 10,
            media: media
        };
        setItems([...items, newItem]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateDuration = (index: number, value: number) => {
        const newItems = [...items];
        const item = newItems[index];

        // Cap video duration at actual media duration
        if (item.media.type === 'video') {
            const max = item.media.duration_seconds;
            if (value > max) value = max;
        }

        if (value < 1) value = 1;

        item.duration_seconds = value;
        setItems(newItems);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await supabase.from('playlist_items').delete().eq('playlist_id', id);
            if (items.length > 0) {
                const insertData = items.map((item, idx) => ({
                    playlist_id: id,
                    media_id: item.media_id,
                    position: idx,
                    duration_seconds: item.duration_seconds
                }));
                await supabase.from('playlist_items').insert(insertData);
            }
            await supabase.from('playlists').update({
                version: (playlist.version || 1) + 1,
                updated_at: new Date().toISOString()
            }).eq('id', id);
            router.push('/playlists');
        } catch (error) {
            console.error('Error saving playlist:', error);
            alert('Error al guardar la playlist');
        } finally {
            setSaving(false);
        }
    };

    // Preview Logic
    useEffect(() => {
        let timer: any;
        if (showPreview && items.length > 0) {
            const currentItem = items[previewIndex];
            const duration = currentItem.duration_seconds * 1000;

            setPreviewProgress(0);
            const start = Date.now();

            timer = setInterval(() => {
                const elapsed = Date.now() - start;
                const progress = (elapsed / duration) * 100;

                if (progress >= 100) {
                    setPreviewProgress(100);
                    clearInterval(timer);
                    setTimeout(() => {
                        setPreviewIndex((prev) => (prev + 1) % items.length);
                    }, 100);
                } else {
                    setPreviewProgress(progress);
                }
            }, 50);
        }
        return () => clearInterval(timer);
    }, [showPreview, previewIndex, items.length]);

    const startPreview = () => {
        if (items.length === 0) return;
        setPreviewIndex(0);
        setPreviewProgress(0);
        setShowPreview(true);
    };

    if (loading) {
        return (
            <div className="loading-state">
                <Loader2 size={24} className="loading-spinner" />
                <span>Cargando editor...</span>
            </div>
        );
    }

    const filteredLibrary = library.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={styles.container}>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button className="btn btn-icon btn-secondary" onClick={() => router.push('/playlists')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1>{playlist?.name}</h1>
                        <p className={styles.headerSubtext}>Configura la secuencia de reproducción</p>
                    </div>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-secondary" onClick={startPreview} disabled={items.length === 0}>
                        <Play size={16} />
                        Previsualizar
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 size={16} className="loading-spinner" /> : <Save size={16} />}
                        Guardar Secuencia
                    </button>
                </div>
            </div>

            <div className={styles.editorLayout}>
                {/* Media Library Sidebar */}
                <div className={`glass-card ${styles.library}`}>
                    <div className={styles.librarySearch}>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    className="input"
                                    style={{ paddingLeft: '36px' }}
                                    placeholder="Buscar media..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Library Breadcrumbs */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', paddingBottom: '4px', fontSize: '0.75rem' }}>
                            <button
                                className={`btn-link ${!currentFolderId ? 'text-accent' : ''}`}
                                onClick={() => setCurrentFolderId(null)}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                Raíz
                            </button>
                            {breadcrumbs.map((bc) => (
                                <div key={bc.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ChevronRight size={12} className="text-muted" />
                                    <button
                                        className={`btn-link ${currentFolderId === bc.id ? 'text-accent' : ''}`}
                                        onClick={() => setCurrentFolderId(bc.id)}
                                        style={{ whiteSpace: 'nowrap' }}
                                    >
                                        {bc.name}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.libraryList}>
                        {/* Folders in Library */}
                        {!search && folders.map(folder => (
                            <div key={folder.id} className={styles.libraryItem} onClick={() => setCurrentFolderId(folder.id)}>
                                <div className={styles.itemThumb} style={{ background: 'rgba(var(--accent-rgb), 0.1)' }}>
                                    <FolderOpen size={16} className="text-accent" />
                                </div>
                                <div className={styles.itemInfo}>
                                    <h4>{folder.name}</h4>
                                    <p>Carpeta</p>
                                </div>
                                <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                            </div>
                        ))}

                        {filteredLibrary.map(item => (
                            <div key={item.id} className={styles.libraryItem} onClick={() => addItem(item)}>
                                <div className={styles.itemThumb}>
                                    {item.preview_url ? (
                                        item.type === 'image' ? (
                                            <img src={item.preview_url} alt="" />
                                        ) : item.type === 'video' ? (
                                            <VideoIcon size={16} />
                                        ) : (
                                            <Globe size={16} />
                                        )
                                    ) : (
                                        item.type === 'widget' ? <Info size={16} /> : <ImageIcon size={16} />
                                    )}
                                </div>
                                <div className={styles.itemInfo}>
                                    <h4>{item.name}</h4>
                                    <p>{item.type} · {item.duration_seconds}s</p>
                                </div>
                                <Plus size={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />
                            </div>
                        ))}

                        {filteredLibrary.length === 0 && folders.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                Vacío
                            </div>
                        )}
                    </div>
                </div>

                {/* Sequence Main Area */}
                <div className={`glass-card ${styles.sequenceArea}`}>
                    <div className={styles.sequenceHeader}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Secuencia de Reproducción</h2>
                        <span className="badge badge-media">{items.length} items agregados</span>
                    </div>

                    <div className={styles.sequenceList}>
                        {items.length === 0 ? (
                            <div className={styles.emptySequence}>
                                <Play size={32} />
                                <p>Agrega contenido desde la biblioteca para comenzar</p>
                                <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Haz clic en los elementos de la izquierda</p>
                            </div>
                        ) : (
                            items.map((item, idx) => (
                                <div key={idx} className={`glass-card ${styles.seqItem}`}>
                                    <div className={styles.seqHandle}>
                                        <GripVertical size={18} />
                                    </div>
                                    <div className={styles.seqThumb}>
                                        {item.media.preview_url && item.media.type === 'image' ? (
                                            <img src={item.media.preview_url} alt="" />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', height: '100%', width: '100%', justifyContent: 'center' }}>
                                                {item.media.type === 'video' ? <VideoIcon size={14} /> : <ImageIcon size={14} />}
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.seqName}>
                                        <h4>{item.media.name}</h4>
                                    </div>
                                    <div className={styles.seqDuration}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input
                                                type="number"
                                                className={`input ${styles.durationInput}`}
                                                value={item.duration_seconds}
                                                onChange={(e) => updateDuration(idx, parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '0.7rem' }}>segundos</span>
                                            {item.media.type === 'video' && (
                                                <span className={styles.maxDuration}>Max: {item.media.duration_seconds}s</span>
                                            )}
                                        </div>
                                    </div>
                                    <button className="btn btn-icon btn-danger btn-sm" onClick={() => removeItem(idx)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={styles.sequenceFooter} style={{ padding: '16px', borderTop: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={14} className="text-accent" />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Los cambios se verán reflejados en los players en la próxima sincronización.
                        </p>
                    </div>
                </div>
            </div>

            {/* Playlist Preview Modal */}
            {showPreview && items.length > 0 && (
                <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                    <div className="modal-content" style={{ maxWidth: '90vw', width: 'auto', padding: '16px', borderRadius: 'var(--radius-lg)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2>Simulación de Playlist</h2>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Item {previewIndex + 1} de {items.length}: {items[previewIndex].media.name}
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setShowPreview(false)}>✕</button>
                        </div>

                        <div style={{ position: 'relative', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '16 / 9', minWidth: '60vw', maxHeight: '70vh' }}>
                            {items[previewIndex].media.type === 'image' && (
                                <img
                                    src={items[previewIndex].media.preview_url}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            )}
                            {items[previewIndex].media.type === 'video' && (
                                <video
                                    src={items[previewIndex].media.preview_url}
                                    autoPlay
                                    muted
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            )}
                            {items[previewIndex].media.type === 'url' && (
                                <iframe
                                    src={items[previewIndex].media.url || ''}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                />
                            )}
                            {items[previewIndex].media.type === 'widget' && (
                                <iframe
                                    srcDoc={(items[previewIndex].media as any).config?.html}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                />
                            )}

                            {/* Progress Bar */}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)' }}>
                                <div style={{ height: '100%', background: 'var(--accent)', width: `${previewProgress}%`, transition: 'width 0.05s linear' }}></div>
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '20px', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setPreviewIndex((prev) => (prev - 1 + items.length) % items.length)}>
                                Anterior
                            </button>
                            <button className="btn btn-secondary" onClick={() => setPreviewIndex((prev) => (prev + 1) % items.length)}>
                                Siguiente
                            </button>
                            <button className="btn btn-primary" onClick={() => setShowPreview(false)}>
                                Cerrar Vista
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
