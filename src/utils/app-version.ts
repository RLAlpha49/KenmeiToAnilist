/**
 * App version utility
 * Provides a centralized way to access the application version throughout the app
 */

// For renderer process (React)
export const getAppVersion = (): string => {
  // In renderer process, get from env variable set by the main process
  return import.meta.env.VITE_APP_VERSION || "1.0.0";
};

// For main process (Electron) - use dynamic import since app is only available in main
export const getAppVersionElectron = async (): Promise<string> => {
  try {
    // Only import app in Electron main process
    if (typeof window === "undefined") {
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
export const getFormattedAppVersion = (): string => {
  return `v${getAppVersion()}`;
};

// Check for updates by comparing current version with the latest GitHub release
export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/RLAlpha49/KenmeiToAnilist/releases/latest",
    );

    if (!response.ok) {
      return {
        hasUpdate: false,
        latestVersion: "",
        releaseUrl: "",
      };
    }

    const data = await response.json();
    const latestVersion = data.tag_name?.replace(/^v/, "") || "";
    const currentVersion = getAppVersion();

    // Simple version comparison (this could be more sophisticated)
    const hasUpdate =
      latestVersion &&
      currentVersion &&
      compareVersions(latestVersion, currentVersion) > 0;

    return {
      hasUpdate,
      latestVersion,
      releaseUrl: data.html_url || "",
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    return {
      hasUpdate: false,
      latestVersion: "",
      releaseUrl: "",
    };
  }
}

// Simple version comparison utility
function compareVersions(v1: string, v2: string): number {
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
export type AppVersionStatus =
  | { status: "stable"; latestVersion: string; releaseUrl: string }
  | { status: "beta"; latestVersion: string; releaseUrl: string }
  | { status: "development"; latestVersion: string; releaseUrl: string };

// Type for GitHub Release API response (minimal fields used)
type GitHubRelease = {
  draft: boolean;
  prerelease: boolean;
  tag_name: string;
  html_url: string;
};

/**
 * Checks the app version status (stable, beta, development) by comparing the current version
 * to the latest stable and prerelease versions on GitHub.
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
