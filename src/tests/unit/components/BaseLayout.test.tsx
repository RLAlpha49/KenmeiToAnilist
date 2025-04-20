import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BaseLayout from "../../../components/layout/BaseLayout";

// Mock the Header and Footer components
vi.mock("../../../components/layout/Header", () => ({
  Header: () => <div data-testid="mock-header">Header</div>,
}));

vi.mock("../../../components/layout/Footer", () => ({
  Footer: () => <div data-testid="mock-footer">Footer</div>,
}));

describe("BaseLayout", () => {
  it("renders the header, footer and children correctly", () => {
    // Arrange
    const childText = "Child Content";

    // Act
    render(
      <BaseLayout>
        <div data-testid="child-content">{childText}</div>
      </BaseLayout>,
    );

    // Assert
    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toHaveTextContent(childText);
  });

  it("applies the correct CSS classes", () => {
    // Act
    render(
      <BaseLayout>
        <div>Test</div>
      </BaseLayout>,
    );

    // Assert
    // Check the main container has the expected classes
    const mainContainer = screen.getByRole("main");
    expect(mainContainer).toHaveClass("flex-1");
    expect(mainContainer).toHaveClass("overflow-auto");
    expect(mainContainer).toHaveClass("p-4");

    // Check the root div has the expected classes
    const rootDiv = mainContainer.parentElement;
    expect(rootDiv).toHaveClass("bg-background");
    expect(rootDiv).toHaveClass("text-foreground");
    expect(rootDiv).toHaveClass("flex");
    expect(rootDiv).toHaveClass("h-screen");
    expect(rootDiv).toHaveClass("flex-col");
  });
});
