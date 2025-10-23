/**
 * @packageDocumentation
 * @module MangaSearchPanel
 * @description React component for searching and selecting AniList manga matches for a given Kenmei manga, with manual search and result selection features.
 */
import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  X,
  Check,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Sparkles,
  Gauge,
} from "lucide-react";
import { KenmeiManga } from "../../api/kenmei/types";
import { AniListManga, MangaMatch } from "../../api/anilist/types";
import { searchMangaByTitle } from "../../api/matching/search-service";
import { getMangaByIds } from "../../api/anilist/client";

// Import utility functions for media list formatting
import {
  formatMediaListStatus,
  getStatusBadgeColor,
  formatScore,
  isOnUserList,
} from "../../utils/mediaListHelpers";

// Import storage utilities
import { getMatchConfig } from "../../utils/storage";

/**
 * Get CSS classes for source badge based on source type
 */
function getSourceBadgeClasses(source: string): string {
  switch (source) {
    case "comick":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "mangadex":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
}

/**
 * Props for the MangaSearchPanel component.
 *
 * @property kenmeiManga - The Kenmei manga to search for a match (optional).
 * @property onClose - Callback to close the search panel.
 * @property onSelectMatch - Callback when a manga match is selected.
 * @property token - AniList access token (optional).
 * @property bypassCache - Whether to bypass the cache for searching (optional).
 * @internal
 * @source
 */
export interface MangaSearchPanelProps {
  kenmeiManga?: KenmeiManga;
  onClose: () => void;
  onSelectMatch: (manga: AniListManga) => void;
  token?: string;
  bypassCache?: boolean;
}

/**
 * MangaSearchPanel React component for searching and selecting AniList manga matches for a given Kenmei manga, with manual search and result selection features.
 *
 * @param props - The props for the MangaSearchPanel component.
 * @returns The rendered manga search panel React element.
 * @source
 */
export function MangaSearchPanel({
  kenmeiManga,
  onClose,
  onSelectMatch,
  token,
  bypassCache,
}: Readonly<MangaSearchPanelProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MangaMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [blurAdultContent, setBlurAdultContent] = useState(true);
  const [unblurredImages, setUnblurredImages] = useState<Set<string>>(
    new Set(),
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Load blur settings from match config
  useEffect(() => {
    const loadBlurSettings = async () => {
      const matchConfig = getMatchConfig();
      setBlurAdultContent(matchConfig.blurAdultContent);
    };
    loadBlurSettings();
  }, []);

  // Helper functions for adult content handling
  const isAdultContent = (manga: AniListManga) => {
    return manga?.isAdult === true;
  };

  const shouldBlurImage = (mangaId: string) => {
    return blurAdultContent && !unblurredImages.has(mangaId);
  };

  const toggleImageBlur = (mangaId: string) => {
    setUnblurredImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mangaId)) {
        newSet.delete(mangaId);
      } else {
        newSet.add(mangaId);
      }
      return newSet;
    });
  };

  // Style modifications to make everything larger
  const headerClasses = "text-2xl font-semibold tracking-tight"; // Elevated typography for hero header
  const titleClasses = "text-3xl font-semibold"; // Increased from text-lg for stronger emphasis

  useEffect(() => {
    // Focus the search input
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [kenmeiManga?.id, kenmeiManga?.title]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchResults]);

  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const selectedElement = resultsContainerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      ) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [selectedIndex]);

  // Check if query is a valid AniList ID
  const isValidAniListId = (query: string) => {
    const isNumericId = /^\d+$/.test(query.trim());
    const mangaId = isNumericId ? Number.parseInt(query.trim(), 10) : null;
    return mangaId && mangaId > 0 && mangaId < 10000000 ? mangaId : null;
  };

  // Handle ID-based search
  const handleIdSearch = async (
    mangaId: number,
    pageNum: number,
    startTime: number,
  ) => {
    console.debug(`[SearchPanel] 🔎 Detected AniList ID search: ${mangaId}`);

    const idResults = await getMangaByIds([mangaId], token);

    if (idResults.length > 0) {
      console.debug(
        `[SearchPanel] 🔎 Found manga by ID ${mangaId}:`,
        idResults[0],
      );

      const idMatches: MangaMatch[] = idResults.map((manga) => ({
        manga,
        confidence: 100,
      }));

      updateSearchResults(idMatches, pageNum, {
        hasNextPage: false,
        currentPage: 1,
      });
    } else {
      console.debug(`[SearchPanel] ⚠️ No manga found for ID ${mangaId}`);
      if (pageNum === 1) {
        setSearchResults([]);
      }
      setHasNextPage(false);
    }

    const endTime = performance.now();
    console.debug(
      `[SearchPanel] 🔎 Search completed in ${(endTime - startTime).toFixed(2)}ms for ID ${mangaId}`,
    );
  };

  // Handle title-based search
  const handleTitleSearch = async (
    query: string,
    pageNum: number,
    startTime: number,
  ) => {
    console.info(`[SearchPanel] 🔎 Performing title search for: "${query}"`);

    const searchConfig = {
      bypassCache: !!bypassCache,
      maxSearchResults: 30,
      searchPerPage: 50,
      exactMatchingOnly: false,
    };

    console.debug(`[SearchPanel] 🔎 Search config:`, searchConfig);

    const searchResponse = await searchMangaByTitle(
      query,
      token,
      searchConfig,
      undefined,
      pageNum,
    );

    const results = searchResponse.matches;
    const pageInfo = searchResponse.pageInfo;
    const endTime = performance.now();

    console.debug(
      `[SearchPanel] 🔎 Search completed in ${(endTime - startTime).toFixed(2)}ms for "${query}"`,
    );
    console.info(
      `[SearchPanel] 🔎 Search returned ${results.length} results for "${query}"`,
    );

    logSearchResults(results, query);
    updateSearchResults(results, pageNum, pageInfo);
  };

  // Log search results for debugging
  const logSearchResults = (results: MangaMatch[], query: string) => {
    if (results.length > 0) {
      console.debug(
        `[SearchPanel] 🔎 Titles received:`,
        results.map((m) => ({
          title: m.manga.title?.romaji || m.manga.title?.english || "unknown",
          confidence: m.confidence.toFixed(1),
          id: m.manga.id,
        })),
      );
    } else {
      console.debug(
        `[SearchPanel] ⚠️ No results found for "${query}" - this could indicate a cache or display issue`,
      );
    }
  };

  // Update search results with proper pagination handling
  const updateSearchResults = (
    results: MangaMatch[],
    pageNum: number,
    pageInfo?: { hasNextPage: boolean; currentPage: number },
  ) => {
    if (pageNum === 1) {
      console.debug(`[SearchPanel] 🔎 Resetting search results`);
      setSearchResults(results);
    } else {
      console.debug(
        `[SearchPanel] 🔎 Appending ${results.length} results to existing ${searchResults.length} results`,
      );
      setSearchResults((prev) => {
        const existingIds = new Set(prev.map((match) => match.manga.id));
        const newUniqueResults = results.filter(
          (match) => !existingIds.has(match.manga.id),
        );

        console.debug(
          `[SearchPanel] 🔎 Adding ${newUniqueResults.length} unique results (filtered ${results.length - newUniqueResults.length} duplicates)`,
        );

        return [...prev, ...newUniqueResults];
      });
    }

    if (pageInfo) {
      console.debug(`[SearchPanel] 🔎 Using API pagination info:`, pageInfo);
      setHasNextPage(pageInfo.hasNextPage);
      setPage(pageInfo.currentPage);
    } else {
      console.debug(
        `[SearchPanel] 🔎 No pagination info available, using fallback logic`,
      );
      setHasNextPage(false);
      setPage(pageNum);
    }

    console.debug(
      `[SearchPanel] 🔎 UI state updated: searchResults.length=${results.length}, hasNextPage=${pageInfo?.hasNextPage || false}, page=${pageInfo?.currentPage || pageNum}`,
    );
  };

  const handleSearch = async (query: string, pageNum: number = 1) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      console.info(
        `[SearchPanel] 🔎 Starting search for: "${query}" with bypassCache=${!!bypassCache}, page=${pageNum}`,
      );
      const startTime = performance.now();

      // Check if query is a valid AniList ID
      const mangaId = isValidAniListId(query);

      if (mangaId) {
        await handleIdSearch(mangaId, pageNum, startTime);
      } else {
        await handleTitleSearch(query, pageNum, startTime);
      }

      const endTime = performance.now();
      console.debug(
        `[SearchPanel] 🔎 Search completed in ${(endTime - startTime).toFixed(2)}ms for "${query}"`,
      );
    } catch (error) {
      console.error("[SearchPanel] Error searching manga:", error);
      setError("Failed to search for manga. Please try again.");
      if (pageNum === 1) {
        setSearchResults([]);
        console.debug(`[SearchPanel] ⚠️ Search error - cleared results`);
      }
    } finally {
      setIsSearching(false);
      console.debug(
        `[SearchPanel] 🔎 Search complete, isSearching set to false`,
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    handleSearch(searchQuery);
  };

  const loadMoreResults = () => {
    handleSearch(searchQuery, page + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (e.target === searchInputRef.current) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e);
      } else if (e.key === "ArrowDown" && searchResults.length > 0) {
        e.preventDefault();
        setSelectedIndex(0);
      }
      return;
    }

    if (searchResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, searchResults.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev - 1;
          if (newIndex < 0) {
            searchInputRef.current?.focus();
            return -1;
          }
          return newIndex;
        });
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        onSelectMatch(searchResults[selectedIndex].manga);
      }
    }
  };

  const handleSelectResult = (match: MangaMatch, index: number) => {
    setSelectedIndex(index);
    onSelectMatch(match.manga); // Pass the manga object to the parent
  };

  /**
   * Displays a panel for searching and selecting AniList manga matches for a given Kenmei manga, supporting manual search and result selection.
   *
   * @param props - The props for the MangaSearchPanel component.
   * @returns The rendered manga search panel React element.
   * @source
   * @example
   * ```tsx
   * <MangaSearchPanel
   *   kenmeiManga={manga}
   *   onClose={handleClose}
   *   onSelectMatch={handleSelect}
   *   token={token}
   *   bypassCache={false}
   * />
   * ```
   */
  return (
    <div
      className="bg-linear-to-br relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/30 from-white/95 via-white/90 to-white/80 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-700/70 dark:from-slate-900/95 dark:via-slate-950/90 dark:to-slate-950/80"
      aria-modal="true"
      aria-labelledby="search-title"
      tabIndex={-1}
    >
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200/70 bg-white/90 p-2 text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white dark:focus-visible:ring-blue-500"
            aria-label="Go back"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <h2
            id="search-title"
            className={`${headerClasses} text-slate-900 dark:text-white`}
          >
            AniList search
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-slate-200/70 bg-white/90 p-2 text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white dark:focus-visible:ring-blue-500"
          aria-label="Close search panel"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      {kenmeiManga && (
        <div className="bg-linear-to-br mx-6 mt-6 rounded-2xl border border-white/30 from-blue-50/80 via-white/75 to-purple-50/70 p-6 shadow-[inset_0_0_1px_rgba(59,130,246,0.25)] dark:border-slate-700/60 dark:from-blue-900/40 dark:via-slate-900/60 dark:to-indigo-950/60">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-800/80 dark:text-blue-200/80">
            Matching for
          </h3>
          <p
            className={`${titleClasses} mt-2 text-blue-900 dark:text-blue-200`}
          >
            {kenmeiManga.title}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-medium text-blue-800 shadow-sm ring-1 ring-blue-500/20 dark:bg-slate-900/60 dark:text-blue-200 dark:ring-blue-500/30">
              <span
                className="h-2 w-2 rounded-full bg-blue-500"
                aria-hidden="true"
              />
              {kenmeiManga.status}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-medium text-blue-800 shadow-sm ring-1 ring-blue-500/20 dark:bg-slate-900/60 dark:text-blue-200 dark:ring-blue-500/30">
              <span
                className="h-2 w-2 rounded-full bg-indigo-500"
                aria-hidden="true"
              />
              {kenmeiManga.chapters_read} chapters read
            </span>
            {kenmeiManga.score > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-medium text-blue-800 shadow-sm ring-1 ring-blue-500/20 dark:bg-slate-900/60 dark:text-blue-200 dark:ring-blue-500/30">
                <span
                  className="h-2 w-2 rounded-full bg-purple-500"
                  aria-hidden="true"
                />
                Score: {kenmeiManga.score}/10
              </span>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-white/20 bg-white/60 p-6 shadow-inner dark:border-slate-700/70 dark:bg-slate-900/50">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 lg:flex-row lg:items-center"
        >
          <div className="relative flex-1 rounded-2xl bg-white/80 shadow-sm ring-1 ring-slate-200/70 transition focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900/80 dark:ring-slate-700/70">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
              <Search className="h-6 w-6 text-slate-400" aria-hidden="true" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full rounded-2xl border-0 bg-transparent p-4 pl-14 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-0 dark:text-slate-100"
              placeholder="Search by manga title or AniList ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              aria-label="Search manga title or AniList ID"
              autoComplete="off"
              onKeyDown={handleKeyDown}
              data-search-input
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <span className="hidden text-xs font-semibold uppercase tracking-[0.3em] text-slate-400/70 sm:block">
                Enter ↵
              </span>
            </div>
          </div>
          <button
            type="submit"
            className="bg-linear-to-r inline-flex items-center justify-center rounded-2xl from-blue-600 via-indigo-600 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-indigo-500/30"
            disabled={isSearching || !searchQuery.trim()}
            aria-label={isSearching ? "Searching..." : "Search for manga"}
          >
            {isSearching ? (
              <>
                <Loader2
                  className="mr-2 h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {/* Search hint */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700/60">
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Pro tip
          </span>
          <span className="text-slate-500 dark:text-slate-300">
            Search by title (e.g., “Attack on Titan”) or jump straight to an
            AniList ID (e.g., “53390”).
          </span>
        </div>
      </div>

      <section
        ref={resultsContainerRef}
        className="flex-1 overflow-y-auto p-6"
        aria-label="Search results"
        aria-live="polite"
      >
        {error && (
          <div
            className="mb-6 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-base text-red-700 shadow-sm backdrop-blur dark:border-red-500/20 dark:bg-red-900/30 dark:text-red-200"
            role="alert"
          >
            <p>{error}</p>
          </div>
        )}

        {isSearching && (
          <div className="mb-6 flex items-center justify-center gap-3 rounded-3xl border border-blue-200/60 bg-blue-50/70 px-4 py-5 text-base font-medium text-blue-700 shadow-sm dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-200">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Searching...
          </div>
        )}

        {searchResults.length === 0 && !isSearching && !error && (
          <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300/70 bg-white/60 p-8 text-center text-lg text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            <Sparkles
              className="mb-3 h-9 w-9 text-blue-500"
              aria-hidden="true"
            />
            {searchQuery.trim()
              ? "No results just yet—try refining your keywords or searching by AniList ID."
              : "Start by typing a title or AniList ID to discover the best match."}
          </div>
        )}

        <div className="space-y-6">
          {searchResults.map((result, index) => {
            const manga = result.manga; // Extract manga for easier access
            const mangaId = manga.id;
            const uniqueKey = mangaId
              ? `manga-${mangaId}`
              : `manga-${index}-${manga.title?.romaji?.replaceAll(" ", "") || "unknown"}`;
            const isSelected = index === selectedIndex;

            return (
              <div
                key={uniqueKey}
                data-index={index}
                className={`group relative overflow-hidden rounded-2xl border border-white/25 bg-white/85 p-6 shadow-[0_24px_45px_-35px_rgba(59,130,246,0.45)] backdrop-blur transition-all duration-300 dark:border-slate-700/60 dark:bg-slate-900/75 ${
                  isSelected
                    ? "ring-2 ring-blue-400/80 ring-offset-2 ring-offset-white dark:ring-blue-400/60 dark:ring-offset-slate-950"
                    : "ring-1 ring-slate-200/70 hover:-translate-y-1 hover:border-blue-300/50 hover:ring-blue-300/60 dark:ring-slate-800/70"
                }`}
                aria-pressed={isSelected}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
                  aria-hidden="true"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(59,130,246,0.14), transparent 60%)",
                  }}
                />
                <div className="relative flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                  {(manga.coverImage?.large || manga.coverImage?.medium) && (
                    <div className="z-1 relative shrink-0">
                      {isAdultContent(manga) ? (
                        <button
                          type="button"
                          tabIndex={0}
                          aria-label={
                            shouldBlurImage(`search-${manga.id}`)
                              ? "Reveal adult content cover"
                              : "Hide adult content cover"
                          }
                          className="focus:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleImageBlur(`search-${manga.id}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleImageBlur(`search-${manga.id}`);
                            }
                          }}
                        >
                          <img
                            src={
                              manga.coverImage.large || manga.coverImage.medium
                            }
                            alt={`Cover for ${manga.title?.english || manga.title?.romaji || "manga"}`}
                            className={`h-44 w-32 rounded-2xl border border-white/40 object-cover shadow-xl transition duration-300 hover:scale-[1.03] hover:shadow-2xl dark:border-slate-700 ${
                              shouldBlurImage(`search-${manga.id}`)
                                ? "cursor-pointer blur-lg"
                                : ""
                            }`}
                            loading="lazy"
                            draggable={false}
                          />
                        </button>
                      ) : (
                        <img
                          src={
                            manga.coverImage.large || manga.coverImage.medium
                          }
                          alt={`Cover for ${manga.title?.english || manga.title?.romaji || "manga"}`}
                          className="h-44 w-32 rounded-2xl border border-white/40 object-cover shadow-xl transition duration-300 hover:scale-[1.03] hover:shadow-2xl dark:border-slate-700"
                          loading="lazy"
                          draggable={false}
                        />
                      )}
                      {/* Adult content warning badge */}
                      {isAdultContent(manga) && (
                        <div className="absolute left-1 top-1">
                          <span
                            className="inline-flex items-center rounded-md bg-red-600 px-1 py-0 text-xs font-medium text-white"
                            title="Adult Content"
                          >
                            18+
                          </span>
                        </div>
                      )}
                      {/* Click to reveal hint for blurred images */}
                      {isAdultContent(manga) &&
                        shouldBlurImage(`search-${manga.id}`) && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              type="button"
                              tabIndex={0}
                              className="inline-flex cursor-pointer items-center rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-slate-900/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleImageBlur(`search-${manga.id}`);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleImageBlur(`search-${manga.id}`);
                                }
                              }}
                              aria-label={
                                shouldBlurImage(`search-${manga.id}`)
                                  ? "Reveal adult content cover"
                                  : "Hide adult content cover"
                              }
                            >
                              Click to reveal
                            </button>
                          </div>
                        )}
                    </div>
                  )}

                  <div className="z-1 relative flex-1 space-y-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <h3 className="text-2xl font-semibold text-slate-900 transition duration-200 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-200">
                          {manga.title?.english ||
                            manga.title?.romaji ||
                            "Unknown Title"}
                        </h3>

                        {manga.title?.romaji &&
                          manga.title.romaji !== manga.title.english && (
                            <p className="text-base text-slate-500 dark:text-slate-400">
                              {manga.title.romaji}
                            </p>
                          )}

                        {/* Alternative source badges */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Show unified sourceInfo badge */}
                          {result.sourceInfo && (
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${getSourceBadgeClasses(result.sourceInfo.source)}`}
                              >
                                📚 Found via{" "}
                                {result.sourceInfo.source === "mangadex"
                                  ? "MangaDex"
                                  : result.sourceInfo.source}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-slate-400">
                                ({result.sourceInfo.title})
                              </span>
                            </div>
                          )}

                          {/* Show individual source badges when both exist */}
                          {!result.sourceInfo && (
                            <>
                              {result.comickSource && (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-2 rounded-full bg-orange-100/90 px-3 py-1 text-xs font-semibold text-orange-800 shadow-sm ring-1 ring-orange-200/60 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-400/30">
                                    📚 Found via Comick
                                  </span>
                                  <span className="text-xs text-slate-400 dark:text-slate-400">
                                    ({result.comickSource.title})
                                  </span>
                                </div>
                              )}
                              {result.mangaDexSource && (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-100/90 px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm ring-1 ring-blue-200/60 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/30">
                                    📚 Found via MangaDex
                                  </span>
                                  <span className="text-xs text-slate-400 dark:text-slate-400">
                                    ({result.mangaDexSource.title})
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-3">
                        {typeof result.confidence === "number" && (
                          <span className="bg-linear-to-r inline-flex items-center gap-2 rounded-full from-blue-600/90 to-purple-600/90 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-blue-600/30">
                            <Gauge className="h-4 w-4" aria-hidden="true" />
                            {Math.round(result.confidence)}% match
                          </span>
                        )}
                        <a
                          href={`https://anilist.co/manga/${manga.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-blue-100/80 bg-white/80 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-400 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-blue-500/30 dark:bg-slate-900/70 dark:text-blue-200 dark:hover:border-blue-400/60"
                          aria-label="View on AniList"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={16} aria-hidden="true" /> View on
                          AniList
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {manga.format && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-blue-100/90 px-3 py-1 text-sm font-medium text-blue-800 shadow-sm dark:bg-blue-900/20 dark:text-blue-200">
                          {manga.format.replace("_", " ")}
                        </span>
                      )}

                      {manga.status && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-green-100/90 px-3 py-1 text-sm font-medium text-green-800 shadow-sm dark:bg-green-900/20 dark:text-green-200">
                          {manga.status.replace("_", " ")}
                        </span>
                      )}

                      {manga.chapters && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-purple-100/90 px-3 py-1 text-sm font-medium text-purple-800 shadow-sm dark:bg-purple-900/20 dark:text-purple-200">
                          {manga.chapters} chapters
                        </span>
                      )}
                    </div>

                    {/* User's current list status (if on their list) */}
                    {(() => {
                      const mediaListEntry = manga.mediaListEntry;

                      if (!mediaListEntry || !isOnUserList(mediaListEntry)) {
                        return null;
                      }

                      return (
                        <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4 text-sm shadow-inner dark:border-blue-400/20 dark:bg-blue-900/30">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                              On your list
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeColor(mediaListEntry.status)}`}
                            >
                              {formatMediaListStatus(mediaListEntry.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-blue-800 dark:text-blue-200">
                            <span>
                              Progress: {mediaListEntry.progress || 0}
                              {result.chapters &&
                                result.chapters > 0 &&
                                ` / ${result.chapters}`}
                            </span>
                            <span>
                              Score: {formatScore(mediaListEntry.score)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="z-1 relative flex flex-col items-end justify-between gap-4 self-stretch lg:gap-5">
                    <button
                      className={`inline-flex items-center gap-2 rounded-full border border-blue-400/40 px-4 py-2 text-sm font-semibold text-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-blue-500/30 dark:text-blue-200 ${
                        isSelected
                          ? "bg-blue-500/20"
                          : "bg-white/70 hover:bg-blue-50 dark:bg-slate-900/60 dark:hover:bg-slate-800/70"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectResult(result, index);
                      }}
                      aria-label="Select this manga match"
                    >
                      <Check size={18} aria-hidden="true" /> Select match
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {hasNextPage && (
            <button
              className="group relative w-full overflow-hidden rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-center text-base font-semibold text-blue-700 shadow-md shadow-blue-200/40 transition hover:-translate-y-0.5 hover:border-blue-300/60 hover:text-blue-900 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-blue-200 dark:hover:border-blue-400/60"
              onClick={loadMoreResults}
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2
                    className="mr-2 inline h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                  Loading more...
                </>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Load more results
                </span>
              )}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
