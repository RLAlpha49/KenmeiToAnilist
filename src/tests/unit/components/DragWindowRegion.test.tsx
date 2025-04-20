import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DragWindowRegion from "@/components/DragWindowRegion";
import * as windowHelpers from "@/helpers/window_helpers";

// Mock window helper functions
vi.mock("@/helpers/window_helpers", () => ({
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

describe("DragWindowRegion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without a title", () => {
    const { container } = render(<DragWindowRegion />);

    // Check that the component renders with drag layer
    expect(container.querySelector(".draglayer")).toBeInTheDocument();

    // When no title is provided, there shouldn't be a title element with text
    const titleElement = container.querySelector(".flex.flex-1.p-2.text-xs");
    expect(titleElement).toBeNull();
  });

  it("renders with a title", () => {
    const title = "Window Title";
    render(<DragWindowRegion title={title} />);

    // Check title is rendered
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("calls minimizeWindow when minimize button is clicked", () => {
    render(<DragWindowRegion />);

    // Find the minimize button by its title
    const minimizeButton = screen.getByTitle("Minimize");
    fireEvent.click(minimizeButton);

    // Check that the minimize function was called
    expect(windowHelpers.minimizeWindow).toHaveBeenCalledTimes(1);
  });

  it("calls maximizeWindow when maximize button is clicked", () => {
    render(<DragWindowRegion />);

    // Find the maximize button by its title
    const maximizeButton = screen.getByTitle("Maximize");
    fireEvent.click(maximizeButton);

    // Check that the maximize function was called
    expect(windowHelpers.maximizeWindow).toHaveBeenCalledTimes(1);
  });

  it("calls closeWindow when close button is clicked", () => {
    render(<DragWindowRegion />);

    // Find the close button by its title
    const closeButton = screen.getByTitle("Close");
    fireEvent.click(closeButton);

    // Check that the close function was called
    expect(windowHelpers.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("renders with React node as title", () => {
    const TitleComponent = () => (
      <span data-testid="title-component">Complex Title</span>
    );
    render(<DragWindowRegion title={<TitleComponent />} />);

    // Check that the custom component is rendered
    expect(screen.getByTestId("title-component")).toBeInTheDocument();
    expect(screen.getByText("Complex Title")).toBeInTheDocument();
  });
});
