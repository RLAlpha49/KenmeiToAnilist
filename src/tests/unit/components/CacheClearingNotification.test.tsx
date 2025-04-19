import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CacheClearingNotification } from "../../../components/matching/CacheClearingNotification";

// Mock framer-motion to prevent animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className }: any) => (
      <div className={className} data-testid="motion-div">
        {children}
      </div>
    ),
  },
}));

describe("CacheClearingNotification", () => {
  it("renders with correct count for a single manga", () => {
    // Arrange & Act
    render(<CacheClearingNotification cacheClearingCount={1} />);

    // Assert
    expect(screen.getByText("Clearing Cache")).toBeInTheDocument();
    expect(
      screen.getByText("Please wait while we clear cache for 1 selected manga"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This may take a moment. We're preparing fresh searches from AniList.",
      ),
    ).toBeInTheDocument();
  });

  it("renders with correct count for multiple manga", () => {
    // Arrange & Act
    render(<CacheClearingNotification cacheClearingCount={42} />);

    // Assert
    expect(
      screen.getByText(
        "Please wait while we clear cache for 42 selected manga",
      ),
    ).toBeInTheDocument();
  });

  it("displays loader animation", () => {
    // Arrange & Act
    render(<CacheClearingNotification cacheClearingCount={5} />);

    // Assert
    // Check for the loader icon
    const loaderIcon = document.querySelector(".animate-spin");
    expect(loaderIcon).toBeInTheDocument();

    // Verify progress element exists
    const progressElement = document.querySelector(
      ".overflow-hidden.rounded-full",
    );
    expect(progressElement).toBeInTheDocument();
  });

  it("renders as a fixed overlay", () => {
    // Arrange & Act
    render(<CacheClearingNotification cacheClearingCount={3} />);

    // Assert
    // Check for fixed positioning classes
    const overlayElement = screen.getAllByTestId("motion-div")[0];
    expect(overlayElement.className).toContain("fixed");
    expect(overlayElement.className).toContain("inset-0");
    expect(overlayElement.className).toContain("z-50");

    // Check for backdrop
    const backdropElement = document.querySelector(".absolute.inset-0");
    expect(backdropElement).toBeInTheDocument();
  });
});
