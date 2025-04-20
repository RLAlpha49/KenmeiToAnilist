import { vi, describe, it, expect, beforeAll } from "vitest";

// Stub react-dom/client createRoot to avoid mount side-effects
vi.mock("react-dom/client", () => ({
  __esModule: true,
  createRoot: () => ({ render: () => {} }),
}));

// Stub context exposer for preload side-effect
const exposeContextsMock = vi.fn();
vi.mock("@/helpers/ipc/context-exposer", () => ({
  __esModule: true,
  default: exposeContextsMock,
}));

// Provide #app container for App mount logic
beforeAll(() => {
  const container = document.createElement("div");
  container.id = "app";
  document.body.appendChild(container);
});

// Test App import
describe("App entry point", () => {
  it("imports App without throwing", async () => {
    await expect(import("@/App")).resolves.toBeDefined();
  });
});

// Test preload import
describe("preload entry point", () => {
  it("calls exposeContexts on import", async () => {
    await import("@/preload");
    expect(exposeContextsMock).toHaveBeenCalled();
  });
});

// Test renderer import
describe("renderer entry point", () => {
  it("imports renderer without throwing", async () => {
    await expect(import("@/renderer")).resolves.toBeDefined();
  });
});
