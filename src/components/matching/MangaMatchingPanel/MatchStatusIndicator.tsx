import React from "react";
import { ExternalLink } from "lucide-react";
import type { MangaMatchResult } from "../../../api/anilist/types";

export interface MatchStatusIndicatorProps {
  match: MangaMatchResult;
  formatStatusText: (status?: string) => string;
  createKenmeiUrl: (title?: string | null) => string | null;
  handleOpenExternal: (url: string) => (e: React.MouseEvent) => void;
}

export default function MatchStatusIndicator({
  match,
  formatStatusText,
  createKenmeiUrl,
  handleOpenExternal,
}: MatchStatusIndicatorProps) {
  const headerIconData = [
    {
      value: match.kenmeiManga.chapters_read || 0,
      icon: "chapters",
      text: "chapters read",
    },
    {
      value: match.kenmeiManga.score,
      icon: "star",
      text: "score",
      hideIfZero: true,
    },
  ].filter((data) => !data.hideIfZero || data.value > 0);

  let statusColorClass = "";
  switch (match.kenmeiManga.status?.toLowerCase()) {
    case "reading":
      statusColorClass = "text-green-600 dark:text-green-400";
      break;
    case "completed":
      statusColorClass = "text-blue-600 dark:text-blue-400";
      break;
    case "on_hold":
      statusColorClass = "text-amber-600 dark:text-amber-400";
      break;
    case "dropped":
      statusColorClass = "text-red-600 dark:text-red-400";
      break;
    case "plan_to_read":
      statusColorClass = "text-purple-600 dark:text-purple-400";
      break;
    default:
      statusColorClass = "text-gray-600 dark:text-gray-400";
      break;
  }

  const kenmeiUrl = createKenmeiUrl(match.kenmeiManga.title);

  return (
    <div className="flex flex-col items-end">
      <div className="text-muted-foreground line-clamp-1 text-xs">
        <span className={statusColorClass}>
          {formatStatusText(match.kenmeiManga.status)}
        </span>
        {headerIconData.map((data) => (
          <React.Fragment key={`badge-${data.icon}-${data.text}`}>
            <span className="mx-1">•</span>
            <span className={`inline-flex items-center`}>
              <span>{data.value}</span>
              <span className="ml-1">{data.text}</span>
            </span>
          </React.Fragment>
        ))}
      </div>

      {kenmeiUrl && (
        <div className="mt-1 flex items-center">
          <a
            href={kenmeiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            aria-label="View on Kenmei (opens in external browser)"
            onClick={handleOpenExternal(kenmeiUrl)}
          >
            <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
            View on Kenmei
          </a>
        </div>
      )}
    </div>
  );
}
