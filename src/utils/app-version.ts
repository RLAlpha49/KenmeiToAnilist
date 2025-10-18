/**
 * @packageDocumentation
 * @module app-version
 * @description Utility functions and types for accessing and comparing the application version, checking for updates, and determining version status.
 */

// Renderer process (React) - version from build-time environment variable
/**
 * Gets the application version for the renderer process.
 *
 * Retrieves the version from the build-time environment variable set during the build process.
 *
 * @returns The current application version as a string.
 * @source
 */
export const getAppVersion = (): string => {
  return import.meta.env.VITE_APP_VERSION || "1.0.0";
};

// Main process (Electron) - dynamically import electron.app to avoid requiring it in renderer
/**
 * Gets the application version for the Electron main process.
 *
 * Uses dynamic import to safely access the Electron app module only in the main process context.
 * Falls back to the renderer version or npm package version if the main process is unavailable.
 *
 * @returns A promise that resolves to the current application version as a string.
 * @source
 */
export const getAppVersionElectron = async (): Promise<string> => {
  try {
    // Only import app in Electron main process
    if (globalThis.window === undefined) {
      const electron = await import("electron");
      return electron.app.getVersion();
    }
    // Fallback for renderer process
    return getAppVersion();
  } catch {
    // Fallback if app is not available
    return process.env.npm_package_version || "1.0.0";
  }
};

// Use this to display version with v prefix
/**
 * Gets the formatted application version with a 'v' prefix.
 *
 * @returns The formatted version string (e.g., 'v1.0.0').
 * @source
 */
export const getFormattedAppVersion = (): string => {
  return `v${getAppVersion()}`;
};

// Fetch latest release from GitHub to detect available updates
/**
 * Information about an available update.
 *
 * @source
 */
export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
}

/**
 * Checks for updates by comparing the current version with the latest GitHub release.
 *
 * Fetches the latest release information from the GitHub API and compares version numbers
 * to determine if an update is available.
 *
 * @returns A promise that resolves to an UpdateInfo object.
 * @source
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  console.debug("[AppVersion] Checking for app updates...");

  try {
    const response = await fetch(
      "https://api.github.com/repos/RLAlpha49/kenmei-to-anilist/releases/latest",
    );

    if (!response.ok) {
      console.warn(
        `[AppVersion] ⚠️ Failed to fetch latest release: HTTP ${response.status}`,
      );
      return {
        hasUpdate: false,
        latestVersion: "",
        releaseUrl: "",
      };
    }

    const data = await response.json();
    const latestVersion = data.tag_name?.replace(/^v/, "") || "";
    const currentVersion = getAppVersion();

    // Compare semantic versions: returns > 0 if latest is newer
    const hasUpdate =
      latestVersion &&
      currentVersion &&
      compareVersions(latestVersion, currentVersion) > 0;

    if (hasUpdate) {
      console.info(
        `[AppVersion] 🆕 Update available: ${currentVersion} → ${latestVersion}`,
      );
    } else {
      console.debug(
        `[AppVersion] ✅ App is up to date (current: ${currentVersion}, latest: ${latestVersion})`,
      );
    }

    return {
      hasUpdate,
      latestVersion,
      releaseUrl: data.html_url || "",
    };
  } catch (error) {
    console.error("[AppVersion] ❌ Error checking for updates:", error);
    return {
      hasUpdate: false,
      latestVersion: "",
      releaseUrl: "",
    };
  }
}

/**
 * Compares two version strings (e.g., '1.2.3').
 *
 * @param v1 - The first version string.
 * @param v2 - The second version string.
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 * @internal
 * @source
 */
export function compareVersions(v1: string, v2: string): number {
  const v1Parts = v1.split(".").map(Number);
  const v2Parts = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }

  return 0;
}

// Version status type
/**
 * Represents the status of the application version.
 *
 * @source
 */
export type AppVersionStatus =
  | { status: "stable"; latestVersion: string; releaseUrl: string }
  | { status: "beta"; latestVersion: string; releaseUrl: string }
  | { status: "development"; latestVersion: string; releaseUrl: string };

// Type for GitHub Release API response (minimal fields used)
/**
 * Minimal fields used from the GitHub Release API response.
 *
 * @internal
 * @source
 */
export type GitHubRelease = {
  draft: boolean;
  prerelease: boolean;
  tag_name: string;
  html_url: string;
};

/**
 * Determines app version status by comparing current version to latest GitHub releases.
 *
 * Fetches release information and categorizes the current version as stable, beta, or development.
 *
 * @returns A promise resolving to the app version status.
 * @source
 */
export async function getAppVersionStatus(): Promise<AppVersionStatus> {
  const currentVersion = getAppVersion();
  try {
    // Fetch all releases (not just latest)
    const response = await fetch(
      "https://api.github.com/repos/RLAlpha49/KenmeiToAnilist/releases?per_page=20",
    );
    if (!response.ok) throw new Error("Failed to fetch releases");
    const releases: GitHubRelease[] = await response.json();
    // Find the latest stable (not draft, not prerelease)
    const stableRelease = releases.find((r) => !r.draft && !r.prerelease);
    // Find the latest prerelease (not draft, prerelease)
    const betaRelease = releases.find((r) => !r.draft && r.prerelease);
    // Normalize version tags (remove leading v)
    const stableTag = stableRelease?.tag_name?.replace(/^v/, "");
    const betaTag = betaRelease?.tag_name?.replace(/^v/, "");
    // Compare current version
    if (stableTag && currentVersion === stableTag && stableRelease) {
      return {
        status: "stable",
        latestVersion: stableTag,
        releaseUrl: stableRelease.html_url,
      };
    }
    if (betaTag && currentVersion === betaTag && betaRelease) {
      return {
        status: "beta",
        latestVersion: stableTag || betaTag,
        releaseUrl: betaRelease.html_url,
      };
    }
    // If neither, it's a dev build
    return {
      status: "development",
      latestVersion: stableTag || betaTag || "",
      releaseUrl: stableRelease?.html_url || betaRelease?.html_url || "",
    };
  } catch {
    // Fallback: treat as development if error
    return {
      status: "development",
      latestVersion: "",
      releaseUrl: "",
    };
  }
}
