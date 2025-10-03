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
- [Troubleshooting](#-troubleshooting)
  - [Common Import Issues](#common-import-issues)
  - [Collecting Debug Logs](#collecting-debug-logs)
- [Getting Help](#-getting-help)

## 🚀 Getting Started

### First Launch

When you first open Kenmei to AniList, you'll see the **Home Page** with several options:

1. **Import Kenmei Data** - Start by importing your Kenmei CSV export
2. **AniList Authentication** - Connect your AniList account
3. **Settings** - Configure synchronization preferences
4. **Help & Documentation** - Access guides and support

### AniList Authentication

Before syncing, you need to authenticate with AniList:

1. Click **"Connect AniList Account"** on the home page
2. You'll be redirected to AniList's authorization page
3. Log in to your AniList account and authorize the app
4. You'll be redirected back to the app with authentication complete

> **Note**: Your AniList credentials are only used for API access.

## 📥 Importing Your Data

### Using the Import Page

1. **Navigate to Import** from the home page
2. **Drag and Drop** your CSV file onto the upload area, or
3. **Click "Select File"** to browse for your CSV
4. **File Validation** - The app will check your CSV format
5. **Preview Data** - Review the first few entries to ensure correct import

### Handling Import Errors

If import fails:

- **Check file format** - Ensure it's a valid CSV
- **Check for empty rows** - Remove blank lines in your CSV

## 🎯 Understanding the Matching Process

### Automatic Matching

The app uses a algorithm to match your manga:

1. **Exact Title Match** - Looks for identical titles first
2. **Fuzzy Matching** - Handles variations in spelling/formatting
3. **Alternative Titles** - Checks English, Japanese, and romanized names
4. **Year/Publication Date** - Uses dates to distinguish between series

### Match Confidence Levels

- **🟢 High Confidence** - Very likely correct match
- **🟡 Medium Confidence** - Probable match, review recommended
- **🔴 Low Confidence** - Uncertain match, manual review needed
- **❌ No Match** - No suitable match found in AniList

### Manual Matching

For unmatched or uncertain entries:

1. **Click the manga entry** to open match options
2. **Search AniList** manually using the built-in search
3. **Select the correct match** from search results
4. **Confirm the match** to update your collection

## 🔄 Synchronizing to AniList

### Sync Options

Configure what to sync:

- **Reading Status** - Update current reading status
- **Progress** - Sync chapter/volume progress
- **Scores** - Update ratings/scores
- **Dates** - Sync start/completion dates
- **Private Entries** - Mark entries as private on AniList

### Sync Process

1. **Final Review** - Check the sync preview
2. **Start Sync** - Click "Sync to AniList"
3. **Progress Monitoring** - Watch real-time sync progress
4. **Error Handling** - Review any failed syncs
5. **Completion Summary** - See final sync results

## 🔧 Troubleshooting

### Common Import Issues

#### "Invalid CSV Format"

- Ensure file has proper CSV structure
- Check for missing headers
- Verify file encoding (UTF-8 recommended)

#### "No Manga Found"

- Check if titles are in the correct column
- Verify manga names match AniList database
- Try manual matching for problem entries

#### "Authentication Failed"

- Re-authenticate with AniList
- Check internet connection
- Verify AniList service status

### Collecting Debug Logs

If support asks for application logs or you need to diagnose an issue without developer tools:

1. Navigate to **Settings → Data → Debug tools**.
2. Enable the **Debug menu** toggle, then switch on the **Log viewer** panel.
3. Open the header and select the bug icon to launch the **Debug Command Center**.
4. Choose the **Log Viewer** tab to inspect captured console output, filter messages by severity, or search by keyword.
5. Click **Export JSON** to download the most recent logs. Review the file before sharing—entries may include sensitive details.

## 📞 Getting Help

If you need additional assistance:

1. **Review error messages** for specific guidance
2. **Check GitHub Issues** for known problems
3. **Create a new issue** with detailed information
