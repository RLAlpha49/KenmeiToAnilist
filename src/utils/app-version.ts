/**
 * @packageDocumentation
 * @module app-version
 * @description Utility functions and types for accessing and comparing the application version, checking for updates, and determining version status.
 */

/**
 * Gets the application version for the renderer process from build-time environment variable.
 * @returns The current application version as a string.
 * @source
 */
export const getAppVersion = (): string => {
  const importMeta = import.meta as ImportMeta & {
    env?: {
      VITE_APP_VERSION?: string;
    };
  };

  const rendererVersion = importMeta.env?.VITE_APP_VERSION;
  const nodeVersion =
    typeof process === "undefined"
      ? undefined
      : (process.env.VITE_APP_VERSION ?? process.env.npm_package_version);

  return rendererVersion ?? nodeVersion ?? "1.0.0";
};

/**
 * Gets the application version for the Electron main process.
 * Uses dynamic import to safely access the Electron app module only in main process context.
 * Fallback: renderer version or npm package version if main process unavailable.
 * @returns A promise resolving to the current application version as a string.
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
    return (
      process.env.VITE_APP_VERSION ?? process.env.npm_package_version ?? "1.0.0"
    );
  }
};

/**
 * Gets the formatted application version with a 'v' prefix.
 * @returns The formatted version string (e.g., 'v1.0.0').
 * @source
 */
export const getFormattedAppVersion = (): string => {
  return `v${getAppVersion()}`;
};

/**
 * Information about an available application update.
 * @source
 */
export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
}

/**
 * Checks for updates by comparing the current version with the latest GitHub release.
 * Fetches release information from GitHub API and compares version numbers to determine availability.
 * @returns A promise resolving to an UpdateInfo object.
 * @source
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  console.debug("[AppVersion] Checking for app updates...");

  try {
    const response = await fetch(
      "https://api.github.com/repos/RLAlpha49/KenmeiToAnilist/releases/latest",
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
 * Compares two semantic version strings.
 * @param v1 - The first version string (e.g., '1.2.3').
 * @param v2 - The second version string (e.g., '1.2.4').
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

/**
 * Represents the status of the application version (stable, beta, or development).
 * @source
 */
export type AppVersionStatus =
  | { status: "stable"; latestVersion: string; releaseUrl: string }
  | { status: "beta"; latestVersion: string; releaseUrl: string }
  | { status: "development"; latestVersion: string; releaseUrl: string };

/**
 * Minimal fields from the GitHub Release API response.
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
 * Categorizes version as stable, beta, or development based on release information.
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
