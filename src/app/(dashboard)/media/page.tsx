'use client';

import { useState, useEffect, useRef } from 'react';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Plus,
    Upload,
    Image as ImageIcon,
    Video,
    Globe,
    Trash2,
    Grid,
    List,
    Clock,
    Loader2,
    FolderOpen,
    Box,
} from 'lucide-react';
import styles from './media.module.css';

interface MediaRow {
    id: string;
    name: string;
    type: 'image' | 'video' | 'url';
    file_path: string | null;
    url: string | null;
    size_bytes: number;
    duration_seconds: number;
    created_at: string;
    preview_url?: string;
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function getMediaIcon(type: string) {
    switch (type) {
        case 'image': return ImageIcon;
        case 'video': return Video;
        case 'url': return Globe;
        default: return ImageIcon;
    }
}

function getMediaColor(type: string): string {
    switch (type) {
        case 'image': return '#a78bfa';
        case 'video': return '#60a5fa';
        case 'url': return '#34d399';
        default: return '#9ca3af';
    }
}

export default function MediaPage() {
    const [media, setMedia] = useState<MediaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [storageLimit, setStorageLimit] = useState(5120); // Default 5GB
    const [totalUsedBytes, setTotalUsedBytes] = useState(0);
    const [showUpload, setShowUpload] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filter, setFilter] = useState('all');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showWidgetModal, setShowWidgetModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
    const [previewItem, setPreviewItem] = useState<MediaRow | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [urlName, setUrlName] = useState('');
    const [urlValue, setUrlValue] = useState('');
    const [urlDuration, setUrlDuration] = useState(10);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const WIDGET_TEMPLATES = [
        {
            id: 'clock',
            name: 'Reloj Digital',
            icon: Clock,
            html: `
                <div id="widget" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:transparent; color:#fff; font-family:sans-serif;">
                    <div id="time" style="font-size:12vw; font-weight:bold; text-shadow:0 10px 20px rgba(0,0,0,0.5);">00:00</div>
                    <div id="date" style="font-size:4vw; opacity:0.8; margin-top:20px;">Lunes, 1 de Enero</div>
                </div>
                <script>
                    function update() {
                        const now = new Date();
                        document.getElementById('time').innerText = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                        document.getElementById('date').innerText = now.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'});
                    }
                    setInterval(update, 1000);
                    update();
                </script>
            `
        },
        {
            id: 'weather',
            name: 'Clima Actual',
            icon: Box,
            html: `
                <div id="widget" style="display:flex; align-items:center; justify-content:center; height:100vh; background:transparent; color:#fff; font-family:sans-serif; gap:40px;">
                    <div style="font-size:15vw;">☀️</div>
                    <div style="text-align:left;">
                        <div style="font-size:10vw; font-weight:bold;">24°C</div>
                        <div style="font-size:4vw; opacity:0.8;">Ciudad de México</div>
                    </div>
                </div>
            `
        }
    ];

    useEffect(() => {
        fetchMedia();
    }, [currentFolderId]);

    async function handleCreateWidget(template: typeof WIDGET_TEMPLATES[0]) {
        setUploading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return;

        const { error } = await supabase.from('media').insert({
            company_id: userData.company_id,
            name: template.name,
            type: 'widget',
            url: null,
            file_path: null,
            size_bytes: template.html.length,
            duration_seconds: 30, // Default duration for widgets
            config: { html: template.html },
            uploaded_by: user.id,
            folder_id: currentFolderId
        });

        if (!error) {
            setShowWidgetModal(false);
            fetchMedia();
        } else {
            console.error('Widget creation error:', error);
            alert(`Error al crear el widget: ${error.message}`);
        }
        setUploading(false);
    }

    async function handleCreateFolder() {
        if (!newFolderName) return;
        setUploading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return;

        const { error } = await supabase.from('media_folders').insert({
            company_id: userData.company_id,
            name: newFolderName,
            parent_id: currentFolderId
        });

        if (!error) {
            setNewFolderName('');
            setShowFolderModal(false);
            fetchMedia();
        } else {
            alert('Error al crear la carpeta: ' + error.message);
        }
        setUploading(false);
    }

    async function handleDeleteFolder(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (!confirm('¿Eliminar esta carpeta? Los archivos dentro de ella no se borrarán, pero aparecerán en la biblioteca principal.')) return;

        const { error } = await supabase.from('media_folders').delete().eq('id', id);
        if (!error) {
            fetchMedia();
        } else {
            alert('Error al eliminar la carpeta: ' + error.message);
        }
    }

    async function handleMoveToFolder(mediaId: string, folderId: string | null) {
        const { error } = await supabase
            .from('media')
            .update({ folder_id: folderId })
            .eq('id', mediaId);

        if (!error) {
            console.log('Successfully moved media:', mediaId, 'to folder:', folderId);
            // Fetch without full loading state to avoid UI flash
            fetchMedia(true);
        } else {
            console.error('Move error:', error);
            alert('Error al mover el archivo: ' + error.message);
        }
    }

    async function fetchMedia(silent = false) {
        if (!silent) setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) return;

        const companyId = userData.company_id;

        // Fetch media, folders and company limit in parallel
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

        const [mediaRes, foldersRes, companyRes, totalRes] = await Promise.all([
            mediaQuery,
            foldersQuery,
            supabase.from('companies').select('max_storage_mb, storage_limit_mb').eq('id', companyId).single(),
            supabase.from('media').select('size_bytes').eq('company_id', companyId)
        ]);

        const mediaData = mediaRes.data || [];
        const foldersData = foldersRes.data || [];
        const limit = companyRes.data?.storage_limit_mb || companyRes.data?.max_storage_mb || 5120;
        const totalMedia = totalRes.data || [];

        setStorageLimit(limit);
        setTotalUsedBytes(totalMedia.reduce((acc, m) => acc + (m.size_bytes || 0), 0));
        setFolders(foldersData);

        // Update breadcrumbs (recursive path)
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

        // Generate signed URLs for previews
        const itemsWithPreviews = await Promise.all(
            mediaData.map(async (item) => {
                if (item.type === 'url') return { ...item, preview_url: item.url };
                if (item.type === 'widget') return { ...item, preview_url: null }; // Widgets don't have file previews
                if (!item.file_path) return item;

                const { data: signedData } = await supabase.storage
                    .from('media')
                    .createSignedUrl(item.file_path, 3600); // 1 hour

                return { ...item, preview_url: signedData?.signedUrl };
            })
        );

        setMedia(itemsWithPreviews);
        setLoading(false);
    }

    async function getVideoDuration(file: File): Promise<number> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(Math.round(video.duration));
            };
            video.onerror = () => {
                resolve(0);
            };
            video.src = URL.createObjectURL(file);
        });
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        setUploadProgress(0);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!userData) return;

        const totalFiles = files.length;
        let completedFiles = 0;

        for (const file of Array.from(files)) {
            // Update progress: 0-10% for processing, 10-90% for upload, 90-100% for DB
            const baseProgress = (completedFiles / totalFiles) * 100;
            const stepWeight = 100 / totalFiles;

            setUploadProgress(baseProgress + (stepWeight * 0.1));

            // Sanitize file name
            const sanitizedName = file.name
                .replace(/[^\x00-\x7F]/g, '')
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9._-]/g, '');

            const filePath = `${userData.company_id}/${Date.now()}-${sanitizedName}`;

            // Get duration if it's a video
            let duration = 0;
            if (file.type.startsWith('video/')) {
                duration = await getVideoDuration(file);
            } else if (file.type.startsWith('image/')) {
                duration = 10; // Default placeholder for images
            }

            // Check file size (Supabase free tier default is 50MB)
            if (file.size > 50 * 1024 * 1024) {
                alert(`El archivo "${file.name}" supera el límite de 50MB permitido por la configuración de almacenamiento.`);
                completedFiles++;
                continue;
            }

            setUploadProgress(baseProgress + (stepWeight * 0.3));

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                if (uploadError.message.includes('maximum allowed size')) {
                    alert(`Error en "${file.name}": El archivo excede el tamaño máximo permitido en el bucket de Supabase (configurado normalmente en 50MB).`);
                } else {
                    alert(`Error al subir "${file.name}": ${uploadError.message}`);
                }
                completedFiles++;
                continue;
            }

            setUploadProgress(baseProgress + (stepWeight * 0.8));

            // Determine type
            const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'image';

            // Create media record
            await supabase.from('media').insert({
                company_id: userData.company_id,
                name: file.name,
                type,
                file_path: filePath,
                size_bytes: file.size,
                mime_type: file.type,
                duration_seconds: duration,
                uploaded_by: user.id,
                folder_id: currentFolderId,
            });

            completedFiles++;
            setUploadProgress((completedFiles / totalFiles) * 100);
        }

        setTimeout(() => {
            setUploading(false);
            setUploadProgress(0);
            setShowUpload(false);
            fetchMedia();
        }, 500);
    }

    async function handleUrlRegister() {
        if (!urlName || !urlValue) return;
        setUploading(true);

        const res = await fetch('/api/v1/admin/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: urlName,
                type: 'url',
                url: urlValue,
                duration_seconds: urlDuration,
            }),
        });

        if (res.ok) {
            setShowUpload(false);
            setUrlName('');
            setUrlValue('');
            setUrlDuration(10);
            fetchMedia();
        }
        setUploading(false);
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este archivo?')) return;
        const res = await fetch(`/api/v1/admin/media?id=${id}`, { method: 'DELETE' });
        if (res.ok) fetchMedia();
    }

    const filtered = filter === 'all' ? media : media.filter(m => m.type === filter);
    const isOverLimit = (totalUsedBytes / (1024 * 1024)) >= storageLimit;

    return (
        <>
            <Topbar title="Media" subtitle="Biblioteca de contenido multimedia" />

            <div className={styles.content}>
                <div className="page-header">
                    <div>
                        <h1>Biblioteca de Media</h1>
                        <p className={styles.headerSubtext}>
                            {media.length} archivos · {formatSize(totalUsedBytes)} de {storageLimit} MB usados
                        </p>
                    </div>
                    <div className="page-header-actions">
                        {isOverLimit && (
                            <span className="badge badge-error" style={{ fontSize: '0.7rem' }}>
                                Límite de almacenamiento alcanzado
                            </span>
                        )}
                        <div className={styles.viewToggle}>
                            <button
                                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewActive : ''}`}
                                onClick={() => setViewMode('grid')}
                            >
                                <Grid size={14} />
                            </button>
                            <button
                                className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewActive : ''}`}
                                onClick={() => setViewMode('list')}
                            >
                                <List size={14} />
                            </button>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowUpload(true)} disabled={isOverLimit} title={isOverLimit ? 'Límite alcanzado' : 'Subir archivos'}>
                            <Upload size={16} />
                            Subir Archivo
                        </button>
                        <button className="btn btn-secondary" onClick={() => setShowFolderModal(true)}>
                            <FolderOpen size={16} />
                            Nueva Carpeta
                        </button>
                        <button className="btn btn-secondary" onClick={() => setShowWidgetModal(true)} disabled={isOverLimit}>
                            <Box size={16} />
                            Crear Widget
                        </button>
                    </div>
                </div>

                {/* Breadcrumbs */}
                <div className={styles.breadcrumbs}>
                    <button
                        type="button"
                        className={`${styles.breadcrumbItem} ${!currentFolderId ? styles.breadcrumbActive : ''} ${draggingId ? styles.breadcrumbDropZone : ''}`}
                        onClick={() => setCurrentFolderId(null)}
                        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add(styles.dropHover); e.dataTransfer.dropEffect = 'move'; }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove(styles.dropHover); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.classList.remove(styles.dropHover);
                            const mediaId = e.dataTransfer.getData('mediaId') || draggingId;
                            if (mediaId) handleMoveToFolder(mediaId, null);
                        }}
                    >
                        Biblioteca
                    </button>
                    {breadcrumbs.map(bc => (
                        <div key={bc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ opacity: 0.4 }}>/</span>
                            <button
                                className={`${styles.breadcrumbItem} ${currentFolderId === bc.id ? styles.breadcrumbActive : ''} ${draggingId ? styles.breadcrumbDropZone : ''}`}
                                onClick={() => setCurrentFolderId(bc.id)}
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add(styles.dropHover); e.dataTransfer.dropEffect = 'move'; }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove(styles.dropHover); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.classList.remove(styles.dropHover);
                                    const mediaId = e.dataTransfer.getData('mediaId') || draggingId;
                                    if (mediaId) handleMoveToFolder(mediaId, bc.id);
                                }}
                            >
                                {bc.name}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className={styles.filters}>
                    {['all', 'image', 'video', 'url', 'widget'].map((f) => (
                        <button
                            key={f}
                            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'Todos' : f === 'image' ? 'Imágenes' : f === 'video' ? 'Videos' : f === 'url' ? 'URLs' : 'Widgets'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={20} className="loading-spinner" />
                        <span>Cargando media...</span>
                    </div>
                ) : (filtered.length === 0 && folders.length === 0) ? (
                    <div className="empty-state">
                        <FolderOpen size={48} />
                        <h3>Sin contenido</h3>
                        <p>Sube imágenes, videos o registra URLs para comenzar.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="media-grid">
                        {/* Folders in Grid */}
                        {folders.map(folder => (
                            <div
                                key={folder.id}
                                onClick={(e) => {
                                    // Only navigate if we're not currently dropping something
                                    if (!draggingId) setCurrentFolderId(folder.id);
                                }}
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.classList.add(styles.dropHover);
                                    e.dataTransfer.dropEffect = 'move';
                                }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove(styles.dropHover); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.classList.remove(styles.dropHover);
                                    const mediaId = e.dataTransfer.getData('mediaId') || draggingId;
                                    if (mediaId) handleMoveToFolder(mediaId, folder.id);
                                }}
                            >
                                <div className={styles.mediaPreview}>
                                    <FolderOpen size={48} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div className={styles.mediaInfo}>
                                    <p className={styles.mediaName}>{folder.name}</p>
                                    <div className={styles.mediaMeta}>
                                        <span>Carpeta</span>
                                    </div>
                                </div>
                                <div className={styles.mediaActions}>
                                    <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => handleDeleteFolder(e, folder.id)}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {filtered.map((item) => {
                            const Icon = getMediaIcon(item.type);
                            return (
                                <div
                                    key={item.id}
                                    className={`glass-card ${styles.mediaCard}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('mediaId', item.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                        setDraggingId(item.id);
                                    }}
                                    onDragEnd={(e) => {
                                        e.preventDefault();
                                        setDraggingId(null);
                                    }}
                                    onClick={() => setPreviewItem(item)}
                                >
                                    <div className={styles.mediaPreview} style={{ borderColor: getMediaColor(item.type) + '33' }}>
                                        {item.preview_url ? (
                                            item.type === 'image' ? (
                                                <img src={item.preview_url} alt={item.name} className={styles.previewImage} />
                                            ) : item.type === 'video' ? (
                                                <video src={item.preview_url} className={styles.previewVideo} />
                                            ) : (
                                                <Icon size={32} style={{ color: getMediaColor(item.type) }} />
                                            )
                                        ) : (
                                            <Icon size={32} style={{ color: getMediaColor(item.type) }} />
                                        )}
                                    </div>
                                    <div className={styles.mediaInfo}>
                                        <p className={styles.mediaName}>{item.name}</p>
                                        <div className={styles.mediaMeta}>
                                            <span className="badge badge-media">{item.type}</span>
                                            <span>{formatSize(item.size_bytes)}</span>
                                            <span><Clock size={10} /> {item.duration_seconds}s</span>
                                        </div>
                                    </div>
                                    <div className={styles.mediaActions}>
                                        <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Tipo</th>
                                    <th>Nombre</th>
                                    <th>Tamaño</th>
                                    <th>Duración</th>
                                    <th>Fecha</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Folders in Table */}
                                {folders.map(folder => (
                                    <tr
                                        key={folder.id}
                                        className={draggingId ? styles.breadcrumbDropZone : ''}
                                        onClick={() => { if (!draggingId) setCurrentFolderId(folder.id); }}
                                        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.add(styles.dropHover);
                                            e.dataTransfer.dropEffect = 'move';
                                        }}
                                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove(styles.dropHover); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.remove(styles.dropHover);
                                            const mediaId = e.dataTransfer.getData('mediaId') || draggingId;
                                            if (mediaId) handleMoveToFolder(mediaId, folder.id);
                                        }}
                                        style={{ cursor: 'pointer', background: 'rgba(var(--accent-rgb), 0.05)' }}
                                    >
                                        <td><FolderOpen size={16} style={{ color: 'var(--accent)' }} /></td>
                                        <td><span className={styles.mediaNameList}>{folder.name}</span></td>
                                        <td><span className={styles.metaText}>--</span></td>
                                        <td><span className={styles.metaText}>--</span></td>
                                        <td><span className={styles.metaText}>Carpeta</span></td>
                                        <td>
                                            <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => handleDeleteFolder(e, folder.id)}>
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {filtered.map((item) => {
                                    const Icon = getMediaIcon(item.type);
                                    return (
                                        <tr
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('mediaId', item.id);
                                                e.dataTransfer.effectAllowed = 'move';
                                                setDraggingId(item.id);
                                            }}
                                            onDragEnd={(e) => {
                                                e.preventDefault();
                                                setDraggingId(null);
                                            }}
                                            onClick={() => setPreviewItem(item)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td><Icon size={16} style={{ color: getMediaColor(item.type) }} /></td>
                                            <td><span className={styles.mediaNameList}>{item.name}</span></td>
                                            <td><span className={styles.metaText}>{formatSize(item.size_bytes)}</span></td>
                                            <td><span className={styles.metaText}>{item.duration_seconds}s</span></td>
                                            <td>
                                                <span className={styles.metaText}>
                                                    {new Date(item.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUpload && (
                <div className="modal-overlay" onClick={() => setShowUpload(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Subir Archivo</h2>
                            <button className="modal-close" onClick={() => setShowUpload(false)}>✕</button>
                        </div>

                        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                            <Upload size={32} />
                            <p>
                                {uploading ? 'Procesando archivos...' : <>Arrastra archivos aquí o <span>selecciona</span></>}
                            </p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                JPG, PNG, MP4, WEBM · Máx. 50MB (Recomendado)
                            </p>

                            {uploading && (
                                <div className={styles.progressContainer}>
                                    <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
                                    <span className={styles.progressText}>{Math.round(uploadProgress)}%</span>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                style={{ display: 'none' }}
                                multiple
                                onChange={handleFileUpload}
                            />
                        </div>

                        <div className={styles.divider}></div>

                        <div className="form-group">
                            <label className="label">O registrar URL externa</label>
                            <input className="input" placeholder="Nombre del recurso" value={urlName} onChange={(e) => setUrlName(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <input className="input" placeholder="https://ejemplo.com/contenido" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label className="label">Duración (segundos)</label>
                            <input className="input" type="number" value={urlDuration} min={1} onChange={(e) => setUrlDuration(Number(e.target.value))} />
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>
                                Cancelar
                            </button>
                            {urlValue && (
                                <button className="btn btn-primary" onClick={handleUrlRegister} disabled={uploading}>
                                    <Globe size={16} />
                                    Registrar URL
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Widget Selection Modal */}
            {showWidgetModal && (
                <div className="modal-overlay" onClick={() => setShowWidgetModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Crear Widget Dinámico</h2>
                            <button className="modal-close" onClick={() => setShowWidgetModal(false)}>✕</button>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            Selecciona una plantilla para crear un widget interactivo que se mostrará en tus pantallas.
                        </p>

                        <div className={styles.widgetGrid}>
                            {WIDGET_TEMPLATES.map(template => (
                                <button
                                    key={template.id}
                                    className={styles.widgetTemplateBtn}
                                    onClick={() => handleCreateWidget(template)}
                                    disabled={uploading}
                                >
                                    <div className={styles.templateIcon}>
                                        <template.icon size={24} />
                                    </div>
                                    <div className={styles.templateInfo}>
                                        <h3>{template.name}</h3>
                                        <p>Contenido HTML dinámico</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowWidgetModal(false)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* New Folder Modal */}
            {showFolderModal && (
                <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nueva Carpeta</h2>
                            <button className="modal-close" onClick={() => setShowFolderModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="label">Nombre de la carpeta</label>
                            <input
                                className="input"
                                placeholder="ej. Promo Invierno"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!newFolderName || uploading}>
                                Crear Carpeta
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Media Preview Modal */}
            {previewItem && (
                <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
                    <div className="modal-content" style={{ maxWidth: '80vw', width: 'auto', padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{previewItem.name}</h2>
                            <button className="modal-close" onClick={() => setPreviewItem(null)}>✕</button>
                        </div>

                        <div className={styles.previewContainerFull}>
                            {previewItem.type === 'image' && (
                                <img src={previewItem.preview_url} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-md)' }} />
                            )}
                            {previewItem.type === 'video' && (
                                <video src={previewItem.preview_url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-md)' }} />
                            )}
                            {previewItem.type === 'url' && (
                                <div style={{ background: 'var(--bg-tertiary)', padding: '40px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <Globe size={48} style={{ color: 'var(--accent)', marginBottom: '16px' }} />
                                    <h3>Recurso Externo</h3>
                                    <p style={{ marginBottom: '20px' }}>{previewItem.url || previewItem.url}</p>
                                    <a href={previewItem.url || ''} target="_blank" className="btn btn-primary">Abrir en nueva pestaña</a>
                                </div>
                            )}
                            {(previewItem.type as string) === 'widget' && (
                                <div style={{ width: '100%', height: '60vh', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <iframe
                                        srcDoc={(previewItem as any).config?.html}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className={styles.mediaMeta} style={{ marginTop: '16px', justifyContent: 'center' }}>
                            <span className="badge badge-media">{previewItem.type}</span>
                            <span>{formatSize(previewItem.size_bytes)}</span>
                            <span>{previewItem.duration_seconds}s</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
