import { vi } from "vitest";

// Mock Electron's dialog module for file selection
export function mockElectronDialog(
  options: { canceled?: boolean; filePaths?: string[] } = {},
) {
  const { canceled = false, filePaths = ["/mock/path/to/file.csv"] } = options;

  return {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled, filePaths }),
    showSaveDialog: vi
      .fn()
      .mockResolvedValue({ canceled, filePath: filePaths[0] }),
  };
}

// Mock Electron's fs module for file operations
export function mockElectronFs(fileContent = "") {
  return {
    readFile: vi.fn().mockResolvedValue(fileContent),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
}

// Create a mock CSV content for Kenmei export
export function createMockKenmeiCsv(entryCount = 5) {
  const header =
    "id,title,status,score,chapters_read,url,created_at,updated_at";
  const rows = [];

  const statuses = [
    "reading",
    "completed",
    "plan_to_read",
    "on_hold",
    "dropped",
  ];

  for (let i = 1; i <= entryCount; i++) {
    const status = statuses[i % statuses.length];
    const score =
      status === "plan_to_read" ? 0 : Math.floor(Math.random() * 10) + 1;
    const chaptersRead =
      status === "plan_to_read"
        ? 0
        : status === "completed"
          ? 100
          : Math.floor(Math.random() * 100);

    rows.push(
      `${i},"Test Manga ${i}","${status}",${score},${chaptersRead},"https://example.com/manga/${i}","2023-01-0${i}","2023-02-0${i}"`,
    );
  }

  return [header, ...rows].join("\n");
}

// Parse a mock CSV string into Kenmei manga objects
export function parseMockKenmeiCsv(csvContent: string) {
  const lines = csvContent.split("\n");
  const header = lines[0].split(",");

  return lines.slice(1).map((line) => {
    // Split by comma, but respect quotes
    const values: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(currentValue);
        currentValue = "";
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue);

    // Create object from header and values
    const entry: Record<string, any> = {};
    header.forEach((key, index) => {
      // Convert to appropriate type
      const value = values[index].replace(/^"|"$/g, ""); // Remove quotes

      if (key === "id" || key === "chapters_read") {
        entry[key] = parseInt(value, 10);
      } else if (key === "score") {
        entry[key] = parseFloat(value);
      } else {
        entry[key] = value;
      }
    });

    return entry;
  });
}

// Mock file drop event for file upload testing
export function createMockFileDropEvent(files: File[]) {
  const event = new Event("drop", { bubbles: true });

  Object.defineProperty(event, "dataTransfer", {
    value: {
      files,
      items: files.map((file) => ({
        kind: "file",
        type: file.type,
        getAsFile: () => file,
      })),
      types: ["Files"],
    },
  });

  return event;
}

// Create a mock File object
export function createMockFile(
  name: string,
  content: string,
  type = "text/csv",
) {
  return new File([content], name, { type });
}

// Helper for creating a temporary file path
export function createTempFilePath(prefix = "test", extension = ".csv") {
  const randomId = Math.random().toString(36).substring(2, 10);
  return `/tmp/${prefix}-${randomId}${extension}`;
}

// Helper for mocking a file reader result
export function mockFileReaderResult(file: File, result: string | ArrayBuffer) {
  // Mock the FileReader
  const originalFileReader = window.FileReader;

  class MockFileReader {
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
      null;
    result: string | ArrayBuffer | null = null;
    readAsText(): void {
      setTimeout(() => {
        this.result = result;
        if (this.onload) {
          this.onload.call(
            this as unknown as FileReader,
            { target: this } as unknown as ProgressEvent<FileReader>,
          );
        }
      }, 0);
    }
    readAsArrayBuffer(): void {
      setTimeout(() => {
        this.result = result;
        if (this.onload) {
          this.onload.call(
            this as unknown as FileReader,
            { target: this } as unknown as ProgressEvent<FileReader>,
          );
        }
      }, 0);
    }
  }

  // Replace the FileReader
  Object.defineProperty(window, "FileReader", {
    value: MockFileReader,
    writable: true,
  });

  // Return a cleanup function to restore the original FileReader
  return () => {
    Object.defineProperty(window, "FileReader", {
      value: originalFileReader,
      writable: true,
    });
  };
}
