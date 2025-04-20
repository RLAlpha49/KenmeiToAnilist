import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Automatically clean up after each test
afterEach(() => {
  cleanup();
});

// Stub window.matchMedia for UI components
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as any;
}

// Stub themeMode API for ThemeProvider and helpers
window.themeMode = {
  current: async () => "light",
  dark: async () => undefined,
  light: async () => undefined,
  system: async () => false,
};

// Stub globals used by main.ts
(globalThis as any).MAIN_WINDOW_VITE_DEV_SERVER_URL = "";
(globalThis as any).MAIN_WINDOW_VITE_NAME = "renderer";
