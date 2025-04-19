// Mock providers and Router for App component
vi.mock("@/contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/contexts/RateLimitContext", () => ({
  RateLimitProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    RouterProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    router: {},
  };
});
vi.mock("@/components/ui/sonner-provider", () => ({
  SonnerProvider: () => null,
}));

// Stub createRoot for mount logic
vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

import React from "react";
import { render } from "@testing-library/react";
import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import App from "@/App";
import { createRoot as createRootMock } from "react-dom/client";

// Stub window.matchMedia for Sonner UI components and themeMode API
beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as any);
  (window as any).themeMode = {
    current: vi.fn().mockResolvedValue("light"),
    dark: vi.fn().mockResolvedValue(undefined),
    light: vi.fn().mockResolvedValue(undefined),
    system: vi.fn().mockResolvedValue(false),
    toggle: vi.fn().mockResolvedValue(undefined),
  };
});

describe("App component", () => {
  it("renders without crashing", () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });
});

describe("App mount logic", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    (createRootMock as any).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("mounts App into #app when container exists", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    // Import triggers mount code
    await import("@/App");
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("app"));
    const root = (createRootMock as any).mock.results[0].value;
    expect(root.render).toHaveBeenCalled();
  });

  it("does not mount App when container is absent", async () => {
    document.body.innerHTML = "";
    await import("@/App");
    expect(createRootMock).not.toHaveBeenCalled();
  });
});
