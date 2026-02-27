'use client';

import { useState, useEffect, useRef } from 'react';
import Topbar from '@/components/ui/Topbar';
import { createClient } from '@/lib/supabase/client';
import {
    Check,
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
    ExternalLink,
    ChevronRight,
    Maximize2,
    Move,
    ZoomIn,
    Timer,
    Layout,
    Monitor,
    Pencil,
} from 'lucide-react';
import styles from './media.module.css';

interface SceneLayer {
    id: string;
    type: 'image' | 'video' | 'url' | 'widget' | 'clock' | 'weather';
    name: string;
    url?: string;
    html?: string;
    x: number;
    y: number;
    scale: number;
    active: boolean;
}

interface MediaRow {
    id: string;
    name: string;
    type: 'image' | 'video' | 'url' | 'widget';
    file_path: string | null;
    url: string | null;
    size_bytes: number;
    duration_seconds: number;
    created_at: string;
    folder_id: string | null;
    config?: {
        html?: string;
        backgrounds?: { id: string, preview_url: string, duration: number }[];
        layers?: SceneLayer[];
        slideBgMode?: 'cover' | 'contain';
    };
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
    const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteType, setDeleteType] = useState<'single' | 'bulk'>('single');
    const [itemToDelete, setItemToDelete] = useState<MediaRow | null>(null);
    const [deleteFinished, setDeleteFinished] = useState(false);
    const [editingSlideId, setEditingSlideId] = useState<string | null>(null);

    // Scene Composer State (Dynamic Layers)
    const [showSlideComposer, setShowSlideComposer] = useState(false);
    const [slideBackgrounds, setSlideBackgrounds] = useState<{ id: string, preview_url: string, duration: number }[]>([]);
    const [activeBgIndex, setActiveBgIndex] = useState(0);
    const [sceneLayers, setSceneLayers] = useState<SceneLayer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [composerFolderId, setComposerFolderId] = useState<string | null>(null);
    const [composerPath, setComposerPath] = useState<{ id: string, name: string }[]>([]);
    const [composerMedia, setComposerMedia] = useState<MediaRow[]>([]);
    const [composerFolders, setComposerFolders] = useState<any[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [slideBgMode, setSlideBgMode] = useState<'cover' | 'contain'>('cover');
    const [slideName, setSlideName] = useState('Nueva Diapositiva');
    const [previewTime, setPreviewTime] = useState(0); // For slideshow preview

    // Ensure activeBgIndex is always valid
    useEffect(() => {
        if (slideBackgrounds.length === 0) {
            setActiveBgIndex(0);
        } else if (activeBgIndex >= slideBackgrounds.length) {
            setActiveBgIndex(Math.max(0, slideBackgrounds.length - 1));
        }
    }, [slideBackgrounds, activeBgIndex]);

    // Slideshow Preview logic for the composer
    useEffect(() => {
        if (!showSlideComposer || slideBackgrounds.length <= 1) return;

        const currentBg = slideBackgrounds[activeBgIndex];
        if (!currentBg) {
            setActiveBgIndex(0);
            return;
        }

        const timer = setTimeout(() => {
            setActiveBgIndex((prev) => (prev + 1) % slideBackgrounds.length);
        }, currentBg.duration * 1000);

        return () => clearTimeout(timer);
    }, [showSlideComposer, activeBgIndex, slideBackgrounds]);

    async function fetchComposerMedia(fid: string | null) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return;

        const companyId = userData.company_id;

        const mQuery = supabase.from('media').select('*').eq('company_id', companyId).order('name', { ascending: true });
        if (fid) mQuery.eq('folder_id', fid); else mQuery.is('folder_id', null);

        const fQuery = supabase.from('media_folders').select('*').eq('company_id', companyId).order('name', { ascending: true });
        if (fid) fQuery.eq('parent_id', fid); else fQuery.is('parent_id', null);

        const [mRes, fRes] = await Promise.all([mQuery, fQuery]);
        const mData = mRes.data || [];

        // Generate signed URLs
        const itemsWithPreviews = await Promise.all(
            mData.map(async (item) => {
                if (item.type === 'url') return { ...item, preview_url: item.url };
                if (item.type === 'widget') return { ...item, preview_url: null };
                if (!item.file_path) return item;

                const { data: signedData } = await supabase.storage
                    .from('media')
                    .createSignedUrl(item.file_path, 3600);

                return { ...item, preview_url: signedData?.signedUrl };
            })
        );

        setComposerMedia(itemsWithPreviews);
        setComposerFolders(fRes.data || []);
    }

    useEffect(() => {
        if (showSlideComposer) {
            fetchComposerMedia(composerFolderId);
            refreshSlideBackgrounds();
        }
    }, [showSlideComposer, composerFolderId]);

    async function refreshSlideBackgrounds() {
        if (slideBackgrounds.length === 0) return;

        const updatedBackgrounds = await Promise.all(
            slideBackgrounds.map(async (bg) => {
                const { data: m } = await supabase.from('media').select('file_path, type, url').eq('id', bg.id).single();
                if (!m) return bg;

                let newUrl = bg.preview_url;
                if (m.type === 'url') {
                    newUrl = m.url || '';
                } else if (m.file_path) {
                    const { data: signedData } = await supabase.storage.from('media').createSignedUrl(m.file_path, 3600);
                    newUrl = signedData?.signedUrl || '';
                }

                return { ...bg, preview_url: newUrl };
            })
        );
        setSlideBackgrounds(updatedBackgrounds);
    }

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

    async function handleSaveSlide() {
        if (slideBackgrounds.length === 0) {
            alert('Por favor selecciona al menos una imagen de fondo');
            return;
        }

        setUploading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase.from('users').select('company_id').eq('id', user.id).single();
        if (!userData) return;

        // Generate slideshow HTML + positioned layers
        const html = generateSlideHtml(slideBackgrounds, sceneLayers, slideBgMode);

        // Calculate total duration
        const totalDuration = slideBackgrounds.reduce((sum, bg) => sum + (bg.duration || 10), 0);

        const slideData = {
            company_id: userData.company_id,
            name: slideName,
            type: 'widget' as const,
            url: null,
            file_path: null,
            size_bytes: html.length,
            duration_seconds: totalDuration,
            config: {
                html,
                backgrounds: slideBackgrounds,
                layers: sceneLayers,
                slideBgMode
            },
            uploaded_by: user.id,
            folder_id: currentFolderId
        };

        let error;
        if (editingSlideId) {
            const { error: updateError } = await supabase
                .from('media')
                .update(slideData)
                .eq('id', editingSlideId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('media')
                .insert(slideData);
            error = insertError;
        }

        if (!error) {
            setShowSlideComposer(false);
            setSlideBackgrounds([]);
            setSceneLayers([]);
            setActiveLayerId(null);
            setSlideName('Nueva Escena');
            setEditingSlideId(null); // Reset editing mode
            fetchMedia();
        } else {
            console.error('Slide saving error:', error);
            alert('Error al guardar la diapositiva: ' + error.message);
        }
        setUploading(false);
    }

    function handleEditSlide(item: MediaRow) {
        if (!item.config) return;

        setEditingSlideId(item.id);
        setSlideName(item.name || 'Sin nombre');
        setSlideBackgrounds(item.config.backgrounds || []);
        setSceneLayers(item.config.layers || []);
        setSlideBgMode(item.config.slideBgMode || 'cover');

        // Ensure folder context matches the slide's location or current folder
        // composerFolderId is used for selecting new backgrounds, so keeping current folder is usually fine

        setShowSlideComposer(true);
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

                // For widgets (Slides), refresh all background preview URLs and use the first as the main preview
                if (item.type === 'widget') {
                    const backgrounds = item.config?.backgrounds || [];
                    const updatedBackgrounds = await Promise.all(backgrounds.map(async (bg: any) => {
                        const { data: bgItem } = await supabase.from('media').select('file_path').eq('id', bg.id).single();
                        if (bgItem?.file_path) {
                            const { data: signedData } = await supabase.storage.from('media').createSignedUrl(bgItem.file_path, 3600);
                            return { ...bg, preview_url: signedData?.signedUrl || bg.preview_url };
                        }
                        return bg;
                    }));

                    const mainPreviewUrl = updatedBackgrounds.length > 0 ? updatedBackgrounds[0].preview_url : null;

                    return {
                        ...item,
                        preview_url: mainPreviewUrl,
                        config: {
                            ...item.config,
                            backgrounds: updatedBackgrounds
                        }
                    };
                }

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

    function triggerDelete(item: MediaRow) {
        setItemToDelete(item);
        setDeleteType('single');
        setShowDeleteModal(true);
        setDeleteFinished(false);
    }

    function triggerBulkDelete() {
        setDeleteType('bulk');
        setShowDeleteModal(true);
        setDeleteFinished(false);
    }

    async function confirmDelete() {
        setIsDeleting(true);
        if (deleteType === 'single' && itemToDelete) {
            const res = await fetch(`/api/v1/admin/media?id=${itemToDelete.id}`, { method: 'DELETE' });
            if (res.ok) {
                setDeleteFinished(true);
                fetchMedia();
            }
        } else if (deleteType === 'bulk') {
            const deletePromises = selectedMediaIds.map(id =>
                fetch(`/api/v1/admin/media?id=${id}`, { method: 'DELETE' })
            );
            await Promise.all(deletePromises);
            setDeleteFinished(true);
            setSelectedMediaIds([]);
            fetchMedia();
        }
        setIsDeleting(false);
    }

    function toggleSelect(id: string) {
        setSelectedMediaIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
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
                        <button className="btn btn-secondary" onClick={() => setShowSlideComposer(true)} disabled={isOverLimit}>
                            <ImageIcon size={16} />
                            Diseñar Diapositiva
                        </button>
                        {selectedMediaIds.length > 0 && (
                            <button className="btn btn-danger" onClick={triggerBulkDelete}>
                                <Trash2 size={16} />
                                Eliminar ({selectedMediaIds.length})
                            </button>
                        )}
                    </div>
                </div>

                {selectedMediaIds.length > 0 && (
                    <div className="glass-card" style={{
                        margin: '0 0 20px 0',
                        padding: '12px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(var(--accent-rgb), 0.1)',
                        border: '1px solid var(--accent)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{selectedMediaIds.length} elementos seleccionados</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedMediaIds([])}>Desseleccionar todo</button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-danger btn-sm" onClick={triggerBulkDelete}>Eliminar selección</button>
                        </div>
                    </div>
                )}
                <div className={styles.mediaActionsHeader} style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div className={styles.breadcrumbs} style={{ flex: 1 }}>
                        <button
                            type="button"
                            className={`${styles.breadcrumbItem} ${!currentFolderId ? styles.breadcrumbActive : ''} ${draggingId ? styles.breadcrumbDropZone : ''}`}
                            onClick={() => setCurrentFolderId(null)}
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add(styles.dropHover); e.dataTransfer.dropEffect = 'move'; }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove(styles.dropHover); e.dataTransfer.dropEffect = 'move'; }}
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
                        {folders.map(folder => (
                            <div
                                key={folder.id}
                                className={`glass-card ${styles.mediaCard}`}
                                onClick={(e) => {
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
                                    className={`glass-card ${styles.mediaCard} ${selectedMediaIds.includes(item.id) ? styles.mediaCardSelected : ''}`}
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
                                    onClick={(e) => {
                                        if (e.ctrlKey || e.metaKey) {
                                            toggleSelect(item.id);
                                        } else {
                                            setPreviewItem(item);
                                        }
                                    }}
                                    style={{ position: 'relative' }}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '12px',
                                            right: '12px',
                                            zIndex: 5,
                                            background: selectedMediaIds.includes(item.id) ? 'var(--accent)' : 'rgba(0,0,0,0.4)',
                                            borderRadius: '6px',
                                            width: '24px',
                                            height: '24px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px solid ' + (selectedMediaIds.includes(item.id) ? 'var(--accent)' : 'rgba(255,255,255,0.4)'),
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                                        }}
                                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                                    >
                                        {selectedMediaIds.includes(item.id) && <Check size={16} color="#fff" strokeWidth={3} />}
                                    </div>
                                    <div className={styles.mediaPreview} style={{ borderColor: getMediaColor(item.type) + '33' }}>
                                        {item.preview_url ? (
                                            (item.type === 'image' || item.type === 'widget') ? (
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
                                        {item.type === 'widget' && item.config && (
                                            <button className="btn btn-secondary btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); handleEditSlide(item); }} title="Editar Diapositiva" style={{ marginRight: '8px' }}>
                                                <Pencil size={12} />
                                            </button>
                                        )}
                                        <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); triggerDelete(item); }}>
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
                                    <th style={{ width: '40px' }}></th>
                                    <th style={{ width: '40px' }}>Tipo</th>
                                    <th>Nombre</th>
                                    <th>Tamaño</th>
                                    <th>Duración</th>
                                    <th>Fecha</th>
                                    <th style={{ width: '60px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
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
                                        <td></td>
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
                                            onClick={(e) => {
                                                if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') return;
                                                setPreviewItem(item);
                                            }}
                                            style={{ cursor: 'pointer', background: selectedMediaIds.includes(item.id) ? 'rgba(var(--accent-rgb), 0.1)' : undefined }}
                                        >
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMediaIds.includes(item.id)}
                                                    onChange={() => toggleSelect(item.id)}
                                                />
                                            </td>
                                            <td>
                                                {item.preview_url && (item.type === 'image' || item.type === 'widget') ? (
                                                    <img src={item.preview_url} alt={item.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                                                ) : item.preview_url && item.type === 'video' ? (
                                                    <video src={item.preview_url} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                                                ) : (
                                                    <Icon size={16} style={{ color: getMediaColor(item.type) }} />
                                                )}
                                            </td>
                                            <td><span className={styles.mediaNameList}>{item.name}</span></td>
                                            <td><span className={styles.metaText}>{formatSize(item.size_bytes)}</span></td>
                                            <td><span className={styles.metaText}>{item.duration_seconds}s</span></td>
                                            <td>
                                                <span className={styles.metaText}>
                                                    {new Date(item.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className={styles.mediaActions}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    {item.type === 'widget' && item.config && (
                                                        <button className="btn btn-secondary btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); handleEditSlide(item); }} title="Editar">
                                                            <Pencil size={12} />
                                                        </button>
                                                    )}
                                                    <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); triggerDelete(item); }}>
                                                        <Trash2 size={12} />
                                                    </button>
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

            {/* Upload Modal */}
            {
                showUpload && (
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
                )
            }

            {/* Widget Selection Modal */}
            {
                showWidgetModal && (
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
                )
            }
            {/* New Folder Modal */}
            {
                showFolderModal && (
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
                )
            }
            {/* Media Preview Modal */}
            {
                previewItem && (
                    <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
                        <div className="modal-content" style={{ width: '85vw', maxWidth: '1100px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-body)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{previewItem.name}</h2>
                                    {previewItem.type === 'url' && (
                                        <a href={previewItem.url || ''} target="_blank" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem', height: 'auto', borderRadius: '20px' }}>
                                            Abrir en nueva pestaña <ExternalLink size={14} style={{ marginLeft: '6px' }} />
                                        </a>
                                    )}
                                </div>
                                <button className="modal-close" onClick={() => setPreviewItem(null)}>✕</button>
                            </div>

                            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {previewItem.type === 'image' && (
                                    <img src={previewItem.preview_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                )}
                                {previewItem.type === 'video' && (
                                    <video src={previewItem.preview_url} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain', outline: 'none' }} />
                                )}
                                {previewItem.type === 'url' && (
                                    <iframe
                                        src={previewItem.url || ''}
                                        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                    />
                                )}
                                {(previewItem.type as string) === 'widget' && previewItem.config && (
                                    <iframe
                                        srcDoc={generateSlideHtml(previewItem.config.backgrounds || [], previewItem.config.layers || [], previewItem.config.slideBgMode || 'cover')}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                    />
                                )}
                            </div>

                            <div className={styles.mediaMeta} style={{ padding: '12px 24px', display: 'flex', justifyContent: 'center', gap: '20px', background: 'var(--bg-body)', margin: 0, borderTop: '1px solid var(--glass-border)' }}>
                                <span className="badge badge-media">{previewItem.type}</span>
                                <span>{formatSize(previewItem.size_bytes)}</span>
                                <span>{previewItem.duration_seconds}s</span>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Super Slide Composer Modal */}
            {
                showSlideComposer && (
                    <div className="modal-overlay" onClick={() => { setShowSlideComposer(false); setComposerFolderId(null); setComposerPath([]); }}>
                        <div className="modal-content" style={{ maxWidth: '1200px', width: '95vw', padding: '0', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.composerLayout}>
                                {/* Left: Settings */}
                                <div className={styles.composerSidebar}>
                                    <div className="modal-header" style={{ padding: '20px' }}>
                                        <h2>Diapositivas</h2>
                                    </div>
                                    <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div className="form-group">
                                            <label className="label">Nombre de la Diapositiva</label>
                                            <input
                                                className="input"
                                                value={slideName}
                                                onChange={(e) => setSlideName(e.target.value)}
                                                placeholder="Ej: Secuencia Promo + Reloj"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="label" style={{ marginBottom: '8px' }}>1. Biblioteca</label>
                                            <div style={{ display: 'flex', gap: '4px', fontSize: '0.65rem', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        padding: '2px 10px',
                                                        background: composerFolderId === null ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '4px',
                                                        color: composerFolderId === null ? '#fff' : 'var(--text-muted)'
                                                    }}
                                                    onClick={() => { setComposerFolderId(null); setComposerPath([]); }}
                                                > Raíz </button>
                                                {composerPath.map((p, i) => (
                                                    <button
                                                        key={p.id}
                                                        className="btn btn-sm"
                                                        style={{
                                                            padding: '2px 10px',
                                                            background: composerFolderId === p.id ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                                            border: '1px solid var(--glass-border)',
                                                            borderRadius: '4px',
                                                            color: composerFolderId === p.id ? '#fff' : 'var(--text-muted)'
                                                        }}
                                                        onClick={() => {
                                                            const newPath = composerPath.slice(0, i + 1);
                                                            setComposerPath(newPath);
                                                            setComposerFolderId(p.id);
                                                        }}
                                                    > / {p.name} </button>
                                                ))}
                                            </div>
                                            <div className={styles.bgSelector} style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                {/* Composer Folders */}
                                                {composerFolders.map(folder => (
                                                    <div
                                                        key={folder.id}
                                                        className={styles.bgOption}
                                                        style={{
                                                            background: 'rgba(139, 70, 255, 0.05)',
                                                            border: '1px solid rgba(139, 70, 255, 0.2)',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            borderRadius: '8px',
                                                            transition: 'all 0.2s ease',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => {
                                                            setComposerFolderId(folder.id);
                                                            setComposerPath([...composerPath, { id: folder.id, name: folder.name }]);
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(139, 70, 255, 0.15)';
                                                            e.currentTarget.style.borderColor = 'var(--accent)';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'rgba(139, 70, 255, 0.05)';
                                                            e.currentTarget.style.borderColor = 'rgba(139, 70, 255, 0.2)';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                        }}
                                                    >
                                                        <FolderOpen size={24} style={{ color: 'var(--accent)' }} />
                                                        <span style={{ fontSize: '0.6rem', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', fontWeight: 600 }}>{folder.name}</span>
                                                    </div>
                                                ))}
                                                {/* Composer Media */}
                                                {composerMedia.filter(m => m.type !== 'widget').map(m => (
                                                    <div
                                                        key={m.id}
                                                        className={`${styles.bgOption} ${slideBackgrounds.some(bg => bg.id === m.id) ? styles.bgSelected : ''}`}
                                                        onClick={() => {
                                                            if (slideBackgrounds.some(bg => bg.id === m.id)) {
                                                                setSlideBackgrounds(prev => prev.filter(bg => bg.id !== m.id));
                                                            } else {
                                                                setSlideBackgrounds(prev => [...prev, { id: m.id, preview_url: m.preview_url || '', duration: 5 }]);
                                                            }
                                                        }}
                                                    >
                                                        {m.type === 'video' ? (
                                                            <video src={m.preview_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                                                        ) : (
                                                            <img src={m.preview_url} alt="" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {slideBackgrounds.length > 0 && (
                                            <div className="form-group">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <label className="label" style={{ marginBottom: 0 }}>Orden y Duración</label>
                                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Arrastra para reordenar</span>
                                                </div>
                                                <div
                                                    style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', padding: '4px' }}
                                                    onDragOver={(e) => e.preventDefault()}
                                                >
                                                    {slideBackgrounds.map((bg, idx) => (
                                                        <div
                                                            key={bg.id + idx}
                                                            draggable
                                                            onDragStart={() => setDraggedIndex(idx)}
                                                            onDragOver={(e) => e.preventDefault()}
                                                            onDrop={() => {
                                                                if (draggedIndex === null || draggedIndex === idx) return;
                                                                const newArr = [...slideBackgrounds];
                                                                const item = newArr.splice(draggedIndex, 1)[0];
                                                                newArr.splice(idx, 0, item);
                                                                setSlideBackgrounds(newArr);
                                                                setDraggedIndex(null);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                background: 'var(--bg-tertiary)',
                                                                padding: '8px',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--glass-border)',
                                                                cursor: 'grab',
                                                                opacity: draggedIndex === idx ? 0.5 : 1
                                                            }}
                                                        >
                                                            <div style={{ color: 'var(--text-muted)' }}><Move size={14} /></div>
                                                            <img src={bg.preview_url || undefined} style={{ width: '40px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                                                            <span style={{ fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {media.find(m => m.id === bg.id)?.name || 'Multimedia'}
                                                            </span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Timer size={12} className="text-muted" />
                                                                    <input
                                                                        type="number"
                                                                        className="input"
                                                                        style={{ width: '45px', padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center' }}
                                                                        value={bg.duration}
                                                                        onChange={(e) => {
                                                                            const val = parseInt(e.target.value) || 1;
                                                                            setSlideBackgrounds(prev => prev.map((item, i) => i === idx ? { ...item, duration: val } : item));
                                                                        }}
                                                                    />
                                                                </div>
                                                                <button
                                                                    className="btn btn-icon btn-sm text-error"
                                                                    style={{ padding: '4px' }}
                                                                    onClick={() => setSlideBackgrounds(prev => prev.filter((_, i) => i !== idx))}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="form-group">
                                            <label className="label">Ajuste de Fondo</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button className={`btn btn-sm ${slideBgMode === 'cover' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSlideBgMode('cover')}>Cubrir</button>
                                                <button className={`btn btn-sm ${slideBgMode === 'contain' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSlideBgMode('contain')}>Ajustar</button>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <label className="label" style={{ marginBottom: 0 }}>2. Capas de la Escena</label>
                                                <div style={{ position: 'relative' }}>
                                                    <button className="btn btn-sm btn-primary" onClick={() => setActiveLayerId('add-menu')}>
                                                        <Plus size={14} /> Añadir Capa
                                                    </button>
                                                    {activeLayerId === 'add-menu' && (
                                                        <div className="glass-card" style={{
                                                            position: 'absolute',
                                                            top: '100%',
                                                            right: 0,
                                                            zIndex: 100,
                                                            width: '200px',
                                                            padding: '8px',
                                                            marginTop: '5px',
                                                            boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
                                                            background: '#1a1a2e', // More solid dark background
                                                            border: '1px solid var(--accent)', // Accent border to make it pop
                                                            backdropFilter: 'blur(20px)'
                                                        }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <button className={styles.addLayerBtn} onClick={() => {
                                                                    const newLayer: SceneLayer = { id: Math.random().toString(36).substr(2, 9), type: 'clock', name: 'Reloj Digital', x: 50, y: 50, scale: 1, active: true };
                                                                    setSceneLayers(prev => [...prev, newLayer]);
                                                                    setActiveLayerId(newLayer.id);
                                                                }}><Clock size={14} /> Reloj Digital</button>
                                                                <button className={styles.addLayerBtn} onClick={() => {
                                                                    const newLayer: SceneLayer = { id: Math.random().toString(36).substr(2, 9), type: 'weather', name: 'Clima Actual', x: 50, y: 50, scale: 1, active: true };
                                                                    setSceneLayers(prev => [...prev, newLayer]);
                                                                    setActiveLayerId(newLayer.id);
                                                                }}><Box size={14} /> Clima Actual</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={styles.layerStack}>
                                                {sceneLayers.length === 0 ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', border: '1px dashed var(--glass-border)', borderRadius: '8px' }}>
                                                        Sin capas adicionales
                                                    </div>
                                                ) : (
                                                    sceneLayers.map((layer, idx) => (
                                                        <div key={layer.id} className={`${styles.layerCard} ${activeLayerId === layer.id ? styles.layerActive : ''}`} onClick={() => setActiveLayerId(layer.id)}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: activeLayerId === layer.id ? '12px' : '0' }}>
                                                                <input type="checkbox" checked={layer.active} onClick={(e) => e.stopPropagation()} onChange={(e) => setSceneLayers(prev => prev.map(l => l.id === layer.id ? { ...l, active: e.target.checked } : l))} />
                                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                                    {layer.type === 'clock' ? <Clock size={14} color="#a78bfa" /> : layer.type === 'weather' ? <Box size={14} color="#60a5fa" /> : layer.type === 'video' ? <Video size={14} color="#34d399" /> : <ImageIcon size={14} color="#fbbf24" />}
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{layer.name}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    <button title="Subir" className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); if (idx > 0) { const newArr = [...sceneLayers];[newArr[idx], newArr[idx - 1]] = [newArr[idx - 1], newArr[idx]]; setSceneLayers(newArr); } }}><ChevronRight size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
                                                                    <button title="Bajar" className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); if (idx < sceneLayers.length - 1) { const newArr = [...sceneLayers];[newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]]; setSceneLayers(newArr); } }}><ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></button>
                                                                    <button className="btn btn-icon btn-sm text-error" onClick={(e) => { e.stopPropagation(); setSceneLayers(prev => prev.filter(l => l.id !== layer.id)); }}><Trash2 size={12} /></button>
                                                                </div>
                                                            </div>

                                                            {activeLayerId === layer.id && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                        <div style={{ flex: 1 }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '4px' }}>
                                                                                <span className="text-muted">Posición X</span>
                                                                                <span className="text-accent">{layer.x}%</span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                <input type="range" min="0" max="100" value={layer.x} onChange={(e) => setSceneLayers(prev => prev.map(l => l.id === layer.id ? { ...l, x: parseInt(e.target.value) } : l))} style={{ flex: 1 }} />
                                                                                <input type="number" value={layer.x} onChange={(e) => setSceneLayers(prev => prev.map(l => l.id === layer.id ? { ...l, x: parseInt(e.target.value) || 0 } : l))} className="input" style={{ width: '45px', padding: '2px', fontSize: '0.7rem' }} />
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ flex: 1 }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '4px' }}>
                                                                                <span className="text-muted">Posición Y</span>
                                                                                <span className="text-accent">{layer.y}%</span>
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                <input type="range" min="0" max="100" value={layer.y} onChange={(e) => setSceneLayers(prev => prev.map(l => l.id === layer.id ? { ...l, y: parseInt(e.target.value) } : l))} style={{ flex: 1 }} />
                                                                                <input type="number" value={layer.y} onChange={(e) => setSceneLayers(prev => prev.map(l => l.id === layer.id ? { ...l, y: parseInt(e.target.value) || 0 } : l))} className="input" style={{ width: '45px', padding: '2px', fontSize: '0.7rem' }} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '4px' }}>
                                                                            <span className="text-muted">Escala / Tamaño</span>
                                                                            <span>{layer.scale.toFixed(1)}x</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                            <ZoomIn size={12} className="text-muted" />
                                                                            <input type="range" min="0.1" max="5" step="0.1" value={layer.scale} onChange={(e) => setSceneLayers(prev => prev.map(l => l.id === layer.id ? { ...l, scale: parseFloat(e.target.value) } : l))} style={{ flex: 1 }} />
                                                                            <input type="number" step="0.1" value={layer.scale} onChange={(e) => setSceneLayers(prev => prev.map(l => l.id === layer.id ? { ...l, scale: parseFloat(e.target.value) || 1 } : l))} className="input" style={{ width: '45px', padding: '2px', fontSize: '0.7rem' }} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="modal-actions" style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                                            <button className="btn btn-secondary" onClick={() => setShowSlideComposer(false)}>Cancelar</button>
                                            <button className="btn btn-primary" onClick={handleSaveSlide} disabled={uploading || slideBackgrounds.length === 0}>
                                                {uploading ? <Loader2 className="loading-spinner" size={16} /> : <Plus size={16} />}
                                                Guardar Diapositiva
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Real-time Preview */}
                                <div className={styles.composerPreview}>
                                    <div className={styles.previewContainer}>
                                        {slideBackgrounds.length > 0 ? (
                                            <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                                                <img
                                                    src={slideBackgrounds[activeBgIndex]?.preview_url || undefined}
                                                    style={{ width: '100%', height: '100%', objectFit: slideBgMode, transition: 'opacity 0.5s ease' }}
                                                    alt=""
                                                />

                                                {sceneLayers.filter(l => l.active).map(layer => (
                                                    <div key={layer.id} style={{
                                                        position: 'absolute',
                                                        left: `${layer.x}%`,
                                                        top: `${layer.y}%`,
                                                        transform: `translate(-50%, -50%) scale(${layer.scale})`,
                                                        pointerEvents: 'none',
                                                        zIndex: 10 + sceneLayers.indexOf(layer)
                                                    }}>
                                                        {layer.type === 'clock' && (
                                                            <div style={{ color: '#fff', textAlign: 'right', textShadow: '0 2px 10px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }}>
                                                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', lineHeight: 1 }}>12:45</div>
                                                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Jueves, 26 de Febrero</div>
                                                            </div>
                                                        )}
                                                        {layer.type === 'weather' && (
                                                            <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', textShadow: '0 2px 10px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }}>
                                                                <div style={{ fontSize: '2rem' }}>☀️</div>
                                                                <div style={{ textAlign: 'left' }}>
                                                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: 1 }}>24°C</div>
                                                                    <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>México</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {layer.type === 'image' && (
                                                            <img src={layer.url} alt="" style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px' }} />
                                                        )}
                                                        {layer.type === 'video' && (
                                                            <video src={layer.url} muted autoPlay loop style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px' }} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={styles.previewPlaceholder}>
                                                <div style={{ marginBottom: '20px', opacity: 0.2 }}>Diapositivas</div>
                                                <p>Selecciona una imagen de fondo para comenzar</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.previewZoom}>
                                        <Maximize2 size={14} />
                                        <span>Previsualización interactiva</span>
                                    </div>
                                    {slideBackgrounds.length > 1 && (
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {slideBackgrounds.map((_, i) => (
                                                <div key={i} style={{ width: '20px', height: '4px', background: i === activeBgIndex ? 'var(--accent)' : 'rgba(255,255,255,0.2)', borderRadius: '2px' }}></div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Custom Delete Modal */}
            {
                showDeleteModal && (
                    <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                        <div className="modal-content" style={{ maxWidth: '450px', border: '1px solid var(--glass-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', background: 'var(--bg-elevated)' }} onClick={(e) => e.stopPropagation()}>
                            {!deleteFinished ? (
                                <>
                                    <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '10px' }}>
                                                <Trash2 size={24} color="#ef4444" />
                                            </div>
                                            <h2 style={{ margin: 0 }}>Confirmar Eliminación</h2>
                                        </div>
                                        {!isDeleting && <button className="modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>}
                                    </div>
                                    <div style={{ padding: '24px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                            {deleteType === 'single'
                                                ? '¿Estás seguro de que quieres eliminar este archivo permanentemente?'
                                                : `¿Estás seguro de que quieres eliminar ${selectedMediaIds.length} archivos permanentemente?`
                                            }
                                        </p>
                                        <p style={{ fontSize: '0.8rem', color: 'rgba(239, 68, 68, 0.8)', fontWeight: 600 }}>
                                            Esta acción no se puede deshacer.
                                        </p>
                                    </div>
                                    <div className="modal-actions" style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', gap: '12px' }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ flex: 1 }}
                                            onClick={() => setShowDeleteModal(false)}
                                            disabled={isDeleting}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            style={{ flex: 1, position: 'relative' }}
                                            onClick={confirmDelete}
                                            disabled={isDeleting}
                                        >
                                            {isDeleting ? (
                                                <> Eliminando... </>
                                            ) : (
                                                <> Eliminar Ahora </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        background: 'rgba(52, 211, 153, 0.1)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 20px'
                                    }}>
                                        <Check size={32} color="#34d399" />
                                    </div>
                                    <h2 style={{ marginBottom: '10px' }}>¡Operación Exitosa!</h2>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                                        Los elementos han sido eliminados de la biblioteca.
                                    </p>
                                    <button className="btn btn-primary" onClick={() => setShowDeleteModal(false)} style={{ width: '100%' }}>
                                        Entendido
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </>
    );
}
