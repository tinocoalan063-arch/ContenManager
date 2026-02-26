export type UserRole = 'super_admin' | 'admin' | 'editor';
export type PlayerStatus = 'online' | 'offline';
export type MediaType = 'image' | 'video' | 'url' | 'widget';

export interface Company {
    id: string;
    name: string;
    slug: string;
    max_storage_mb: number;
    storage_limit_mb: number;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface PlayerGroup {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface User {
    id: string;
    company_id: string;
    full_name: string;
    email: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
}

export interface Player {
    id: string;
    company_id: string;
    group_id: string | null;
    name: string;
    device_key: string;
    status: PlayerStatus;
    last_heartbeat: string | null;
    group_name: string | null;
    config: Record<string, unknown>;
    last_screenshot_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface Media {
    id: string;
    company_id: string;
    name: string;
    type: MediaType;
    file_path: string | null;
    url: string | null;
    duration_seconds: number;
    size_bytes: number;
    mime_type: string | null;
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface Playlist {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    version: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface PlaylistItem {
    id: string;
    playlist_id: string;
    media_id: string;
    position: number;
    duration_seconds: number;
    created_at: string;
    media?: Media;
}

export interface PlayerPlaylist {
    id: string;
    player_id: string;
    playlist_id: string;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    days_of_week: number[] | null;
    assigned_at: string;
    playlist?: Playlist;
}

export interface PlayerLog {
    id: string;
    player_id: string;
    event: string;
    details: Record<string, unknown>;
    created_at: string;
}

export type CommandStatus = 'pending' | 'sent' | 'executed' | 'failed';

export interface PlayerCommand {
    id: string;
    player_id: string;
    command: string;
    payload: Record<string, unknown>;
    status: CommandStatus;
    created_at: string;
    executed_at: string | null;
}

export interface PlaybackLog {
    id: string;
    company_id: string;
    player_id: string;
    media_id: string;
    playlist_id: string | null;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    status: string;
}

// API response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
