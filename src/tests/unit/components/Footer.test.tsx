import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Footer } from "../../../components/layout/Footer";

// Mock the app version utility
vi.mock("../../../utils/app-version", () => ({
  getAppVersion: () => "1.0.0",
}));

// Mock the Electron API
const mockOpenExternal = vi.fn();
beforeEach(() => {
  window.electronAPI = {
    shell: {
      openExternal: mockOpenExternal,
    },
  } as any;
  vi.clearAllMocks();
});

describe("Footer", () => {
  it("renders the app name and version", () => {
    // Act
    render(<Footer />);

    // Assert
    expect(screen.getByText("Kenmei to AniList")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders social links", () => {
    // Act
    render(<Footer />);

    // Assert
    expect(screen.getByRole("button", { name: "GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact" })).toBeInTheDocument();
  });

  it("opens GitHub link in external browser when clicked", () => {
    // Act
    render(<Footer />);
    fireEvent.click(screen.getByRole("button", { name: "GitHub" }));

    // Assert
    expect(mockOpenExternal).toHaveBeenCalledWith(
      "https://github.com/RLAlpha49/KenmeiToAnilist",
    );
  });

  it("opens email link when contact button is clicked", () => {
    // Act
    render(<Footer />);
    fireEvent.click(screen.getByRole("button", { name: "Contact" }));

    // Assert
    expect(mockOpenExternal).toHaveBeenCalledWith("mailto:contact@alpha49.com");
  });

  it("renders the copyright text with current year", () => {
    // Act
    render(<Footer />);

    // Assert
    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(`© ${currentYear}`)).toBeInTheDocument();
  });

  it("renders the 'Made with love' message", () => {
    // Act
    render(<Footer />);

    // Assert
    expect(screen.getByText("Made with")).toBeInTheDocument();
    expect(screen.getByText("for manga readers")).toBeInTheDocument();
  });
});
