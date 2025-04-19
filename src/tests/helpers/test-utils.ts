import * as React from "react";
import { render } from "@testing-library/react";
import { ReactElement, ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { vi } from "vitest";

// Mock local storage for testing
export class MockLocalStorage {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  key(index: number) {
    return Object.keys(this.store)[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

// Setup mock local storage
export function setupMockLocalStorage() {
  const mockStorage = new MockLocalStorage();

  // Save original localStorage
  const originalLocalStorage = window.localStorage;

  // Replace localStorage with mock implementation
  Object.defineProperty(window, "localStorage", {
    value: mockStorage,
    writable: true,
  });

  // Return a cleanup function to restore original localStorage
  return () => {
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
  };
}

// Mock the window.electron object
export function setupMockElectron() {
  const mockIpcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeListener: vi.fn(),
  };

  // Mock electron API
  const mockElectron = {
    ipcRenderer: mockIpcRenderer,
  };

  // Save original window features
  const originalWindow = { ...window };

  // Add electron to window
  Object.defineProperty(window, "electron", {
    value: mockElectron,
    writable: true,
  });

  // Return cleanup and mock for assertions
  return {
    cleanup: () => {
      // Restore original window properties
      Object.keys(originalWindow).forEach((key) => {
        // @ts-expect-error Ignore type checking for window property assignment
        window[key] = originalWindow[key];
      });
    },
    mockIpcRenderer,
  };
}

// Mock auth data for testing
export function setupMockAuth(isAuthenticated = true) {
  const mockStorage = window.localStorage as MockLocalStorage;

  if (isAuthenticated) {
    mockStorage.setItem(
      "anilist_auth",
      JSON.stringify({
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        expiresAt: Date.now() + 3600000, // 1 hour from now
        tokenType: "Bearer",
        isAuthenticated: true,
      }),
    );
  } else {
    mockStorage.removeItem("anilist_auth");
  }
}

// Simple wrapper for tests that need a theme
interface WrapperProps {
  children: ReactNode;
  theme?: "light" | "dark" | "system";
}

// Custom render - simplified to avoid JSX issues
export function renderWithTheme(ui: ReactElement, theme = "light") {
  return render(ui, {
    wrapper: (props) => {
      // Create a simple wrapper function
      const ThemeWrapper = ({ children }: WrapperProps) => {
        return React.createElement(
          ThemeProvider,
          { attribute: "class", defaultTheme: theme },
          children,
        );
      };
      return React.createElement(ThemeWrapper, props);
    },
  });
}

// Helper for mocking responses for testing async functions
export function createMockResponse<T>(data: T, delay = 0) {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

// Helper for creating mock Kenmei manga data
export function createMockKenmeiManga(overrides = {}) {
  return {
    id: 1,
    title: "Test Manga",
    status: "reading",
    score: 8,
    chapters_read: 100,
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-05-15T00:00:00Z",
    ...overrides,
  };
}

// Helper for creating mock AniList manga data
export function createMockAniListManga(overrides = {}) {
  return {
    id: 101,
    title: {
      english: "Test Manga",
      romaji: "Test Manga",
      native: "テストマンガ",
    },
    description: "A test manga for testing",
    coverImage: {
      large: "https://example.com/test.jpg",
    },
    format: "MANGA",
    status: "RELEASING",
    ...overrides,
  };
}

// Helper to wait for promises to resolve
export async function waitForPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Helper to mock date and time
export function mockDate(mockDate: Date) {
  const originalDate = global.Date;

  // Use a properly typed class extension
  const MockDate = class extends Date {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(mockDate.getTime());
        return this;
      }
      // Use apply instead of spread operator
      return Reflect.construct(originalDate, args);
    }

    static now() {
      return mockDate.getTime();
    }
  };

  global.Date = MockDate as typeof Date;

  return () => {
    global.Date = originalDate;
  };
}
