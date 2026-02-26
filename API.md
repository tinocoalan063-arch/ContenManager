# Digital Signage CMS — API Documentation

This document outlines the API endpoints for the Digital Signage CMS. The API is divided into two main categories: **Admin API** (for the CMS dashboard) and **Player API** (for physical devices).

## Authentication

### Admin API
- **Mechanism**: JWT via Supabase Auth.
- **Header**: `Authorization: Bearer <JWT_TOKEN>` (Handled automatically by Next.js middleware in the browser).

### Player API
- **Mechanism**: Unique Device Keys.
- **Header**: `x-device-key: <DEVICE_KEY>`

---

## Admin API Endpoints (`/api/v1/admin/`)

### 1. Players
- **GET `/players`**: List all players for the company.
- **POST `/players`**: Register a new player.
- **PUT `/players?id={id}`**: Update player details or schedule a playlist.
- **DELETE `/players?id={id}`**: Remove a player.
- **POST `/players/commands`**: Send a remote command (REBOOT, SCREENSHOT, etc.).

### 2. Media Library
- **GET `/media`**: List all media files.
- **POST `/media`**: Register an external URL or Widget.
- **DELETE `/media?id={id}`**: Delete a media file and its physical storage.

### 3. Playlists
- **GET `/playlists`**: List all playlists.
- **POST `/playlists`**: Create a new playlist.
- **PUT `/playlists?id={id}`**: Update playlist content and name.
- **DELETE `/playlists?id={id}`**: Delete a playlist.

### 4. Analytics
- **GET `/analytics/summary?period={7d|30d|all}`**: Fetch aggregated playback data.

---

## Player API Endpoints (`/api/v1/player/`)

### 1. Heartbeat
- **POST `/heartbeat`**
  - **Purpose**: Update status to "online" and fetch pending commands.
  - **Payload**: `{ "version": "1.0.0" }`
  - **Response**: List of pending commands.

### 2. Sync
- **POST `/sync`**
  - **Purpose**: Fetch the currently scheduled playlist for the player.
  - **Response**: Full playlist object with signed media URLs.

### 3. Commands Acknowledge
- **POST `/commands/acknowledge`**
  - **Purpose**: Mark a command as executed and report results (e.g., screenshot URL).
  - **Payload**: `{ "command_id": "...", "status": "executed", "result": { "screenshot_url": "..." } }`

### 4. Playback Logging
- **POST `/playback/log`**
  - **Purpose**: Log a media playback event for analytics.
  - **Payload**: `{ "media_id": "...", "playlist_id": "...", "duration_seconds": 30 }`

---

## Response Formats

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message description"
}
```
