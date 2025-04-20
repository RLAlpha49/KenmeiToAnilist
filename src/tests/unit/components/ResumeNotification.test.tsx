import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResumeNotification } from "../../../components/matching/ResumeNotification";

describe("ResumeNotification", () => {
  it("renders notification with correct count", () => {
    // Arrange
    const onResumeMatching = vi.fn();
    const onCancelResume = vi.fn();
    const pendingMangaCount = 15;

    // Act
    render(
      <ResumeNotification
        pendingMangaCount={pendingMangaCount}
        onResumeMatching={onResumeMatching}
        onCancelResume={onCancelResume}
      />,
    );

    // Assert
    expect(
      screen.getByText("Unfinished Matching Process Detected"),
    ).toBeInTheDocument();
    expect(screen.getByText(/We found 15 manga/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Resume Matching/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("does not render anything when pendingMangaCount is 0", () => {
    // Arrange
    const onResumeMatching = vi.fn();
    const onCancelResume = vi.fn();
    const pendingMangaCount = 0;

    // Act
    const { container } = render(
      <ResumeNotification
        pendingMangaCount={pendingMangaCount}
        onResumeMatching={onResumeMatching}
        onCancelResume={onCancelResume}
      />,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onResumeMatching when Resume button is clicked", () => {
    // Arrange
    const onResumeMatching = vi.fn();
    const onCancelResume = vi.fn();
    const pendingMangaCount = 5;

    // Act
    render(
      <ResumeNotification
        pendingMangaCount={pendingMangaCount}
        onResumeMatching={onResumeMatching}
        onCancelResume={onCancelResume}
      />,
    );

    // Click the resume button
    fireEvent.click(screen.getByRole("button", { name: /Resume Matching/i }));

    // Assert
    expect(onResumeMatching).toHaveBeenCalledTimes(1);
    expect(onCancelResume).not.toHaveBeenCalled();
  });

  it("calls onCancelResume when Cancel button is clicked", () => {
    // Arrange
    const onResumeMatching = vi.fn();
    const onCancelResume = vi.fn();
    const pendingMangaCount = 5;

    // Act
    render(
      <ResumeNotification
        pendingMangaCount={pendingMangaCount}
        onResumeMatching={onResumeMatching}
        onCancelResume={onCancelResume}
      />,
    );

    // Click the cancel button
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    // Assert
    expect(onCancelResume).toHaveBeenCalledTimes(1);
    expect(onResumeMatching).not.toHaveBeenCalled();
  });
});
