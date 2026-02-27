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
    ExternalLink,
} from 'lucide-react';
import styles from '../editor.module.css';

// ---- HELPER FUNCTIONS ----
export function generateSlideHtml(slideBackgrounds: any[], sceneLayers: any[], slideBgMode: string = 'cover') {
    return `
        <style>body { margin: 0; padding: 0; overflow: hidden; background: #000; }</style>
        <div id="slide" style="position:relative; width:100vw; height:100vh; overflow:hidden; background:#000; font-family:sans-serif;">
            <!-- Background Slideshow -->
            <div id="bg-slideshow" style="width:100%; height:100%;">
                ${slideBackgrounds.map((bg, idx) => `
                    <img 
                        src="${bg.preview_url}" 
                        id="bg-${idx}"
                        style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:${slideBgMode}; opacity:${idx === 0 ? 1 : 0}; transition:opacity 0.8s ease-in-out;" 
                    />
                `).join('')}
            </div>

            <!-- Dynamic Layers -->
            ${sceneLayers.filter(l => l.active).map(layer => {
        let content = '';
        if (layer.type === 'clock') {
            content = `
                        <div id="clock-${layer.id}" style="color:#fff; text-align:right; text-shadow:0 4px 15px rgba(0,0,0,0.8); white-space:nowrap;">
                            <div class="time" style="font-size:8vw; font-weight:bold; line-height:1;">00:00</div>
                            <div class="date" style="font-size:3vw; opacity:0.9; margin-top:10px;">Cargando...</div>
                        </div>
                    `;
        } else if (layer.type === 'weather') {
            content = `
                        <div id="weather-${layer.id}" style="color:#fff; display:flex; align-items:center; gap:20px; text-shadow:0 4px 15px rgba(0,0,0,0.8); white-space:nowrap;">
                            <div style="font-size:6vw;">☀️</div>
                            <div style="text-align:left;">
                                <div style="font-size:5vw; font-weight:bold; line-height:1;">24°C</div>
                                <div style="font-size:2vw; opacity:0.9;">Localidad</div>
                            </div>
                        </div>
                    `;
        } else if (layer.type === 'image') {
            content = `<img src="${layer.url}" style="width:100%; height:100%; object-fit:contain;" />`;
        } else if (layer.type === 'video') {
            content = `<video src="${layer.url}" autoplay loop muted style="width:100%; height:100%; object-fit:contain;"></video>`;
        } else if (layer.type === 'qr') {
            const qrVal = layer.qrData || 'https://example.com';
            content = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=500x500&color=ffffff&bgcolor=00000000&data=${encodeURIComponent(qrVal)}" style="width:100%; height:100%; object-fit:contain;" />`;
        } else if (layer.type === 'rss') {
            const feedTitle = layer.rssUrl || 'Últimas Noticias: Deslizando información importante...';
            content = `
                <div style="width:100vw; background: rgba(0,0,0,0.8); color: #fff; padding: 15px 0; border-top: 2px solid var(--accent, #a78bfa); display: flex; align-items: center; text-shadow: 0 2px 5px rgba(0,0,0,0.5);">
                    <div style="background: var(--accent, #a78bfa); padding: 5px 20px; font-weight: bold; font-size: 3vw; margin-right: 20px; border-radius: 0 10px 10px 0;">ÚLTIMA HORA</div>
                    <marquee style="font-size: 2.5vw; flex: 1; font-family: sans-serif;" truespeed scrollamount="6">${feedTitle.replace(/"/g, '&quot;')}</marquee>
                </div>
            `;
        } else if (layer.type === 'widget' || layer.type === 'url') {
            content = `<iframe srcdoc="${layer.html?.replace(/"/g, '&quot;')}" style="width:100%; height:100%; border:none; overflow:hidden;"></iframe>`;
        }

        return `
                    <div id="layer-${layer.id}" style="position:absolute; left:${layer.x}%; top:${layer.y}%; transform:translate(-50%, -50%) scale(${layer.scale}); z-index:10; pointer-events:none;">
                        ${content}
                    </div>
                `;
    }).join('')}

            <script>
                // Background Switching Logic
                const bgs = ${JSON.stringify(slideBackgrounds.map(bg => bg.duration))};
                let current = 0;
                function nextBg() {
                    const currentEl = document.getElementById('bg-' + current);
                    if(currentEl) currentEl.style.opacity = 0;
                    current = (current + 1) % bgs.length;
                    const nextEl = document.getElementById('bg-' + current);
                    if(nextEl) nextEl.style.opacity = 1;
                    setTimeout(nextBg, bgs[current] * 1000);
                }
                if (bgs.length > 1) setTimeout(nextBg, bgs[0] * 1000);

                // Library for Updates
                function updateClocks() {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                    const dateStr = now.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'});
                    
                    document.querySelectorAll('[id^="clock-"]').forEach(el => {
                        const t = el.querySelector('.time');
                        const d = el.querySelector('.date');
                        if(t) t.innerText = timeStr;
                        if(d) d.innerText = dateStr;
                    });
                }
                setInterval(updateClocks, 1000);
                updateClocks();
            </script>
        </div>
    `;
}


interface MediaItem {
    id: string;
    name: string;
    type: 'image' | 'video' | 'url' | 'widget';
    duration_seconds: number;
    file_path: string | null;
    url: string | null;
    preview_url?: string;
    config?: any;
}

interface PlaylistItem {
    id?: string;
    media_id: string;
    position: number;
    duration_seconds: number;
    transition_type?: string;
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
    const [transitionClass, setTransitionClass] = useState('');

    // Sequence Drag & Drop
    const [draggedSeqIndex, setDraggedSeqIndex] = useState<number | null>(null);

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

            const itemsWithPreviews = await Promise.all(
                sortedItems.map(async (item: any) => {
                    const media = item.media;
                    if (media.type === 'url') return { ...item, media: { ...media, preview_url: media.url } };

                    if (media.type === 'widget' && media.config) {
                        try {
                            const configObj = typeof media.config === 'string' ? JSON.parse(media.config) : media.config;
                            if (configObj.backgrounds) {
                                const newBgs = await Promise.all(configObj.backgrounds.map(async (bg: any) => {
                                    const { data: bgItem } = await supabase.from('media').select('file_path').eq('id', bg.id).single();
                                    if (bgItem?.file_path) {
                                        const { data: signedData } = await supabase.storage.from('media').createSignedUrl(bgItem.file_path, 3600);
                                        return { ...bg, preview_url: signedData?.signedUrl || bg.preview_url };
                                    }
                                    return bg;
                                }));
                                return { ...item, media: { ...media, config: { ...configObj, backgrounds: newBgs } } };
                            }
                            return { ...item, media: { ...media, config: configObj } };
                        } catch (e) { }
                        return item;
                    }

                    if (!media.file_path) return item;

                    const { data: signedData } = await supabase.storage
                        .from('media')
                        .createSignedUrl(media.file_path, 3600);

                    return {
                        ...item,
                        media: { ...media, preview_url: signedData?.signedUrl }
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

                    if (item.type === 'widget' && item.config) {
                        try {
                            const configObj = typeof item.config === 'string' ? JSON.parse(item.config) : item.config;
                            if (configObj.backgrounds) {
                                const newBgs = await Promise.all(configObj.backgrounds.map(async (bg: any) => {
                                    const { data: bgItem } = await supabase.from('media').select('file_path').eq('id', bg.id).single();
                                    if (bgItem?.file_path) {
                                        const { data: signedData } = await supabase.storage.from('media').createSignedUrl(bgItem.file_path, 3600);
                                        return { ...bg, preview_url: signedData?.signedUrl || bg.preview_url };
                                    }
                                    return bg;
                                }));
                                return { ...item, config: { ...configObj, backgrounds: newBgs } };
                            }
                            return { ...item, config: configObj };
                        } catch (e) { }
                        return item;
                    }

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
            transition_type: 'none',
            media: media
        };
        setItems([...items, newItem]);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    // ----- Drag & Drop Logic -----
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedSeqIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Hide the original item physically being dragged by the browser
        setTimeout(() => {
            const el = document.getElementById(`seq-item-${index}`);
            if (el) el.style.opacity = '0.4';
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedSeqIndex === null || draggedSeqIndex === index) return;

        const newItems = [...items];
        const draggedItem = newItems[draggedSeqIndex];

        newItems.splice(draggedSeqIndex, 1);
        newItems.splice(index, 0, draggedItem);

        setItems(newItems);
        setDraggedSeqIndex(index);
    };

    const handleDragEnd = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDraggedSeqIndex(null);
        const el = document.getElementById(`seq-item-${index}`);
        if (el) el.style.opacity = '1';
    };
    // ----------------------------

    const updateTransition = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index].transition_type = value;
        setItems(newItems);
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
                    duration_seconds: item.duration_seconds,
                    transition_type: item.transition_type || 'none'
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

                    const nextIdx = (previewIndex + 1) % items.length;
                    const nextItem = items[nextIdx];

                    if (nextItem.transition_type === 'fade') {
                        setTransitionClass('transition-fade-enter');
                    } else if (nextItem.transition_type === 'slide') {
                        setTransitionClass('transition-slide-enter');
                    } else {
                        setTransitionClass('');
                    }

                    setTimeout(() => {
                        setPreviewIndex(nextIdx);
                    }, 50);

                    // Clear transition class after animation duration
                    if (nextItem.transition_type && nextItem.transition_type !== 'none') {
                        setTimeout(() => {
                            setTransitionClass('');
                        }, 800);
                    }
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', paddingBottom: '4px', fontSize: '0.85rem' }}>
                            <span
                                onClick={() => setCurrentFolderId(null)}
                                style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '2px 4px', borderRadius: '4px', background: 'transparent', color: !currentFolderId ? 'var(--text-primary)' : 'var(--text-muted)' }}
                            >
                                Raíz
                            </span>
                            {breadcrumbs.map((bc) => (
                                <div key={bc.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ChevronRight size={14} className="text-muted" />
                                    <span
                                        onClick={() => setCurrentFolderId(bc.id)}
                                        style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '2px 4px', borderRadius: '4px', background: 'transparent', color: currentFolderId === bc.id ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                    >
                                        {bc.name}
                                    </span>
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

                        {filteredLibrary.map((item) => {
                            const config = typeof item.config === 'string' ? JSON.parse(item.config || '{}') : (item.config || {});
                            return (
                                <div key={item.id} className={styles.libraryItem} onClick={() => addItem(item)}>
                                    <div className={styles.itemThumb} style={{ overflow: 'hidden' }}>
                                        {item.type === 'widget' ? (
                                            <iframe
                                                srcDoc={generateSlideHtml(config.backgrounds || [], config.layers || [], config.slideBgMode || 'cover')}
                                                style={{ width: '200%', height: '200%', border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none', background: '#000' }}
                                            />
                                        ) : item.preview_url ? (
                                            item.type === 'image' ? (
                                                <img src={item.preview_url} alt="" />
                                            ) : item.type === 'video' ? (
                                                <VideoIcon size={16} />
                                            ) : (
                                                <Globe size={16} />
                                            )
                                        ) : (
                                            <ImageIcon size={16} />
                                        )}
                                    </div>
                                    <div className={styles.itemInfo}>
                                        <h4>{item.name}</h4>
                                        <p>{item.type === 'widget' ? 'Diapositiva' : item.type} · {item.duration_seconds}s</p>
                                    </div>
                                    <Plus size={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />
                                </div>
                            )
                        })}

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
                            items.map((item, idx) => {
                                const config = typeof item.media.config === 'string' ? JSON.parse(item.media.config || '{}') : (item.media.config || {});
                                return (
                                    <div
                                        key={`${item.media.id}-${idx}`}
                                        id={`seq-item-${idx}`}
                                        className={`glass-card ${styles.seqItem} ${draggedSeqIndex === idx ? styles.isDragging : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDragEnd={(e) => handleDragEnd(e, idx)}
                                        style={{ cursor: 'grab', transition: 'all 0.2s ease', opacity: draggedSeqIndex === idx ? 0.4 : 1 }}
                                    >
                                        <div className={styles.seqHandle} style={{ cursor: 'grab' }}>
                                            <GripVertical size={18} />
                                        </div>
                                        <div className={styles.seqThumb} style={{ overflow: 'hidden' }}>
                                            {item.media.type === 'widget' ? (
                                                <iframe
                                                    srcDoc={generateSlideHtml(config.backgrounds || [], config.layers || [], config.slideBgMode || 'cover')}
                                                    style={{ width: '200%', height: '200%', border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none', background: '#000' }}
                                                />
                                            ) : item.media.preview_url && item.media.type === 'image' ? (
                                                <img src={item.media.preview_url} alt="" />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', height: '100%', width: '100%', justifyContent: 'center' }}>
                                                    {item.media.type === 'video' ? <VideoIcon size={14} /> : <Globe size={14} />}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.seqName}>
                                            <h4>{item.media.name}</h4>
                                        </div>
                                        <div className={styles.seqDuration}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Miliseg.</label>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <input
                                                            type="number"
                                                            className={`input ${styles.durationInput}`}
                                                            value={item.duration_seconds}
                                                            onChange={(e) => updateDuration(idx, parseInt(e.target.value) || 0)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="Duración"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Transición</label>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <select
                                                            className={`input ${styles.durationInput}`}
                                                            style={{ padding: '0 8px', width: '90px' }}
                                                            value={item.transition_type || 'none'}
                                                            onChange={(e) => updateTransition(idx, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="none">Corte</option>
                                                            <option value="fade">Fade</option>
                                                            <option value="slide">Deslizar</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                                {item.media.type === 'video' && (
                                                    <span className={styles.maxDuration}>Max: {item.media.duration_seconds}s</span>
                                                )}
                                            </div>
                                        </div>
                                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => removeItem(idx)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )
                            })
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
                            <div className={transitionClass} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
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
                                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                        <iframe
                                            src={items[previewIndex].media.url || ''}
                                            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                        />
                                        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
                                            <a
                                                href={items[previewIndex].media.url || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-sm"
                                                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', background: 'rgba(255,255,255,0.1)' }}
                                                title="Abrir en pestaña nueva si no carga"
                                            >
                                                <ExternalLink size={14} />
                                                Abrir enlace
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {items[previewIndex].media.type === 'widget' && (() => {
                                    const config = typeof items[previewIndex].media.config === 'string'
                                        ? JSON.parse(items[previewIndex].media.config || '{}')
                                        : (items[previewIndex].media.config || {});
                                    return (
                                        <iframe
                                            srcDoc={generateSlideHtml(config.backgrounds || [], config.layers || [], config.slideBgMode || 'cover')}
                                            style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                                        />
                                    );
                                })()}
                            </div>

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
