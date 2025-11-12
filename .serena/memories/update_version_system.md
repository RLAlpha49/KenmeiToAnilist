# Application Update & Version Management System

## Overview

The application implements an automatic update system with version checking, GitHub release detection, and user-controlled update installation. The system prevents updates during critical operations and provides clear user feedback.

## Architecture

**Location**: `src/utils/app-version.ts` and `src/main.ts`

### Version Information

**`getAppVersion()`**:

```typescript
// Returns app version from package.json
// Format: "1.2.3"

const version = getAppVersion();
// "1.5.0"
```

**`getAppVersionElectron()`**:

```typescript
// Returns Electron-managed version
// More reliable than package.json

const version = getAppVersionElectron();
// "1.5.0"
```

**`getFormattedAppVersion()`**:

```typescript
// Returns display-friendly version string
// Format: "v1.5.0" or "v1.5.0-alpha"

const formatted = getFormattedAppVersion();
// "v1.5.0"
```

## Version Comparison

**`compareVersions(v1, v2)`**:

```typescript
compareVersions("1.5.0", "1.4.9"); // 1 (v1 > v2)
compareVersions("1.5.0", "1.5.0"); // 0 (v1 = v2)
compareVersions("1.5.0", "1.5.1"); // -1 (v1 < v2)
```

**Algorithm**:

- Compare major.minor.patch segments
- Handle prerelease versions (alpha, beta)
- Return -1, 0, or 1 for sorting

## Update Checking

### GitHub Release Detection

**`checkForUpdates()`**:

```typescript
interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
  downloadUrl: string;
  releaseNotes: string;
}

const updateInfo = await checkForUpdates();
// {
//   hasUpdate: true,
//   latestVersion: "1.6.0",
//   currentVersion: "1.5.0",
//   releaseUrl: "https://github.com/RLAlpha49/KenmeiToAnilist/releases/tag/v1.6.0",
//   downloadUrl: "https://github.com/.../KenmeiToAnilist-1.6.0.exe",
//   releaseNotes: "## 1.6.0\n- New features...\n- Bug fixes..."
// }
```

**Source**: GitHub API for releases

```typescript
// API call to
https://api.github.com/repos/RLAlpha49/KenmeiToAnilist/releases/latest
```

### Check Frequency

**Automatic checks**:

- On app startup
- Every 24 hours (background)
- When user opens Settings → Updates

**Manual check**:

```typescript
// In settings page
<button onClick={() => checkForUpdates()}>
  Check for Updates
</button>
```

### Version Status

**`getAppVersionStatus()`**:

```typescript
enum VersionStatus {
  UNKNOWN = "unknown",           // Can't determine
  UP_TO_DATE = "up_to_date",     // Latest version
  UPDATE_AVAILABLE = "update_available", // Newer version exists
  DEVELOPMENT = "development"    // Dev build (no releases)
}

const status = getAppVersionStatus();
// "update_available"
```

## Update Notification System

### Update Notification Component

**Location**: `src/components/UpdateNotification.tsx`

**Display triggers**:

1. Update available
2. Delayed 3 seconds (let app stabilize)
3. Not during sync/matching
4. Not during critical operations

**Notification content**:

```text
┌─────────────────────────────────────┐
│ ℹ️ Update Available                 │
│ Version 1.6.0 is now available     │
│                                     │
│ [Download Update] [Remind Later]   │
│ [Read Release Notes]               │
└─────────────────────────────────────┘
```

### User Actions

**[Download Update]**:

- Open GitHub release page
- User manually downloads installer
- User installs at their convenience
- App notified of completion

**[Remind Later]**:

- Dismiss notification
- Check again next session
- Stored in storage: `UPDATE_DISMISSED_VERSIONS`

**[Read Release Notes]**:

- Open GitHub release page in browser
- Show changelog
- User can review before deciding

### Dismissal Logic

**`UPDATE_DISMISSED_VERSIONS` storage key**:

```typescript
// Stored versions that user dismissed
["1.5.5", "1.6.0-beta"];

// If new 1.6.0 released after dismissing 1.6.0-beta
// → Show notification again (different version)

// If same version pushed again
// → Don't show notification again (dismissed by user)
```

## Update Installation

### Manual Installation Process

**Currently**: Manual download and installation

```text
1. User clicks "Download Update"
2. Browser opens GitHub release
3. User downloads .exe (Windows) / .dmg (macOS) / .deb (Linux)
4. User runs installer
5. Installer handles:
   - Backup old version (Windows)
   - Install new version
   - Preserve user data
   - Clean up old files
6. App auto-restarts with new version
```

### Auto-Update (Electron Auto Updater)

**Configured in `src/main.ts`**:

```typescript
const autoUpdater = require('electron-updater').autoUpdater;

autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log(`Update available: ${info.version}`);
});

autoUpdater.on('update-not-available', () => {
  console.log('No update available');
});

autoUpdater.on('error', (err) => {
  console.error('Auto updater error:', err);
});
```

**Timing**:

- Check on startup
- Check every 24 hours
- User can manually trigger

## Build Configuration

### Build Metadata

**`src/main.ts` setup**:

```typescript
// App version from package.json
const appVersion = app.getVersion();

// Release channel
const releaseChannel = isDevelopment ? 'development' : 'stable';

// Build info for Sentry
Sentry.init({
  release: `kenmeitoanilist@${appVersion}`,
  tracesSampleRate: 0.1,
  // ...
});
```

### Versioning Strategy

**Semantic Versioning**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (1.x → 2.x)
- **MINOR**: Features/enhancements (1.4 → 1.5)
- **PATCH**: Bug fixes (1.5.0 → 1.5.1)

**Pre-releases**: `1.6.0-beta.1`, `1.6.0-rc.1`

**Development builds**: Use higher version with -dev suffix

## Update Types

### Feature Updates

**MINOR version bump**:

- New features added
- Backward compatible
- Automatic check recommended
- Release notes highlight features

### Bug Fix Updates

**PATCH version bump**:

- Fixes critical bugs
- Backward compatible
- Automatic installation safe
- Release notes list fixes

### Security Updates

**PATCH or MINOR**:

- Security vulnerability fixed
- URGENT - recommend immediate update
- Release notes explain vulnerability
- Special notification styling

### Breaking Changes

**MAJOR version bump**:

- API changes
- Data format changes
- Incompatibilities
- Migration guide in release notes
- Strongly recommend update

## Release Notes

### Release Information

**From GitHub**:

```typescript
interface GitHubRelease {
  tag_name: string;        // "v1.6.0"
  name: string;            // "1.6.0"
  body: string;            // Markdown release notes
  draft: boolean;          // Is draft?
  prerelease: boolean;     // Is pre-release?
  created_at: string;      // ISO timestamp
  published_at: string;    // ISO timestamp
  html_url: string;        // GitHub page URL
}
```

**Release notes parsing**:

```typescript
// Release body (Markdown)
## Features
- New matching algorithm
- Dark mode support

## Bug Fixes
- Fixed sync crashes
- Fixed import encoding

## Performance
- 30% faster startup
- Reduced memory usage
```

### Display in UI

```typescript
<Dialog open={showReleaseNotes}>
  <h2>Release Notes - v{version}</h2>
  <div className="markdown">
    {parseMarkdown(releaseBody)}
  </div>
  <a href={url}>View on GitHub</a>
</Dialog>
```

## Update Prevention

### Critical Operations

**Don't show update during**:

- CSV import in progress
- Manga matching active
- AniList sync running
- Settings being modified
- Modal dialogs open

**Implementation**:

```typescript
// Check if safe to update
const canShowUpdateNotification = () => {
  return (
    !isImporting &&
    !isMatching &&
    !isSyncing &&
    !isInSettings &&
    !hasOpenDialog
  );
};

if (canShowUpdateNotification()) {
  showUpdateNotification();
}
```

## Update History

### Tracking Updates

**Not currently tracked**, but could include:

- Current version
- Previous version
- Update timestamp
- Update method (auto/manual)
- Installation success/failure

**Would be useful for**:

- User support (troubleshooting)
- Analytics (adoption metrics)
- Rollback if needed

## Settings Integration

### Update Preferences

**Settings → About → Updates**:

```typescript
<SettingsSection title="Updates">
  <div>
    Current Version: {currentVersion}
  </div>
  <button onClick={checkForUpdates}>
    Check for Updates
  </button>
  
  {hasUpdate && (
    <>
      <Alert>New version {latestVersion} available</Alert>
      <button onClick={downloadUpdate}>
        Download Now
      </button>
    </>
  )}
  
  <Checkbox>
    Automatically check for updates
  </Checkbox>
  
  <Select>
    <option>Stable releases only</option>
    <option>Include pre-releases</option>
  </Select>
</SettingsSection>
```

## Error Handling

### Update Check Failures

**Network error**:

```typescript
try {
  const update = await checkForUpdates();
} catch (error) {
  if (isNetworkError(error)) {
    console.warn("Can't check updates - offline");
    // Silently continue, try again later
  } else {
    logError("Update check failed", error);
  }
}
```

**GitHub API issues**:

- Rate limit hit (60 requests/hour unauthenticated)
- Service unavailable
- Timeout (5 second default)

**Solution**: Retry with exponential backoff

### Notification Failures

**If notification can't display**:

- Log error silently
- Try again on next cycle
- Don't block app startup

## Testing

### Simulating Updates

**Dev mode**:

```typescript
// Override version for testing
if (isDevelopment) {
  mockAppVersion("1.0.0");
  mockLatestVersion("2.0.0");
  showUpdateNotification();
}
```

### Checking Current Version

```bash
# CLI
electron . --version

# In DevTools console
require('electron').app.getVersion()
```

## Performance Characteristics

### Update Check

**HTTP request to GitHub API**:

- Timeout: 5 seconds
- Response size: ~5KB
- Frequency: Once per 24 hours (automatic)
- Network impact: Negligible

### Memory Impact

- Update info stored in memory: ~10KB
- Release notes cached: ~50KB
- No persistent disk impact

## Best Practices

✅ **DO**:

- Check for updates regularly
- Display clear notifications
- Show release notes
- Prevent updates during operations
- Handle network failures gracefully

❌ **DON'T**:

- Force updates without user consent
- Update during critical operations
- Hide update availability
- Annoy users with notifications
- Break backward compatibility without reason
