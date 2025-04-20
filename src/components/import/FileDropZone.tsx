import React, { useState, useRef } from "react";
import { UploadCloud, File, FileText } from "lucide-react";
import { Button } from "../ui/button";
import { KenmeiData } from "../../types/kenmei";
import { createError, ErrorType, AppError } from "../../utils/errorHandling";
import { parseKenmeiCsvExport } from "../../api/kenmei/parser";
import { Progress } from "../ui/progress";

interface FileDropZoneProps {
  onFileLoaded: (data: KenmeiData) => void;
  onError: (error: AppError) => void;
}

export function FileDropZone({ onFileLoaded, onError }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setFileSize(file.size);
    setIsLoading(true);
    setLoadingProgress(10);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        // Cap the progress at 80% before file is actually processed
        return prev < 80 ? prev + 10 : 80;
      });
    }, 500);

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setIsLoading(false);
      clearInterval(progressInterval);
      onError(
        createError(
          ErrorType.VALIDATION,
          "Invalid file format. Please upload a CSV file.",
        ),
      );
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setIsLoading(false);
      clearInterval(progressInterval);
      onError(
        createError(
          ErrorType.VALIDATION,
          "File is too large. Maximum size is 10MB.",
        ),
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        clearInterval(progressInterval);
        setLoadingProgress(100);

        if (!event.target?.result) {
          throw new Error("Failed to read file");
        }

        const content = event.target.result as string;

        // Use our parser function from api/kenmei/parser.ts
        const parsedData = parseKenmeiCsvExport(content);

        if (!parsedData || !parsedData.manga || parsedData.manga.length === 0) {
          onError(
            createError(
              ErrorType.VALIDATION,
              "No manga entries found in the CSV file. Please check the file format.",
            ),
          );
          return;
        }

        // Convert to our app's expected format
        const kenmeiData: KenmeiData = {
          version: "1.0.0",
          exported_at: parsedData.export_date,
          manga: parsedData.manga.map((manga) => ({
            title: manga.title,
            status: manga.status,
            score: manga.score,
            chapters_read: manga.chapters_read,
            volumes_read: manga.volumes_read,
            created_at: manga.created_at,
            updated_at: manga.updated_at,
            notes: manga.notes,
            url: manga.url,
          })),
        };

        setIsLoading(false);
        onFileLoaded(kenmeiData);
      } catch (err) {
        console.error("CSV parsing error:", err);
        setIsLoading(false);
        onError(
          createError(
            ErrorType.VALIDATION,
            "Failed to parse CSV file. Please ensure it's a valid Kenmei export file.",
          ),
        );
      }
    };

    reader.onerror = () => {
      clearInterval(progressInterval);
      setIsLoading(false);
      onError(
        createError(ErrorType.UNKNOWN, "Error reading file. Please try again."),
      );
    };

    reader.readAsText(file);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${
        isDragging
          ? "border-primary/50 bg-primary/5"
          : "border-border/50 hover:border-primary/30 hover:bg-muted/50"
      }`}
      onClick={handleButtonClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      {!fileName ? (
        // Empty state - show upload instructions
        <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
          <div className="bg-primary/10 text-primary mb-2 rounded-full p-3">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-medium">Upload Kenmei CSV Export</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            Drag and drop your Kenmei CSV export file here
          </p>

          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                handleButtonClick();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Browse Files
            </Button>
          </div>
        </div>
      ) : (
        // File selected state
        <div className="flex w-full flex-col items-center p-6 text-center">
          {isLoading ? (
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center justify-center">
                <div className="bg-primary/20 mr-3 h-10 w-10 animate-pulse rounded-full">
                  <File className="text-primary/50 h-10 w-10" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-medium">{fileName}</h3>
                  <p className="text-muted-foreground text-xs">
                    {fileSize && formatFileSize(fileSize)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={loadingProgress} className="h-1.5 w-full" />
                <p className="text-muted-foreground text-xs">
                  Processing file...
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <File className="text-primary h-8 w-8" />
              </div>
              <h3 className="mb-1 text-lg font-medium">{fileName}</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                {fileSize && formatFileSize(fileSize)}
              </p>
              <Button
                size="sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                    fileInputRef.current.click();
                  }
                }}
              >
                Choose Different File
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
