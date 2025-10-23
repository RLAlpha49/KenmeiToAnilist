# User Guide - Kenmei to AniList

A comprehensive guide to using Kenmei to AniList for migrating and synchronizing your manga library.

## 📖 Table of Contents

- [Getting Started](#-getting-started)
  - [First Launch](#first-launch)
  - [AniList Authentication](#anilist-authentication)
- [Importing Your Data](#-importing-your-data)
  - [Using the Import Page](#using-the-import-page)
  - [Handling Import Errors](#handling-import-errors)
- [Understanding the Matching Process](#-understanding-the-matching-process)
  - [Automatic Matching](#automatic-matching)
  - [Match Confidence Levels](#match-confidence-levels)
  - [Manual Matching](#manual-matching)
- [Synchronizing to AniList](#-synchronizing-to-anilist)
  - [Sync Options](#sync-options)
  - [Sync Process](#sync-process)
- [Frequently Asked Questions](#-frequently-asked-questions)
- [Troubleshooting](#-troubleshooting)
  - [Collecting Debug Logs](#collecting-debug-logs)
- [Getting Help](#-getting-help)

## 🚀 Getting Started

### First Launch

When you first open Kenmei to AniList for the first time, an **interactive onboarding wizard** will appear automatically. This wizard will guide you through the setup process step-by-step.

If you prefer to skip the wizard, you can close it at any time. The wizard can be restarted later from the home page using the **"Restart Onboarding"** button.

### Onboarding Wizard

The onboarding wizard provides a guided introduction to the app with 5 key steps:

**Step 1: Welcome** - Introduction to the app and overview of the workflow. Learn what you'll accomplish in the following steps.

**Step 2: Import CSV** - Learn how to export your manga library from Kenmei and import it into the app. Includes information about file formats and data privacy.

**Step 3: Authentication** - Guide through connecting your AniList account securely using OAuth. Understand the permissions the app requests and why.

**Step 4: Matching** - Understand how the automatic matching algorithm works, learn about confidence scores, and discover how to manually search for titles.

**Step 5: Sync Configuration** - Overview of sync options, priority settings, safety features, and incremental sync capabilities.

**Tips:**

- Hover over highlighted terms to see additional explanations and tips
- You can navigate back and forth through the steps at any time
- The wizard can be restarted later from the home page
- Completing or skipping the wizard marks it as seen and won't show again unless manually restarted

### AniList Authentication

Before syncing, you need to authenticate with AniList:

1. Click **"Connect AniList Account"** on the home page (or follow the authentication step in the onboarding wizard)
2. You'll be redirected to AniList's authorization page
3. Log in to your AniList account and authorize the app
4. You'll be redirected back to the app with authentication complete

> **Note**: Your AniList credentials are only used for API access. The app has read/write access only to your manga list, not other sensitive data.

## 📥 Importing Your Data

### Using the Import Page

1. **Navigate to Import** from the home page
2. **Drag and Drop** your CSV file onto the upload area, or
3. **Click "Select File"** to browse for your CSV file
4. **File Validation** - The app will check your CSV format
5. **Preview Data** - Review the first few entries to ensure correct import
6. **Confirm Import** - Click the import button to start processing

The import process will:

- Parse your CSV file
- Extract manga titles and metadata
- Store data locally on your computer
- Prepare data for matching

### Handling Import Errors

If import fails:

- **Check file format** - Ensure it's a valid CSV file
- **Check for empty rows** - Remove blank lines in your CSV
- **Verify encoding** - Ensure file is UTF-8 encoded
- **Check column headers** - Verify required columns are present

If problems persist, check the error message displayed or collect debug logs (see [Collecting Debug Logs](#collecting-debug-logs)).

## 🎯 Understanding the Matching Process

### Automatic Matching

The app uses intelligent algorithms to match your manga titles with AniList's database:

1. **Exact Title Match** - Looks for identical titles first
2. **Fuzzy Matching** - Handles variations in spelling/formatting
3. **Alternative Titles** - Checks English, Japanese, and romanized names
4. **Year/Publication Date** - Uses dates to distinguish between series
5. **Format Matching** - Considers manga format (Manga, Light Novel, One-shot, etc.)

### Match Confidence Levels

The matching algorithm assigns confidence scores to each potential match:

- **🟢 High Confidence (80%+)** - Very likely correct match, safe to use automatically
- **🟡 Medium Confidence (50-80%)** - Probable match, review recommended
- **🔴 Low Confidence (<50%)** - Uncertain match, manual review strongly recommended
- **❌ No Match** - No suitable match found in AniList database

### Manual Matching

For unmatched or uncertain entries:

1. **Click the manga entry** to open match options
2. **Search AniList** manually using the built-in search box
3. **Browse search results** to find the correct series
4. **Select the match** from search results
5. **Confirm the match** to update your collection

Tips for manual matching:

- Try searching with different title formats (English, Japanese, shortened titles)
- Check publication years to ensure correct series
- Look at cover images to verify
- Read descriptions to confirm series identity

### Undo and Redo Actions

The matching interface includes built-in undo/redo functionality to help you experiment with different match selections without fear of losing your progress:

**Supported Actions:**

- Accepting matches
- Rejecting/skipping matches
- Selecting alternative matches
- Resetting matches to pending status
- Manual search selections

**Using Undo/Redo:**

- **Undo**: Press `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac) to undo the last action
- **Redo**: Press `Ctrl+Shift+Z` or `Ctrl+Y` (Windows/Linux) or `Cmd+Shift+Z` (Mac) to redo
- Click the **Undo** (↶) and **Redo** (↷) buttons in the header for mouse navigation
- Buttons are disabled when there are no actions to undo/redo

**Important Notes:**

- Undo history stores the last 50 actions only
- Undo/redo is disabled during active matching to prevent conflicts
- Using "Fresh Search (Clear Cache)" will clear the undo history
- Rematch operations will reset the undo history to prevent inconsistent state

**Tip**: Use undo/redo to safely try different match selections. If you're not sure about a choice, you can always undo and try something else!

## ⌨️ Keyboard Shortcuts

The app supports keyboard shortcuts for efficient navigation and control. Press `?` or `Ctrl+/` to open the keyboard shortcuts panel and view all available shortcuts.

### Navigation Shortcuts

Navigate quickly between pages using number keys (Windows/Linux and Mac):

| Shortcut | Action |
|----------|--------|
| **Ctrl+1** / **Cmd+1** | Go to Home page |
| **Ctrl+2** / **Cmd+2** | Go to Import page |
| **Ctrl+3** / **Cmd+3** | Go to Review / Matching page |
| **Ctrl+4** / **Cmd+4** | Go to Sync page |
| **Ctrl+5** / **Cmd+5** | Go to Settings page |

### Matching Page Shortcuts

When on the Review/Matching page, use these shortcuts for efficient matching:

| Shortcut | Action |
|----------|--------|
| **Ctrl+F** / **Cmd+F** | Focus search input in the manga search modal |
| **Ctrl+Z** / **Cmd+Z** | Undo last match action |
| **Ctrl+Shift+Z** / **Cmd+Shift+Z** | Redo last undone action |
| **Ctrl+Y** / **Cmd+Y** | Redo last undone action (alternative) |

### Sync & Settings Shortcuts

Configure and save your preferences:

| Shortcut | Action |
|----------|--------|
| **Ctrl+S** / **Cmd+S** | Save configuration (context-aware: saves sync config on Sync page, match config on Settings page) |

### Debug Shortcuts

For troubleshooting and advanced features:

| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+D** / **Cmd+Shift+D** | Open/Toggle debug menu |

### General Shortcuts

| Shortcut | Action |
|----------|--------|
| **?** | Open keyboard shortcuts panel |
| **Ctrl+/** / **Cmd+/** | Open keyboard shortcuts panel (alternative) |
| **Escape** | Close open dialogs and modals |

### Platform-Specific Modifiers

- **Windows / Linux**: Use `Ctrl` for modifier key combinations
- **Mac**: Use `Cmd` for modifier key combinations (shown as `⌘` on Mac keyboards)

## 🔄 Synchronizing to AniList

### Sync Options

Before syncing, configure which fields to synchronize:

- **Reading Status** - Update current reading status (Planning, Current, Completed, Dropped, Paused)
- **Progress** - Sync chapter/volume progress
- **Scores** - Update ratings/scores (0-10 scale)
- **Dates** - Sync start/completion dates
- **Private Entries** - Mark entries as private on AniList
- **Notes** - Include personal notes and comments

### Sync Process

1. **Review Configuration** - Check which fields will sync in settings
2. **Preview Changes** - Review what will be updated on AniList
3. **Start Sync** - Click "Sync to AniList" when ready
4. **Monitor Progress** - Watch real-time sync progress with status indicators
5. **Handle Errors** - Review any failed syncs
6. **View Results** - See sync completion summary and statistics

**Important**: Always review the preview before syncing to ensure accuracy. Changes to AniList cannot be easily undone.

## 💾 Backup & Restore

### Creating Backups

Backups preserve your complete application data in a single file, allowing you to restore your progress at any time.

**Data Included in Backups:**

- Kenmei manga library (from import)
- Match results and confidence scores
- Sync configuration and statistics
- Import history and statistics
- Ignored duplicates
- AniList search cache
- Onboarding status

**Manual Backup Creation:**

1. Navigate to **Settings → Data Management**
2. Click **"Create Backup Now"** button
3. A backup file (`kenmei-backup-TIMESTAMP.json`) will download to your Downloads folder
4. Store the file in a safe location

**Automatic Backups:**

Enable automatic backups to create backup files before each sync or matching operation:

1. Navigate to **Settings → Data Management**
2. Enable the **"Enable automatic backups before sync/matching operations"** checkbox
3. Backups will now be created automatically before major operations
4. Automatic backup files are saved alongside manual backups in your Downloads folder

### Restoring Backups

Restore a backup to return your application data to a previous state.

**⚠️ Warning**: Restoring a backup will **overwrite all current application data**. Create a backup first if needed.

**To Restore a Backup:**

1. Navigate to **Settings → Data Management**
2. Click the file upload area under "Restore from Backup"
3. Select a previously saved backup file (`.json`)
4. A confirmation dialog will display:
   - Backup timestamp
   - Application version when backup was created
   - List of data that will be restored
5. Click **"Restore Backup"** to confirm
6. Application will automatically reload with restored data

### Backup History

Recently created backups are tracked in backup history:

1. Navigate to **Settings → Data Management → Recent Backups**
2. Click **"Show"** to expand the backup history
3. History displays:
   - Backup date and time
   - Application version at backup time
   - Backup file size
4. Click **"Restore"** next to any backup to restore from history
   - *Note: This requires the original backup file; history shows metadata only*
5. Click **"Clear History"** to remove all history entries

## ❓ Frequently Asked Questions

### General Questions

**Q: Is my data safe?**

A: Yes. Your data is stored locally on your computer and never transmitted except to AniList for synchronization.

**Q: Can I undo a synchronization?**

A: No, but you can review changes in the preview before syncing. Always backup your AniList data first by exporting it.

**Q: Does this app work offline?**

A: Partial offline support. You can import CSV files offline, but syncing requires an internet connection.

**Q: Can I sync partial data?**

A: Yes, you can select which fields to sync (status, progress, scores, etc.) in the sync configuration before starting.

### Import & Matching

**Q: Why are some manga not matching?**

A: If manga titles differ significantly from AniList database names, the automatic matching may fail. Use manual matching for these entries, or adjust the manga name in your CSV.

**Q: Can I import multiple CSV files?**

A: Currently, import one file at a time. Importing again will overwrite previous data.

**Q: How accurate is the matching?**

A: Automatic matching works well for popular manga (85-95% accuracy). Less common titles may require manual searching.

### Synchronization

**Q: How long does sync take?**

A: Typically 1-2 minutes for 50-100 manga, but varies based on:

- Number of manga to sync
- Current AniList API load
- AniList rate limiting (60 requests per minute)

**Q: Will my AniList data be overwritten?**

A: Only fields you configured for syncing will be updated. Existing data in other fields remains unchanged.

**Q: What if sync fails partway?**

A: Failed entries are logged and can be retried from the results page. Check debug logs for error details.

**Q: Can I sync to multiple AniList accounts?**

A: Only one account at a time. You can switch accounts in Settings → Authentication.

## 🔧 Troubleshooting

### Collecting Debug Logs

If asked for application logs or you need to diagnose an issue:

1. Navigate to **Settings → Debug tools**
2. Enable the **Debug menu** toggle
3. Click the bug icon (🐞) in the header to launch **Debug Command Center**
4. Choose **Log Viewer** tab to inspect console output
5. Use filters to search by severity or keyword
6. Click **Export JSON** to download logs
7. Review the file before sharing—entries may include details you prefer not to share

**Tip**: Exported logs are useful for reporting bugs or troubleshooting issues.

## 📞 Getting Help

If you need additional assistance:

1. **Review error messages** for specific guidance
2. **Review application logs** via Debug Menu
3. **Check GitHub Issues** for known problems at [github.com/RLAlpha49/KenmeiToAnilist/issues](https://github.com/RLAlpha49/KenmeiToAnilist/issues)
4. **Create a new issue** with:
   - Detailed description of the problem
   - Steps to reproduce
   - Exported debug logs (if applicable)
   - App version (shown in Settings)
   - Operating system and version

**Remember**: Always provide as much context as possible when reporting issues to help resolve them faster.
