import * as React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileDropZone } from "../../../components/import/FileDropZone";
import { ErrorType } from "../../../utils/errorHandling";

// Mock the parseKenmeiCsvExport function
vi.mock("../../../api/kenmei/parser", () => ({
  parseKenmeiCsvExport: vi.fn((content) => {
    if (content === "valid,csv,content") {
      return {
        export_date: "2023-01-01",
        manga: [
          {
            title: "Test Manga",
            status: "Reading",
            score: 8,
            chapters_read: 10,
            volumes_read: 2,
            created_at: "2023-01-01",
            updated_at: "2023-01-02",
            notes: "Test notes",
            url: "https://example.com",
          },
        ],
      };
    } else if (content === "empty,csv,content") {
      // Return an empty manga array to test that case
      return {
        export_date: "2023-01-01",
        manga: [],
      };
    } else if (content === "null,content") {
      // Return null to test that case
      return null;
    }
    throw new Error("Invalid CSV content");
  }),
}));

describe("FileDropZone", () => {
  // Mock functions
  const onFileLoaded = vi.fn();
  const onError = vi.fn();

  // Mock FileReader
  const originalFileReader = global.FileReader;
  let fileReaderInstance: any;

  // Mock setInterval and clearInterval
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const mockIntervalId = 999;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the mocked FileReader
    fileReaderInstance = {
      readAsText: vi.fn(),
      onload: null,
      onerror: null,
      result: null,
    };

    // @ts-expect-error Mock the FileReader
    global.FileReader = vi.fn(() => fileReaderInstance);

    // Mock setInterval and clearInterval
    global.setInterval = vi.fn(() => mockIntervalId);
    global.clearInterval = vi.fn();
  });

  afterEach(() => {
    // Restore the original FileReader
    global.FileReader = originalFileReader;

    // Restore the original interval functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  it("renders the empty state correctly", () => {
    // Act
    render(<FileDropZone onFileLoaded={onFileLoaded} onError={onError} />);

    // Assert
    expect(screen.getByText("Upload Kenmei CSV Export")).toBeInTheDocument();
    expect(
      screen.getByText(/Drag and drop your Kenmei CSV export file here/),
    ).toBeInTheDocument();
  });

  it("changes styles when dragging a file", () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    // The main drop zone is the outermost div that has the onDragOver handler
    const dropZone = container.firstChild as HTMLElement;

    // Act - simulate drag over
    act(() => {
      fireEvent.dragOver(dropZone);
    });

    // Assert - should have the "dragging" class applied
    expect(dropZone).toHaveClass("border-primary/50");
    expect(dropZone).toHaveClass("bg-primary/5");

    // Act - simulate drag leave
    act(() => {
      fireEvent.dragLeave(dropZone);
    });

    // Assert - should revert back to default style
    expect(dropZone).not.toHaveClass("border-primary/50");
    expect(dropZone).not.toHaveClass("bg-primary/5");
  });

  it("handles file drop with valid CSV file", async () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    const dropZone = container.firstChild as HTMLElement;
    const file = new File(["valid,csv,content"], "test.csv", {
      type: "text/csv",
    });

    // Act - simulate file drop
    act(() => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Simulate FileReader success
    act(() => {
      fileReaderInstance.result = "valid,csv,content";
      fileReaderInstance.onload({ target: fileReaderInstance });
    });

    // Assert
    expect(onFileLoaded).toHaveBeenCalledTimes(1);
    expect(onFileLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "1.0.0",
        exported_at: "2023-01-01",
        manga: [
          expect.objectContaining({
            title: "Test Manga",
            status: "Reading",
          }),
        ],
      }),
    );
    expect(onError).not.toHaveBeenCalled();
    expect(global.clearInterval).toHaveBeenCalled();
  });

  it("shows an error for invalid file type", () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    const dropZone = container.firstChild as HTMLElement;
    const file = new File(["invalid"], "test.txt", { type: "text/plain" });

    // Act - simulate file drop
    act(() => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Assert
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ErrorType.VALIDATION,
        message: "Invalid file format. Please upload a CSV file.",
      }),
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
    expect(global.clearInterval).toHaveBeenCalled();
  });

  it("shows an error for file that is too large", () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    const dropZone = container.firstChild as HTMLElement;

    // Create a mock file with size larger than 10MB
    const largeFile = new File([""], "large.csv", { type: "text/csv" });
    Object.defineProperty(largeFile, "size", { value: 11 * 1024 * 1024 });

    // Act - simulate file drop
    act(() => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [largeFile],
        },
      });
    });

    // Assert
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ErrorType.VALIDATION,
        message: "File is too large. Maximum size is 10MB.",
      }),
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
    expect(global.clearInterval).toHaveBeenCalled();
  });

  it("shows an error when FileReader fails", async () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    const dropZone = container.firstChild as HTMLElement;
    const file = new File(["invalid,csv"], "test.csv", { type: "text/csv" });

    // Act - simulate file drop
    act(() => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Simulate FileReader error
    act(() => {
      fileReaderInstance.onerror();
    });

    // Assert
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ErrorType.UNKNOWN,
        message: "Error reading file. Please try again.",
      }),
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
    expect(global.clearInterval).toHaveBeenCalled();
  });

  it("handles click to open file dialog", () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    const dropZone = container.firstChild as HTMLElement;
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    // Mock the click method
    const clickSpy = vi.spyOn(fileInput, "click");

    // Act
    fireEvent.click(dropZone);

    // Assert
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles file selection through the file input", () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["valid,csv,content"], "test.csv", {
      type: "text/csv",
    });

    // Act - simulate file selection
    act(() => {
      fireEvent.change(fileInput, {
        target: {
          files: [file],
        },
      });
    });

    // Simulate FileReader success
    act(() => {
      fileReaderInstance.result = "valid,csv,content";
      fileReaderInstance.onload({ target: fileReaderInstance });
    });

    // Assert
    expect(onFileLoaded).toHaveBeenCalled();
  });

  it("should correctly format file sizes", async () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );

    // Create files of different sizes
    const smallFile = new File(["small"], "small.csv", { type: "text/csv" });
    Object.defineProperty(smallFile, "size", { value: 500 }); // 500 bytes

    const mediumFile = new File(["medium"], "medium.csv", { type: "text/csv" });
    Object.defineProperty(mediumFile, "size", { value: 1024 * 500 }); // 500 KB

    const largeFile = new File(["large"], "large.csv", { type: "text/csv" });
    Object.defineProperty(largeFile, "size", { value: 1024 * 1024 * 5 }); // 5 MB

    // Drop small file
    act(() => {
      fireEvent.drop(container.firstChild as HTMLElement, {
        dataTransfer: { files: [smallFile] },
      });
    });

    // Verify file information is displayed
    expect(await screen.findByText("small.csv")).toBeInTheDocument();
    expect(await screen.findByText("500 bytes")).toBeInTheDocument();

    // Reset component
    vi.clearAllMocks();
    render(<FileDropZone onFileLoaded={onFileLoaded} onError={onError} />);

    // Drop medium file
    act(() => {
      fireEvent.drop(container.firstChild as HTMLElement, {
        dataTransfer: { files: [mediumFile] },
      });
    });

    // Verify KB formatting
    expect(await screen.findByText("medium.csv")).toBeInTheDocument();
    expect(await screen.findByText("500.0 KB")).toBeInTheDocument();

    // Reset component
    vi.clearAllMocks();
    render(<FileDropZone onFileLoaded={onFileLoaded} onError={onError} />);

    // Drop large file
    act(() => {
      fireEvent.drop(container.firstChild as HTMLElement, {
        dataTransfer: { files: [largeFile] },
      });
    });

    // Verify MB formatting
    expect(await screen.findByText("large.csv")).toBeInTheDocument();
    expect(await screen.findByText("5.0 MB")).toBeInTheDocument();
  });

  it("handles parsing errors for empty manga data", () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    const dropZone = container.firstChild as HTMLElement;
    const file = new File(["empty,csv,content"], "test.csv", {
      type: "text/csv",
    });

    // Act - simulate file drop
    act(() => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Simulate FileReader success but with empty manga array
    act(() => {
      fileReaderInstance.result = "empty,csv,content";
      fileReaderInstance.onload({ target: fileReaderInstance });
    });

    // Assert
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ErrorType.VALIDATION,
        message:
          "No manga entries found in the CSV file. Please check the file format.",
      }),
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
  });

  it("handles parsing errors for null data", () => {
    // Arrange
    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );
    const dropZone = container.firstChild as HTMLElement;
    const file = new File(["null,content"], "test.csv", { type: "text/csv" });

    // Act - simulate file drop
    act(() => {
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    // Simulate FileReader success but with null return
    act(() => {
      fileReaderInstance.result = "null,content";
      fileReaderInstance.onload({ target: fileReaderInstance });
    });

    // Assert
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ErrorType.VALIDATION,
        message:
          "No manga entries found in the CSV file. Please check the file format.",
      }),
    );
    expect(onFileLoaded).not.toHaveBeenCalled();
  });

  it("handles the progress simulation correctly", async () => {
    // Mock implementation for setInterval to call the callback immediately once
    const mockProgressCallback = vi.fn();
    (global.setInterval as any).mockImplementation((callback: any) => {
      mockProgressCallback.mockImplementation(callback);
      return 123;
    });

    const { container } = render(
      <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />,
    );

    const file = new File(["valid,csv,content"], "test.csv", {
      type: "text/csv",
    });

    // Drop the file to start the process
    act(() => {
      fireEvent.drop(container.firstChild as HTMLElement, {
        dataTransfer: { files: [file] },
      });
    });

    // Progress should start at 10%
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();

    // Simulate progress update (calling the interval callback multiple times)
    // First call moves from 10 to 20
    act(() => {
      mockProgressCallback();
    });

    // Simulate progress to 80 (limit)
    for (let i = 0; i < 7; i++) {
      act(() => {
        mockProgressCallback();
      });
    }

    // Complete the process
    act(() => {
      fileReaderInstance.result = "valid,csv,content";
      fileReaderInstance.onload({ target: fileReaderInstance });
    });

    // Should clear the interval
    expect(global.clearInterval).toHaveBeenCalled();
  });
});
