import React from "react";
import { motion } from "framer-motion";
import type {
  MangaMatchResult,
  AniListManga,
  MediaListStatus,
  AniListMediaEntry,
  UserMediaEntry,
} from "../../../api/anilist/types";
import type { KenmeiManga } from "../../../api/kenmei/types";
import { Check, ExternalLink, ChevronRight, Info } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { createKenmeiUrl } from "./createKenmeiUrl";
import MatchActions from "./MatchActions";
import {
  formatMediaListStatus,
  getStatusBadgeColor,
  formatScore,
  isOnUserList,
} from "../../../utils/mediaListHelpers";

export interface MatchCardProps {
  match: MangaMatchResult;
  uniqueKey: string;
  borderColorClass: string;
  statusBgColorClass: string;
  glowClass: string;
  formatStatusText: (status: string | undefined) => string;
  handleOpenExternal: (url: string) => (e: React.MouseEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent, callback: () => void) => void;
  isAdultContent: (manga: AniListManga | undefined | null) => boolean;
  shouldBlurImage: (mangaId: string) => boolean;
  toggleImageBlur: (mangaId: string) => void;
  onManualSearch?: (kenmeiManga: KenmeiManga) => void;
  onAcceptMatch?: (match: MangaMatchResult) => void;
  onRejectMatch?: (match: MangaMatchResult) => void;
  onSelectAlternative?: (
    match: MangaMatchResult,
    alternativeIndex: number,
    autoAccept?: boolean,
    directAccept?: boolean,
  ) => void;
  onResetToPending?: (match: MangaMatchResult) => void;
}

const renderAltCover = (
  altCoverImage: string | undefined,
  altIsAdult: boolean,
  altIsBlurred: boolean,
  altBlurKey: string,
  altCoverAlt: string,
  toggleImageBlur: (key: string) => void,
  sourceBadgeBaseClasses: string,
) => {
  if (!altCoverImage) {
    return (
      <div className="flex h-44 w-32 items-center justify-center rounded-[1.35rem] border border-white/40 bg-slate-100/80 text-xs font-semibold tracking-wider text-slate-500 uppercase shadow-inner dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
        No Image
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-indigo-200/60 via-white/70 to-indigo-100/40 p-[3px] shadow-[0_22px_60px_-28px_rgba(37,99,235,0.55)] transition-all duration-500 group-hover/cover:-translate-y-1 group-hover/cover:shadow-[0_32px_70px_-25px_rgba(59,130,246,0.65)] dark:from-slate-900/70 dark:via-slate-900/50 dark:to-indigo-500/20">
      <div className="relative h-44 w-32 overflow-hidden rounded-[1.35rem] ring-1 ring-white/60 backdrop-blur-sm dark:ring-slate-800/60">
        {altIsAdult ? (
          <button
            type="button"
            tabIndex={0}
            aria-label={
              altIsBlurred
                ? "Reveal adult content cover image"
                : "Hide adult content cover image"
            }
            onClick={(e) => {
              e.stopPropagation();
              toggleImageBlur(altBlurKey);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                toggleImageBlur(altBlurKey);
              }
            }}
            className="absolute inset-0 h-full w-full focus:outline-none"
          >
            <img
              src={altCoverImage}
              alt={altCoverAlt}
              className={`h-full w-full object-cover transition duration-500 ${altIsBlurred ? "scale-105 blur-xl" : ""}`}
              loading="lazy"
              draggable={false}
            />
          </button>
        ) : (
          <img
            src={altCoverImage}
            alt={altCoverAlt}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/cover:scale-[1.04]"
            loading="lazy"
            draggable={false}
          />
        )}

        {altIsAdult && (
          <div className="absolute top-1 left-1">
            <Badge
              variant="destructive"
              className={`${sourceBadgeBaseClasses} border-rose-300/70 bg-gradient-to-r from-rose-500/95 via-rose-500/90 to-rose-600/95 text-white shadow-[0_14px_30px_-18px_rgba(190,18,60,0.6)]`}
              title="Adult Content"
            >
              18+
            </Badge>
          </div>
        )}

        {altIsAdult && altIsBlurred && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Badge
              variant="secondary"
              className="cursor-pointer rounded-full border border-white/30 bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white uppercase shadow-[0_10px_26px_-14px_rgba(15,23,42,0.6)] backdrop-blur"
              onClick={(e) => {
                e.stopPropagation();
                toggleImageBlur(altBlurKey);
              }}
            >
              Reveal
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

const renderAniListDetails = (
  altManga: AniListManga | undefined | null,
  altFormat: string,
  altStatus: string,
  altChapters: number,
  altVolumes: number | null | undefined,
) => {
  if (!altManga) {
    return (
      <p className="mt-3 text-sm text-gray-500 italic dark:text-gray-400">
        No AniList details available for this match yet.
      </p>
    );
  }

  return (
    <dl className="mt-3 grid gap-3 text-sm text-gray-700 sm:grid-cols-2 dark:text-gray-200">
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Format
        </dt>
        <dd className="font-medium text-gray-900 dark:text-gray-100">
          {altFormat}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Status
        </dt>
        <dd className="font-medium text-gray-900 dark:text-gray-100">
          {altStatus}
        </dd>
      </div>
      {altChapters > 0 && (
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Chapters
          </dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">
            {altChapters}
          </dd>
        </div>
      )}
      {altVolumes && Number(altVolumes) > 0 && (
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Volumes
          </dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">
            {altVolumes}
          </dd>
        </div>
      )}
    </dl>
  );
};

const renderUserListStatus = (
  altMediaListEntry: AniListMediaEntry | UserMediaEntry | undefined | null,
  altChapters: number,
  listStatusBadgeBaseClasses: string,
) => {
  if (!altMediaListEntry || !isOnUserList(altMediaListEntry)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-blue-200/50 bg-blue-50/60 px-3 py-2 text-sm text-blue-800 shadow-inner shadow-blue-500/5 dark:border-blue-500/25 dark:bg-blue-900/15 dark:text-blue-200">
      <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-200">
        <Check className="h-3 w-3" aria-hidden="true" />
        On Your AniList
      </span>
      <Badge
        className={`${listStatusBadgeBaseClasses} ${getStatusBadgeColor(altMediaListEntry.status as MediaListStatus)}`}
      >
        {formatMediaListStatus(altMediaListEntry.status as MediaListStatus)}
      </Badge>
      <span>
        Progress: {altMediaListEntry.progress || 0}
        {altChapters > 0 && ` / ${altChapters}`}
      </span>
      <span>Score: {formatScore(altMediaListEntry.score)}</span>
    </div>
  );
};

const buildTitleEntries = (
  altManga: AniListManga | undefined | null,
  altPrimaryTitle: string,
) => {
  const altTitleEntries: Array<{ label: string; value: string }> = [];

  if (altManga?.title) {
    const { english, romaji, native } = altManga.title;
    if (english && english !== altPrimaryTitle) {
      altTitleEntries.push({ label: "English", value: english });
    }
    if (romaji && romaji !== english) {
      altTitleEntries.push({ label: "Romaji", value: romaji });
    }
    if (native) {
      altTitleEntries.push({ label: "Native", value: native });
    }
  }

  if (altManga?.synonyms?.length) {
    altTitleEntries.push({
      label: "Synonyms",
      value: altManga.synonyms.join(", "),
    });
  }

  return altTitleEntries;
};

const renderPrimarySourceBadges = (
  match: MangaMatchResult,
  sourceBadgeBaseClasses: string,
) => {
  if (!match.anilistMatches || match.anilistMatches.length === 0) {
    return null;
  }

  const firstMatch = match.anilistMatches[0];
  const hasComick =
    firstMatch?.sourceInfo?.source === "comick" || firstMatch?.comickSource;
  const hasMangaDex =
    firstMatch?.sourceInfo?.source === "mangadex" || firstMatch?.mangaDexSource;

  if (!hasComick && !hasMangaDex) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute -top-3 -left-3 flex gap-1">
      {hasComick && (
        <Badge
          className={`${sourceBadgeBaseClasses} border-orange-300/70 bg-gradient-to-r from-orange-500/95 via-orange-400/85 to-orange-500/90 text-white shadow-[0_14px_34px_-18px_rgba(249,115,22,0.55)]`}
          title={`Found via Comick: ${firstMatch?.sourceInfo?.title || firstMatch?.comickSource?.title}`}
        >
          Comick
        </Badge>
      )}
      {hasMangaDex && (
        <Badge
          className={`${sourceBadgeBaseClasses} border-sky-300/70 bg-gradient-to-r from-sky-500/95 via-sky-400/85 to-sky-500/90 text-white shadow-[0_14px_34px_-18px_rgba(56,189,248,0.55)]`}
          title={`Found via MangaDex: ${firstMatch?.sourceInfo?.title || firstMatch?.mangaDexSource?.title}`}
        >
          MangaDex
        </Badge>
      )}
    </div>
  );
};

const renderKenmeiLink = (
  match: MangaMatchResult,
  kenmeiLinkClasses: string,
  handleOpenExternal: (url: string) => (e: React.MouseEvent) => void,
) => {
  const title =
    match.selectedMatch?.title?.english ||
    match.selectedMatch?.title?.romaji ||
    match.anilistMatches?.[0]?.manga?.title?.english ||
    match.anilistMatches?.[0]?.manga?.title?.romaji ||
    match.kenmeiManga.title;

  const kenmeiUrl = createKenmeiUrl(title);

  if (!kenmeiUrl) {
    return null;
  }

  return (
    <a
      href={kenmeiUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={kenmeiLinkClasses}
      aria-label="View on Kenmei (opens in new tab)"
      onClick={handleOpenExternal(kenmeiUrl)}
    >
      <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
      Kenmei
      <div className="group/kenmei relative ml-1 inline-block">
        <Info
          className="h-3 w-3 text-indigo-500 dark:text-indigo-400"
          aria-hidden="true"
        />
        <div className="absolute right-0 bottom-full mb-2 hidden w-48 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-xs text-indigo-900 shadow-md group-hover/kenmei:block dark:border-indigo-700 dark:bg-indigo-900 dark:text-indigo-100">
          This link is dynamically generated and may not work correctly.
        </div>
      </div>
    </a>
  );
};

const renderAniListLink = (
  match: MangaMatchResult,
  aniListLinkClasses: string,
  handleOpenExternal: (url: string) => (e: React.MouseEvent) => void,
) => {
  if (
    !match.selectedMatch &&
    (!match.anilistMatches || match.anilistMatches.length === 0)
  ) {
    return null;
  }

  const mangaId =
    match.selectedMatch?.id ||
    match.anilistMatches?.[0]?.manga?.id ||
    "unknown";
  const aniListUrl = `https://anilist.co/manga/${mangaId}`;

  return (
    <a
      href={aniListUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={aniListLinkClasses}
      aria-label="View on AniList (opens in new tab)"
      onClick={handleOpenExternal(aniListUrl)}
    >
      <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
      AniList
    </a>
  );
};

const renderPrimaryAniListDetails = (
  hasAniListMetadata: boolean,
  primaryAniListMatch: AniListManga | undefined | null,
  primaryFormat: string,
  primaryStatus: string,
  primaryChapterCount: number,
) => {
  if (!hasAniListMetadata || !primaryAniListMatch) {
    return (
      <p className="mt-3 text-sm text-gray-500 italic dark:text-gray-400">
        No AniList details available for this match yet.
      </p>
    );
  }

  return (
    <dl className="mt-3 grid gap-3 text-sm text-gray-700 sm:grid-cols-2 dark:text-gray-200">
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Format
        </dt>
        <dd className="font-medium text-gray-900 dark:text-gray-100">
          {primaryFormat}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Status
        </dt>
        <dd className="font-medium text-gray-900 dark:text-gray-100">
          {primaryStatus}
        </dd>
      </div>
      {primaryChapterCount > 0 && (
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Chapters
          </dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">
            {primaryChapterCount}
          </dd>
        </div>
      )}
      {primaryAniListMatch?.volumes &&
        Number(primaryAniListMatch.volumes) > 0 && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              Volumes
            </dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {primaryAniListMatch.volumes}
            </dd>
          </div>
        )}
    </dl>
  );
};

const renderConfidenceBadge = (match: MangaMatchResult) => {
  if (
    !match.anilistMatches ||
    match.anilistMatches.length === 0 ||
    match.anilistMatches[0]?.confidence === undefined
  ) {
    return null;
  }

  return (
    <ConfidenceBadge
      confidence={match.anilistMatches[0].confidence}
      className="w-full self-stretch"
    />
  );
};

const renderKenmeiDetails = (
  match: MangaMatchResult,
  formatStatusText: (status: string | undefined) => string,
) => {
  return (
    <dl className="mt-3 grid gap-3 text-sm text-indigo-900 dark:text-indigo-50">
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-indigo-500 uppercase dark:text-indigo-200">
          Status
        </dt>
        <dd className="font-medium">
          {formatStatusText(match.kenmeiManga.status)}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-indigo-500 uppercase dark:text-indigo-200">
          Chapters Read
        </dt>
        <dd className="font-medium">{match.kenmeiManga.chapters_read}</dd>
      </div>
      {match.kenmeiManga.score > 0 && (
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold tracking-wide text-indigo-500 uppercase dark:text-indigo-200">
            Score
          </dt>
          <dd className="font-medium">{match.kenmeiManga.score}/10</dd>
        </div>
      )}
    </dl>
  );
};

const renderMatchStatusBadge = (
  match: MangaMatchResult,
  formatStatusText: (status: string | undefined) => string,
  statusBadgeBaseClasses: string,
  statusBadgeMatchedClasses: string,
  statusBadgeManualClasses: string,
  statusBadgeSkippedClasses: string,
  statusBadgePendingClasses: string,
) => {
  let badgeClass = statusBadgePendingClasses;
  if (match.status === "matched") {
    badgeClass = statusBadgeMatchedClasses;
  } else if (match.status === "manual") {
    badgeClass = statusBadgeManualClasses;
  } else if (match.status === "skipped") {
    badgeClass = statusBadgeSkippedClasses;
  }

  return (
    <Badge
      variant="outline"
      className={`${statusBadgeBaseClasses} ${badgeClass}`}
    >
      {formatStatusText(match.status)}
    </Badge>
  );
};

const shouldShowPrimaryMatch = (match: MangaMatchResult): boolean => {
  return (
    Boolean(match.selectedMatch) ||
    Boolean(match.anilistMatches?.length) ||
    match.status === "skipped" ||
    match.status === "pending"
  );
};

const shouldShowAlternativeMatches = (match: MangaMatchResult): boolean => {
  return (
    Boolean(match.anilistMatches) &&
    (match.anilistMatches?.length ?? 0) > 1 &&
    match.status !== "matched" &&
    match.status !== "manual"
  );
};

const renderKenmeiHeaderLink = (
  kenmeiHeaderUrl: string | null,
  handleOpenExternal: (url: string) => (e: React.MouseEvent) => void,
  kenmeiHeaderBadgeClasses: string,
  mangaTitle: string,
) => {
  if (!kenmeiHeaderUrl) {
    return null;
  }

  return (
    <a
      href={kenmeiHeaderUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleOpenExternal(kenmeiHeaderUrl)}
      className={kenmeiHeaderBadgeClasses}
      aria-label={`Open ${mangaTitle} on Kenmei (opens in new tab)`}
    >
      View on Kenmei
    </a>
  );
};

const renderSkippedBadge = (showSkippedBadge: boolean) => {
  if (!showSkippedBadge) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
      Skipped
    </span>
  );
};

const renderTitleEntries = (
  titleEntries: Array<{ label: string; value: string }>,
) => {
  if (titleEntries.length === 0) {
    return null;
  }

  return (
    <ul className="max-w-full list-disc space-y-1 pl-5 text-sm text-gray-500 dark:text-gray-400">
      {titleEntries.map((entry, idx) => (
        <li
          key={`${entry.label}-${idx}`}
          className="leading-snug break-words [word-break:break-word]"
        >
          <span className="font-semibold text-gray-600 dark:text-gray-300">
            {entry.label}:
          </span>{" "}
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

const renderPrimaryListStatus = (
  primaryMediaListEntry:
    | {
        id: number;
        status: MediaListStatus;
        progress: number;
        score: number;
        private: boolean;
      }
    | undefined
    | null,
  primaryChapterCount: number,
  listStatusBadgeBaseClasses: string,
) => {
  if (!primaryMediaListEntry || !isOnUserList(primaryMediaListEntry)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-blue-200/50 bg-blue-50/60 px-3 py-2 text-sm text-blue-800 shadow-inner shadow-blue-500/5 dark:border-blue-500/25 dark:bg-blue-900/15 dark:text-blue-200">
      <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-200">
        <Check className="h-3 w-3" aria-hidden="true" />
        On Your AniList
      </span>
      <Badge
        className={`${listStatusBadgeBaseClasses} ${getStatusBadgeColor(primaryMediaListEntry.status)}`}
      >
        {formatMediaListStatus(primaryMediaListEntry.status)}
      </Badge>
      <span>
        Progress: {primaryMediaListEntry.progress || 0}
        {primaryChapterCount > 0 && ` / ${primaryChapterCount}`}
      </span>
      <span>Score: {formatScore(primaryMediaListEntry.score)}</span>
    </div>
  );
};

const getDisplayTitle = (
  match: MangaMatchResult,
  primaryDisplayTitle: string,
): string => {
  const isEmptyPendingOrSkipped =
    (match.status === "pending" || match.status === "skipped") &&
    !match.selectedMatch &&
    !match.anilistMatches?.length;

  if (isEmptyPendingOrSkipped) {
    return match.kenmeiManga.title;
  }

  return primaryDisplayTitle;
};

const renderPrimaryCover = (
  primaryCoverImage: string | undefined,
  primaryIsAdult: boolean,
  primaryIsBlurred: boolean,
  primaryBlurKey: string | undefined,
  primaryCoverAlt: string,
  toggleImageBlur: (mangaId: string) => void,
  sourceBadgeBaseClasses: string,
) => {
  if (!primaryCoverImage) {
    return (
      <div className="flex h-44 w-32 items-center justify-center rounded-[1.35rem] border border-white/40 bg-slate-100/80 text-xs font-semibold tracking-wider text-slate-500 uppercase shadow-inner dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
        No Image
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-indigo-200/60 via-white/70 to-indigo-100/40 p-[3px] shadow-[0_22px_60px_-28px_rgba(37,99,235,0.55)] transition-all duration-500 group-hover/cover:-translate-y-1 group-hover/cover:shadow-[0_32px_70px_-25px_rgba(59,130,246,0.65)] dark:from-slate-900/70 dark:via-slate-900/50 dark:to-indigo-500/20">
      <div className="relative h-44 w-32 overflow-hidden rounded-[1.35rem] ring-1 ring-white/60 backdrop-blur-sm dark:ring-slate-800/60">
        {primaryIsAdult ? (
          <button
            type="button"
            tabIndex={0}
            aria-label={
              primaryIsBlurred
                ? "Reveal adult content cover image"
                : "Hide adult content cover image"
            }
            onClick={() => {
              if (primaryBlurKey) {
                toggleImageBlur(primaryBlurKey);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (primaryBlurKey) {
                  toggleImageBlur(primaryBlurKey);
                }
              }
            }}
            className="absolute inset-0 h-full w-full focus:outline-none"
          >
            <img
              src={primaryCoverImage}
              alt={primaryCoverAlt}
              className={`h-full w-full object-cover transition duration-500 ${primaryIsBlurred ? "scale-105 blur-xl" : ""}`}
              loading="lazy"
              draggable={false}
            />
          </button>
        ) : (
          <img
            src={primaryCoverImage}
            alt={primaryCoverAlt}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/cover:scale-[1.04]"
            loading="lazy"
            draggable={false}
          />
        )}

        {primaryIsAdult && (
          <div className="absolute top-1 left-1">
            <Badge
              variant="destructive"
              className={`${sourceBadgeBaseClasses} border-rose-300/70 bg-gradient-to-r from-rose-500/95 via-rose-500/90 to-rose-600/95 text-white shadow-[0_14px_30px_-18px_rgba(190,18,60,0.6)]`}
              title="Adult Content"
            >
              18+
            </Badge>
          </div>
        )}

        {primaryIsAdult && primaryIsBlurred && primaryBlurKey && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Badge
              variant="secondary"
              className="cursor-pointer rounded-full border border-white/30 bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white uppercase shadow-[0_10px_26px_-14px_rgba(15,23,42,0.6)] backdrop-blur"
              onClick={() => toggleImageBlur(primaryBlurKey)}
            >
              Reveal
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

interface AlternativeMatchItemProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  altMatch: any;
  index: number;
  match: MangaMatchResult;
  isAdultContent: (manga: AniListManga | undefined | null) => boolean;
  shouldBlurImage: (mangaId: string) => boolean;
  toggleImageBlur: (mangaId: string) => void;
  handleOpenExternal: (url: string) => (e: React.MouseEvent) => void;
  formatStatusText: (status: string | undefined) => string;
  onSelectAlternative?: (
    match: MangaMatchResult,
    alternativeIndex: number,
    autoAccept?: boolean,
    directAccept?: boolean,
  ) => void;
  sourceBadgeBaseClasses: string;
  aniListLinkClasses: string;
  kenmeiLinkClasses: string;
  listStatusBadgeBaseClasses: string;
}

const AlternativeMatchItem: React.FC<AlternativeMatchItemProps> = ({
  altMatch,
  index,
  match,
  isAdultContent,
  shouldBlurImage,
  toggleImageBlur,
  handleOpenExternal,
  formatStatusText,
  onSelectAlternative,
  sourceBadgeBaseClasses,
  aniListLinkClasses,
  kenmeiLinkClasses,
  listStatusBadgeBaseClasses,
}) => {
  const altBlurKey = `alt-${altMatch.manga?.id ?? index}`;
  const altIsBlurred = shouldBlurImage(altBlurKey);
  const altPrimaryTitle =
    altMatch.manga?.title?.english ||
    altMatch.manga?.title?.romaji ||
    "Unknown Manga";
  const altAccessibleTitle =
    altMatch.manga?.title?.english ||
    altMatch.manga?.title?.romaji ||
    "Alternative manga";
  const altManga = altMatch.manga;
  const altCoverImage =
    altManga?.coverImage?.large || altManga?.coverImage?.medium;
  const altCoverAlt =
    altManga?.title?.english ||
    altManga?.title?.romaji ||
    altManga?.title?.native ||
    altAccessibleTitle;

  const altTitleEntries = buildTitleEntries(altManga, altPrimaryTitle);

  const altFormat = altManga?.format || "Unknown Format";
  const altStatus = altManga?.status || "Unknown Status";
  const altChapters = altManga?.chapters || 0;
  const altVolumes = altManga?.volumes;
  const altMediaListEntry = altManga?.mediaListEntry;
  const altAniListId = altManga?.id ?? "unknown";
  const altAniListUrl = `https://anilist.co/manga/${altAniListId}`;
  const altKenmeiTitle =
    altManga?.title?.english ||
    altManga?.title?.romaji ||
    match.kenmeiManga.title;
  const altKenmeiUrl = createKenmeiUrl(altKenmeiTitle);
  const altIsAdult = isAdultContent(altManga);

  const hasComick =
    altMatch.sourceInfo?.source === "comick" || Boolean(altMatch.comickSource);
  const hasMangaDex =
    altMatch.sourceInfo?.source === "mangadex" ||
    Boolean(altMatch.mangaDexSource);

  const coverContent = renderAltCover(
    altCoverImage,
    altIsAdult,
    altIsBlurred,
    altBlurKey,
    altCoverAlt,
    toggleImageBlur,
    sourceBadgeBaseClasses,
  );

  return (
    <div
      key={altManga?.id || altMatch.id || `alt-match-${index}`}
      className="rounded-2xl border border-white/40 bg-white/75 px-6 py-6 shadow-lg shadow-slate-900/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_80px_-32px_rgba(30,41,59,0.55)] dark:border-slate-800/60 dark:bg-slate-900/70 dark:shadow-black/10 dark:hover:shadow-[0_32px_80px_-30px_rgba(30,41,59,0.6)]"
      aria-label={`Select ${altAccessibleTitle} as match`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="group/cover relative flex-shrink-0">
              {coverContent}

              {(hasComick || hasMangaDex) && (
                <div className="pointer-events-none absolute -top-3 -left-3 flex gap-1">
                  {hasComick && (
                    <Badge
                      className={`${sourceBadgeBaseClasses} border-orange-300/70 bg-gradient-to-r from-orange-500/95 via-orange-400/85 to-orange-500/90 text-white shadow-[0_14px_34px_-18px_rgba(249,115,22,0.55)]`}
                      title={`Found via Comick: ${altMatch.sourceInfo?.title || altMatch.comickSource?.title}`}
                    >
                      Comick
                    </Badge>
                  )}
                  {hasMangaDex && (
                    <Badge
                      className={`${sourceBadgeBaseClasses} border-sky-300/70 bg-gradient-to-r from-sky-500/95 via-sky-400/85 to-sky-500/90 text-white shadow-[0_14px_34px_-18px_rgba(56,189,248,0.55)]`}
                      title={`Found via MangaDex: ${altMatch.sourceInfo?.title || altMatch.mangaDexSource?.title}`}
                    >
                      MangaDex
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {altPrimaryTitle}
                </h4>
              </div>
              {altTitleEntries.length > 0 && (
                <ul className="max-w-full list-disc space-y-1 pl-5 text-sm text-gray-500 dark:text-gray-400">
                  {altTitleEntries.map((entry, altIdx) => (
                    <li
                      key={`${entry.label}-${altIdx}`}
                      className="leading-snug break-words [word-break:break-word]"
                    >
                      <span className="font-semibold text-gray-600 dark:text-gray-300">
                        {entry.label}:
                      </span>{" "}
                      <span>{entry.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-[360px] sm:min-w-[240px] sm:flex-shrink-0 sm:items-end sm:self-start">
            <div className="flex w-full flex-col items-end gap-2 self-stretch sm:w-auto sm:self-end">
              {altMatch.confidence !== undefined && (
                <ConfidenceBadge
                  confidence={altMatch.confidence}
                  className="w-full self-stretch"
                />
              )}
              <div className="flex flex-wrap justify-end gap-2 self-stretch">
                {altManga && (
                  <a
                    href={altAniListUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={aniListLinkClasses}
                    aria-label="View on AniList (opens in new tab)"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenExternal(altAniListUrl)(e);
                    }}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                    AniList
                  </a>
                )}
                {altKenmeiUrl && (
                  <a
                    href={altKenmeiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={kenmeiLinkClasses}
                    aria-label="View on Kenmei (opens in new tab)"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenExternal(altKenmeiUrl)(e);
                    }}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                    Kenmei
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <Separator className="bg-foreground/10 dark:bg-white/10" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50">
              <span className="text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase dark:text-gray-400">
                AniList details
              </span>
              {renderAniListDetails(
                altManga,
                altFormat,
                altStatus,
                altChapters,
                altVolumes,
              )}
            </div>

            {renderUserListStatus(
              altMediaListEntry,
              altChapters,
              listStatusBadgeBaseClasses,
            )}
          </div>

          <div className="rounded-2xl border border-indigo-200/50 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-900/15">
            <span className="text-xs font-semibold tracking-[0.18em] text-indigo-500 uppercase dark:text-indigo-200">
              Kenmei details
            </span>
            <dl className="mt-3 grid gap-3 text-sm text-indigo-900 dark:text-indigo-50">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold tracking-wide text-indigo-500 uppercase dark:text-indigo-200">
                  Status
                </dt>
                <dd className="font-medium">
                  {formatStatusText(match.kenmeiManga.status)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold tracking-wide text-indigo-500 uppercase dark:text-indigo-200">
                  Chapters Read
                </dt>
                <dd className="font-medium">
                  {match.kenmeiManga.chapters_read}
                </dd>
              </div>
              {match.kenmeiManga.score > 0 && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-semibold tracking-wide text-indigo-500 uppercase dark:text-indigo-200">
                    Score
                  </dt>
                  <dd className="font-medium">{match.kenmeiManga.score}/10</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        <Separator className="bg-foreground/10 dark:bg-white/10" />
        <div className="flex flex-wrap items-center justify-start gap-3">
          <Button
            type="button"
            className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_32px_-15px_rgba(16,185,129,0.6)] transition-all hover:shadow-[0_20px_45px_-18px_rgba(101,163,13,0.55)] focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:outline-none dark:from-emerald-500 dark:via-emerald-400 dark:to-lime-500"
            onClick={() => onSelectAlternative?.(match, index + 1, false, true)}
            aria-label={
              "Accept " +
              altPrimaryTitle +
              " as match (" +
              (typeof altMatch.confidence === "number"
                ? Math.round(altMatch.confidence) + "%"
                : "Unknown confidence") +
              ")"
            }
          >
            <Check className="mr-1 h-3 w-3" aria-hidden="true" />
            Accept Match
          </Button>
        </div>
      </div>
    </div>
  );
};

const computePrimaryBlurKey = (
  primaryMatchCandidate: AniListManga | undefined | null,
  match: MangaMatchResult,
): string | undefined => {
  if (primaryMatchCandidate?.id !== undefined) {
    return `${primaryMatchCandidate.id}`;
  }

  if (typeof match.anilistMatches?.[0]?.manga?.id === "number") {
    return `${match.anilistMatches[0].manga.id}`;
  }

  return undefined;
};

export default function MatchCard({
  match,
  uniqueKey,
  borderColorClass,
  statusBgColorClass,
  glowClass,
  formatStatusText,
  handleOpenExternal,
  handleKeyDown,
  isAdultContent,
  shouldBlurImage,
  toggleImageBlur,
  onManualSearch,
  onAcceptMatch,
  onRejectMatch,
  onSelectAlternative,
  onResetToPending,
}: Readonly<MatchCardProps>) {
  const primaryMatchCandidate =
    match.selectedMatch ?? match.anilistMatches?.[0]?.manga;

  const primaryCoverImage =
    match.selectedMatch?.coverImage?.large ||
    match.selectedMatch?.coverImage?.medium ||
    match.anilistMatches?.[0]?.manga?.coverImage?.large ||
    match.anilistMatches?.[0]?.manga?.coverImage?.medium;

  const primaryCoverAlt =
    match.selectedMatch?.title?.english ||
    match.selectedMatch?.title?.romaji ||
    match.anilistMatches?.[0]?.manga?.title?.english ||
    match.anilistMatches?.[0]?.manga?.title?.romaji ||
    match.kenmeiManga.title;

  const primaryBlurKey = computePrimaryBlurKey(primaryMatchCandidate, match);

  const primaryIsAdult = isAdultContent(
    primaryMatchCandidate ?? match.anilistMatches?.[0]?.manga,
  );

  const primaryIsBlurred = primaryBlurKey
    ? shouldBlurImage(primaryBlurKey)
    : false;

  const primaryAniListMatch =
    match.selectedMatch ?? match.anilistMatches?.[0]?.manga;
  const primaryMediaListEntry =
    match.selectedMatch?.mediaListEntry ??
    match.anilistMatches?.[0]?.manga?.mediaListEntry;
  const primaryFormat =
    match.selectedMatch?.format ??
    match.anilistMatches?.[0]?.manga?.format ??
    "Unknown Format";
  const primaryStatus =
    match.selectedMatch?.status ??
    match.anilistMatches?.[0]?.manga?.status ??
    "Unknown Status";
  const primaryChapterCount =
    match.selectedMatch?.chapters ??
    match.anilistMatches?.[0]?.manga?.chapters ??
    0;
  const hasAniListMetadata =
    match.status !== "skipped" ||
    Boolean(match.selectedMatch) ||
    Boolean(match.anilistMatches?.length);

  const fallbackManga = match.anilistMatches?.[0]?.manga;
  const primaryDisplayTitle =
    match.selectedMatch?.title?.english ??
    match.selectedMatch?.title?.romaji ??
    fallbackManga?.title?.english ??
    fallbackManga?.title?.romaji ??
    "Unknown Title";

  const titleEntries: Array<{ label: string; value: string }> = [];
  const kenmeiHeaderUrl = createKenmeiUrl(match.kenmeiManga.title);

  const displayTitle = getDisplayTitle(match, primaryDisplayTitle);

  const showSkippedBadge =
    match.status === "skipped" &&
    !match.selectedMatch &&
    !match.anilistMatches?.length;

  const sourceTitle = match.selectedMatch?.title ?? fallbackManga?.title;
  if (sourceTitle) {
    const { english, romaji, native } = sourceTitle;
    if (english && english !== primaryDisplayTitle)
      titleEntries.push({ label: "English", value: english });
    if (romaji && romaji !== english)
      titleEntries.push({ label: "Romaji", value: romaji });
    if (native) {
      titleEntries.push({ label: "Native", value: native });
    }
    const synonyms = match.selectedMatch?.synonyms ?? fallbackManga?.synonyms;
    if (synonyms?.length) {
      titleEntries.push({ label: "Synonyms", value: synonyms.join(", ") });
    }
  }

  const externalLinkBaseClasses =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 transform-gpu hover:-translate-y-[2px] hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:text-sm dark:focus-visible:ring-indigo-500 dark:focus-visible:ring-offset-slate-900";
  const aniListLinkClasses = `${externalLinkBaseClasses} border-slate-200/70 bg-gradient-to-r from-slate-100/85 via-white/90 to-slate-50/80 text-slate-700 shadow-sm hover:border-slate-200/90 hover:from-slate-100/95 hover:via-white/95 hover:to-slate-100/90 hover:text-slate-900 hover:shadow-[0_14px_32px_-18px_rgba(30,41,59,0.55)] dark:border-slate-700/60 dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-800/60 dark:text-slate-100 dark:hover:border-slate-600/70 dark:hover:from-slate-800/75 dark:hover:via-slate-900/55 dark:hover:to-slate-800/55 dark:hover:text-slate-50 dark:hover:shadow-[0_16px_36px_-18px_rgba(148,163,184,0.5)]`;
  const kenmeiLinkClasses = `${externalLinkBaseClasses} border-indigo-200/70 bg-gradient-to-r from-indigo-100/75 via-white/90 to-indigo-50/70 text-indigo-700 shadow-sm hover:border-indigo-200/90 hover:from-indigo-100/85 hover:via-white/95 hover:to-indigo-100/85 hover:text-indigo-800 hover:shadow-[0_16px_38px_-18px_rgba(79,70,229,0.58)] dark:border-indigo-500/35 dark:from-indigo-900/40 dark:via-slate-900/70 dark:to-indigo-800/40 dark:text-indigo-200 dark:hover:border-indigo-500/45 dark:hover:from-indigo-800/45 dark:hover:via-slate-900/60 dark:hover:to-indigo-700/45 dark:hover:text-indigo-100 dark:hover:shadow-[0_18px_40px_-18px_rgba(99,102,241,0.55)]`;
  const statusBadgeBaseClasses =
    "mr-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] shadow-[0_12px_30px_-18px_rgba(15,23,42,0.4)] backdrop-blur-md transition-all duration-200";
  const statusBadgeMatchedClasses =
    "border-emerald-200/70 bg-gradient-to-r from-emerald-100/70 via-emerald-50/55 to-emerald-100/65 text-emerald-600 dark:border-emerald-500/35 dark:from-emerald-900/45 dark:via-emerald-900/25 dark:to-emerald-800/35 dark:text-emerald-200";
  const statusBadgeManualClasses =
    "border-sky-200/70 bg-gradient-to-r from-sky-100/70 via-sky-50/55 to-sky-100/65 text-sky-600 dark:border-sky-500/35 dark:from-sky-900/45 dark:via-sky-900/25 dark:to-sky-800/35 dark:text-sky-200";
  const statusBadgeSkippedClasses =
    "border-rose-200/70 bg-gradient-to-r from-rose-100/70 via-rose-50/55 to-rose-100/65 text-rose-600 dark:border-rose-500/35 dark:from-rose-900/45 dark:via-rose-900/25 dark:to-rose-800/35 dark:text-rose-200";
  const statusBadgePendingClasses =
    "border-white/60 bg-gradient-to-r from-white/80 via-white/60 to-white/70 text-slate-700 dark:border-slate-700/60 dark:from-slate-900/60 dark:via-slate-900/45 dark:to-slate-800/55 dark:text-slate-200";
  const listStatusBadgeBaseClasses =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-[0_8px_22px_-16px_rgba(15,23,42,0.3)] backdrop-blur-md transition-all duration-200";
  const sourceBadgeBaseClasses =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)] backdrop-blur-md transition-all duration-200";
  const kenmeiHeaderBadgeClasses =
    "inline-flex items-center min-w-[10.3%] gap-1 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm transition duration-200 hover:-translate-y-[1px] hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-indigo-500/30 dark:bg-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-900/55 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950";
  return (
    <motion.div
      key={uniqueKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className={`group relative overflow-hidden rounded-3xl border ${borderColorClass} bg-gradient-to-br from-white/85 via-slate-50/70 to-white/90 p-1 shadow-[0_28px_80px_-30px_rgba(30,41,59,0.55)] ring-1 ring-slate-200/60 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_38px_95px_-30px_rgba(30,41,59,0.65)] dark:from-slate-950/85 dark:via-slate-900/75 dark:to-slate-950/90 dark:ring-slate-900/60 ${glowClass}`}
      tabIndex={0}
      aria-label={`Match result for ${match.kenmeiManga.title}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-500/20"
      />
      <div className="relative z-[1] flex flex-col gap-4">
        {/* Title and Status Bar with color indicator */}
        <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-r from-white/90 via-white/60 to-white/30 p-5 shadow-sm dark:border-slate-800/60 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-950/60">
          {/* Status color indicator */}
          <div
            className={`absolute inset-y-0 left-0 w-1 ${statusBgColorClass}`}
          ></div>
          <div className="relative flex items-center justify-between pl-2">
            <div className="flex items-center">
              {renderMatchStatusBadge(
                match,
                formatStatusText,
                statusBadgeBaseClasses,
                statusBadgeMatchedClasses,
                statusBadgeManualClasses,
                statusBadgeSkippedClasses,
                statusBadgePendingClasses,
              )}
              <h3 className="line-clamp-1 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                {match.kenmeiManga.title}
              </h3>
            </div>
            {renderKenmeiHeaderLink(
              kenmeiHeaderUrl,
              handleOpenExternal,
              kenmeiHeaderBadgeClasses,
              match.kenmeiManga.title,
            )}
          </div>
        </div>

        {/* Selected or best match */}
        {shouldShowPrimaryMatch(match) && (
          <div className="rounded-2xl border border-white/40 bg-white/75 px-6 py-6 shadow-lg shadow-slate-900/10 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/70 dark:shadow-black/10">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="group/cover relative flex-shrink-0">
                    {/* Cover image with proper fallbacks and adult content handling */}
                    {renderPrimaryCover(
                      primaryCoverImage,
                      primaryIsAdult,
                      primaryIsBlurred,
                      primaryBlurKey,
                      primaryCoverAlt,
                      toggleImageBlur,
                      sourceBadgeBaseClasses,
                    )}

                    {/* Source badges - show when result came from alternative sources */}
                    {renderPrimarySourceBadges(match, sourceBadgeBaseClasses)}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {displayTitle}
                      </h4>
                      {renderSkippedBadge(showSkippedBadge)}
                    </div>
                    {renderTitleEntries(titleEntries)}
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:max-w-[360px] sm:min-w-[240px] sm:flex-shrink-0 sm:items-end sm:self-start">
                  <div className="flex w-full flex-col items-end gap-2 self-stretch sm:w-auto sm:self-end">
                    {renderConfidenceBadge(match)}
                    <div className="flex flex-wrap justify-end gap-2 self-stretch">
                      {renderAniListLink(
                        match,
                        aniListLinkClasses,
                        handleOpenExternal,
                      )}
                      {renderKenmeiLink(
                        match,
                        kenmeiLinkClasses,
                        handleOpenExternal,
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Separator className="bg-foreground/10 dark:bg-white/10" />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50">
                    <span className="text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase dark:text-gray-400">
                      AniList details
                    </span>
                    {renderPrimaryAniListDetails(
                      hasAniListMetadata,
                      primaryAniListMatch,
                      primaryFormat,
                      primaryStatus,
                      primaryChapterCount,
                    )}
                  </div>

                  {/* User's current list status (if on their list) */}
                  {renderPrimaryListStatus(
                    primaryMediaListEntry,
                    primaryChapterCount,
                    listStatusBadgeBaseClasses,
                  )}
                </div>

                {/* Kenmei status info */}
                <div className="rounded-2xl border border-indigo-200/50 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-900/15">
                  <span className="text-xs font-semibold tracking-[0.18em] text-indigo-500 uppercase dark:text-indigo-200">
                    Kenmei details
                  </span>
                  {renderKenmeiDetails(match, formatStatusText)}
                </div>
              </div>
              <Separator className="bg-foreground/10 dark:bg-white/10" />
              <div className="flex flex-wrap items-center justify-start gap-3">
                <MatchActions
                  match={match}
                  onManualSearch={onManualSearch}
                  onAcceptMatch={onAcceptMatch}
                  onRejectMatch={onRejectMatch}
                  onResetToPending={onResetToPending}
                  onSelectAlternative={onSelectAlternative}
                  handleKeyDown={handleKeyDown}
                />
              </div>
            </div>
          </div>
        )}

        {/* Alternative matches - only show for non-matched entries */}
        {shouldShowAlternativeMatches(match) && (
          <div className="rounded-2xl border border-white/30 bg-gradient-to-br from-white/80 via-white/60 to-white/40 px-5 py-5 shadow-lg shadow-slate-900/10 backdrop-blur-sm dark:border-slate-800/60 dark:from-slate-900/80 dark:via-slate-900/65 dark:to-slate-950/55">
            <h4 className="mb-4 flex items-center text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase dark:text-gray-300">
              <ChevronRight className="mr-1 h-4 w-4" aria-hidden="true" />
              Alternative Matches
            </h4>
            <div className="space-y-3">
              {match.anilistMatches?.slice(1, 5).map((altMatch, index) => (
                <AlternativeMatchItem
                  key={
                    altMatch.manga?.id || altMatch.id || `alt-match-${index}`
                  }
                  altMatch={altMatch}
                  index={index}
                  match={match}
                  isAdultContent={isAdultContent}
                  shouldBlurImage={shouldBlurImage}
                  toggleImageBlur={toggleImageBlur}
                  handleOpenExternal={handleOpenExternal}
                  formatStatusText={formatStatusText}
                  onSelectAlternative={onSelectAlternative}
                  sourceBadgeBaseClasses={sourceBadgeBaseClasses}
                  aniListLinkClasses={aniListLinkClasses}
                  kenmeiLinkClasses={kenmeiLinkClasses}
                  listStatusBadgeBaseClasses={listStatusBadgeBaseClasses}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
