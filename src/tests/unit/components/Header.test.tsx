import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Header } from "../../../components/layout/Header";
import * as windowHelpers from "../../../helpers/window_helpers";

// Mock the window helpers
vi.mock("../../../helpers/window_helpers", () => ({
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

// Mock ToggleTheme component
vi.mock("../../../components/ToggleTheme", () => ({
  default: () => <div data-testid="toggle-theme">Toggle Theme</div>,
}));

// Define props type for the mocked Link component
interface LinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

// Mock react-router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: LinkProps) => (
    <a href={to} className={className} data-to={to}>
      {children}
    </a>
  ),
}));

describe("Header", () => {
  it("renders the app logo and title", () => {
    // Act
    render(<Header />);

    // Assert
    expect(screen.getByAltText("K2A Logo")).toBeInTheDocument();
    expect(screen.getByText("Kenmei to AniList")).toBeInTheDocument();
    expect(screen.getByText("K2A")).toBeInTheDocument();
  });

  it("renders all navigation menu items", () => {
    // Act
    render(<Header />);

    // Assert
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Sync")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders the theme toggle", () => {
    // Act
    render(<Header />);

    // Assert
    expect(screen.getByTestId("toggle-theme")).toBeInTheDocument();
  });

  it("calls minimizeWindow when minimize button is clicked", () => {
    // Act
    render(<Header />);
    // Find by SVG role and handle click
    const buttons = screen.getAllByRole("button");
    const minimizeButton = buttons.find((button) =>
      button.querySelector(".lucide-minimize-2"),
    );

    if (minimizeButton) {
      fireEvent.click(minimizeButton);
      // Assert
      expect(windowHelpers.minimizeWindow).toHaveBeenCalled();
    } else {
      // If we can't find the button, the test should fail
      expect(minimizeButton).toBeDefined();
    }
  });

  it("calls maximizeWindow when maximize button is clicked", () => {
    // Act
    render(<Header />);
    // Find by SVG role and handle click
    const buttons = screen.getAllByRole("button");
    const maximizeButton = buttons.find((button) =>
      button.querySelector(".lucide-maximize-2"),
    );

    if (maximizeButton) {
      fireEvent.click(maximizeButton);
      // Assert
      expect(windowHelpers.maximizeWindow).toHaveBeenCalled();
    } else {
      // If we can't find the button, the test should fail
      expect(maximizeButton).toBeDefined();
    }
  });

  it("calls closeWindow when close button is clicked", () => {
    // Act
    render(<Header />);
    // Find by SVG role and handle click
    const buttons = screen.getAllByRole("button");
    const closeButton = buttons.find((button) =>
      button.querySelector(".lucide-x"),
    );

    if (closeButton) {
      fireEvent.click(closeButton);
      // Assert
      expect(windowHelpers.closeWindow).toHaveBeenCalled();
    } else {
      // If we can't find the button, the test should fail
      expect(closeButton).toBeDefined();
    }
  });

  it("has navigation links with correct routes", () => {
    // Act
    render(<Header />);

    // Assert - get the navigation links by role
    const links = screen.getAllByRole("link");

    // Find each navigation link
    const homeLink = links.find((link) => link.textContent?.includes("Home"));
    const importLink = links.find((link) =>
      link.textContent?.includes("Import"),
    );
    const reviewLink = links.find((link) =>
      link.textContent?.includes("Review"),
    );
    const syncLink = links.find((link) => link.textContent?.includes("Sync"));
    const settingsLink = links.find((link) =>
      link.textContent?.includes("Settings"),
    );

    // Check that links exist
    expect(homeLink).toBeDefined();
    expect(importLink).toBeDefined();
    expect(reviewLink).toBeDefined();
    expect(syncLink).toBeDefined();
    expect(settingsLink).toBeDefined();

    // Check that they have the correct routes
    expect(homeLink?.getAttribute("href")).toBe("/");
    expect(importLink?.getAttribute("href")).toBe("/import");
    expect(reviewLink?.getAttribute("href")).toBe("/review");
    expect(syncLink?.getAttribute("href")).toBe("/sync");
    expect(settingsLink?.getAttribute("href")).toBe("/settings");
  });
});
