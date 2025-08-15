/* eslint-disable */
// @ts-check
const fs = require("fs");
const path = require("path");
const { FuseVersion, FuseV1Options } = require("@electron/fuses");

// Read package.json without using imports
const getPackageVersion = () => {
  const packageJsonPath = path.resolve(__dirname, "../package.json");
  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageData = JSON.parse(packageJsonContent);
  return packageData.version;
};

const appVersion = getPackageVersion();

const rootDir = path.resolve(__dirname, "..");
const assetsDir = path.join(rootDir, "src", "assets");
const iconBase = path.join(assetsDir, "k2a-icon-512x512");

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
const config = {
  packagerConfig: {
    executableName: "kenmei-to-anilist",
    asar: true,
    appCopyright: `Copyright © ${new Date().getFullYear()}`,
    icon: iconBase,
    appVersion: appVersion,
    buildVersion: appVersion,
    appBundleId: "com.rlapps.kenmeitoanilist",
    name: "Kenmei to Anilist",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        setupIcon: path.join(assetsDir, "k2a-icon-512x512.ico"),
        iconUrl:
          "https://raw.githubusercontent.com/RLAlpha49/KenmeiToAnilist/refs/heads/electron/src/assets/k2a-icon-512x512.ico",
        setupExe: "Kenmei-to-Anilist-Setup.exe",
        noMsi: false,
        name: "KenmeiToAnilist",
        setupMsi: "Kenmei-to-Anilist-Setup.msi",
        authors: "Alex Pettigrew",
        description:
          "Import and synchronize your Kenmei manga library with AniList",
        exe: "kenmei-to-anilist.exe",
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        name: "Kenmei-to-Anilist",
        icon: path.join(assetsDir, "k2a-icon-512x512.icns"),
        format: "ULFO",
      },
      platforms: ["darwin"],
    },
    { name: "@electron-forge/maker-zip", config: {}, platforms: ["darwin"] },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          name: "kenmei-to-anilist",
          productName: "Kenmei to Anilist",
          maintainer: "Alex Pettigrew",
          homepage: "https://github.com/RLAlpha49/KenmeiToAnilist",
          icon: path.join(assetsDir, "k2a-icon-512x512.png"),
          version: appVersion,
        },
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "src/main.ts",
            config: "config/vite.main.config.ts",
            target: "main",
          },
          {
            entry: "src/preload.ts",
            config: "config/vite.preload.config.ts",
            target: "preload",
          },
        ],
        renderer: [
          { name: "main_window", config: "config/vite.renderer.config.mts" },
        ],
      },
    },
    {
      name: "@electron-forge/plugin-fuses",
      config: {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: true,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
      },
    },
  ],
};

module.exports = config;
