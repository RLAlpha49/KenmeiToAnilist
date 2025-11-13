# Auto-Update & Version System (Electron)

## Overview

The app uses Electron's auto-updater with a secure IPC bridge to check for, download, and install updates. The renderer never calls autoUpdater directly; it interacts via `globalThis.electronUpdater` exposed in the preload script.

## Architecture

- Context: `src/helpers/ipc/update/update-context.ts` (exposes electronUpdater)
- Channels: `src/helpers/ipc/update/update-channels.ts` (constants)
- Listeners: `src/helpers/ipc/update/update-listeners.ts` (wires electron-updater events to IPC)
- Hook: `src/hooks/useAutoUpdater.ts` (UI state and control)
- Registration: `src/helpers/ipc/listeners-register.ts` → `addUpdateEventListeners()`

## Context Bridge API (globalThis.electronUpdater)

Methods:

- checkForUpdates(options?: { allowPrerelease?: boolean }): Promise<{ updateAvailable: boolean; version?: string; releaseNotes?: string; releaseDate?: string }>
- downloadUpdate(): Promise<void>
- installUpdate(): Promise<void>

Events (unsubscribe by calling returned function):

- onUpdateAvailable(cb: (info: { version: string; releaseNotes: string; releaseDate: string }) => void): () => void
- onDownloadProgress(cb: (p: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void): () => void
- onUpdateDownloaded(cb: (info: { version: string }) => void): () => void
- onUpdateError(cb: (err: { message: string; stack?: string; name?: string }) => void): () => void

## IPC Channels

- update:check — UPDATE_CHECK_CHANNEL
- update:download — UPDATE_DOWNLOAD_CHANNEL
- update:install — UPDATE_INSTALL_CHANNEL
- update:available — UPDATE_AVAILABLE_EVENT (event)
- update:download-progress — UPDATE_DOWNLOAD_PROGRESS_EVENT (event)
- update:downloaded — UPDATE_DOWNLOADED_EVENT (event)
- update:error — UPDATE_ERROR_EVENT (event)

## Renderer Integration: useAutoUpdater()

Location: `src/hooks/useAutoUpdater.ts`

State exposed:

- updateAvailable, updateInfo (version, notes, date)
- downloadProgress, isDownloading, isDownloaded
- error (string | null)

Actions:

- checkForUpdates(allowPrerelease?: boolean)
- downloadUpdate()
- installUpdate()
- dismissUpdate()

Behavior:

- Subscribes to all update events; updates state and shows toasts on changes
- Dismisses versions persistently via storage key `STORAGE_KEYS.UPDATE_DISMISSED_VERSIONS` (value: "update_dismissed_versions")
- Gracefully handles environments without auto-updater (e.g., dev) by showing user-friendly toasts and warnings

## Settings & UI

- Settings page can call checkForUpdates and show status
- When an update is available and not dismissed, a toast/notification is shown with version and "Download" action
- After download completes, a toast offers "Install Now" action which calls installUpdate()

## Version Reporting

- Version strings come from Electron (app.getVersion())
- Sentry uses `release: kenmeitoanilist@<version>` for correlation

## Error Handling & Telemetry

- All update errors are surfaced via onUpdateError and bubbled into the hook (toast + state)
- Non-fatal failures (e.g., check failing offline) are handled gracefully and do not block the app

## Pre-releases

- checkForUpdates accepts `allowPrerelease` to include beta/rc builds when desired
- Preference may be stored under `STORAGE_KEYS.UPDATE_CHANNEL` if needed (stable/beta)

## Security

- Renderer interacts only through context bridge
- All handlers registered via `secureHandle()` (sender validation) in `listeners-register.ts`

## Notes

- The previous GitHub-release-only flow has been superseded by the auto-updater
- Manual install remains possible but is not the primary path in current code
