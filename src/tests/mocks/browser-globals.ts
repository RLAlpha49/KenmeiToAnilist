/**
 * Mock browser globals for tests
 */

import { vi } from "vitest";

// Mock storage
export const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    __resetStore: () => {
      store = {};
    },
  };
})();

// Mock window.themeMode API
export const mockThemeMode = {
  current: vi.fn().mockResolvedValue("light"),
  toggle: vi.fn().mockResolvedValue(true),
  dark: vi.fn().mockResolvedValue(undefined),
  light: vi.fn().mockResolvedValue(undefined),
  system: vi.fn().mockResolvedValue(false),
};

// Mock window.URL.createObjectURL and revokeObjectURL
export const mockURL = {
  createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
  revokeObjectURL: vi.fn(),
};

/**
 * Setup all browser globals for a test
 */
export function setupBrowserMocks() {
  // Mock localStorage
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(
    mockLocalStorage.getItem,
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(
    mockLocalStorage.setItem,
  );
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
    mockLocalStorage.removeItem,
  );
  vi.spyOn(Storage.prototype, "clear").mockImplementation(
    mockLocalStorage.clear,
  );

  // Mock window.themeMode
  Object.defineProperty(window, "themeMode", {
    value: mockThemeMode,
    writable: true,
    configurable: true,
  });

  // Mock URL APIs
  Object.defineProperty(URL, "createObjectURL", {
    value: mockURL.createObjectURL,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    value: mockURL.revokeObjectURL,
    writable: true,
    configurable: true,
  });
}

/**
 * Reset all browser mocks to initial state
 */
export function resetBrowserMocks() {
  mockLocalStorage.__resetStore();
  vi.clearAllMocks();
}
