import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ToggleTheme from "@/components/ToggleTheme";
import { useTheme } from "@/contexts/ThemeContext";

// Mock the ThemeContext
vi.mock("@/contexts/ThemeContext", () => {
  const toggleTheme = vi.fn().mockResolvedValue(true);
  return {
    useTheme: vi.fn(() => ({
      isDarkMode: false,
      toggleTheme,
    })),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

describe("ToggleTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with the correct icon based on theme", () => {
    // Mock light mode
    (useTheme as jest.Mock).mockReturnValue({
      isDarkMode: false,
      toggleTheme: vi.fn().mockResolvedValue(true),
    });

    render(<ToggleTheme />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle theme")).toBeInTheDocument();

    // Test dark mode
    (useTheme as jest.Mock).mockReturnValue({
      isDarkMode: true,
      toggleTheme: vi.fn().mockResolvedValue(false),
    });

    render(<ToggleTheme />);
    expect(screen.getAllByRole("button")[1]).toBeInTheDocument();
  });

  it("calls toggleTheme when clicked", async () => {
    const toggleTheme = vi.fn().mockResolvedValue(true);
    (useTheme as jest.Mock).mockReturnValue({
      isDarkMode: false,
      toggleTheme,
    });

    render(<ToggleTheme />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });
});
