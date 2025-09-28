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
} from "lucide-react";
import { KenmeiManga } from "../../api/kenmei/types";
import { AniListManga, MangaMatch } from "../../api/anilist/types";
import { searchMangaByTitle } from "../../api/matching/manga-search-service";
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
  const headerClasses = "text-xl font-medium"; // Increased from text-lg
  const titleClasses = "text-2xl font-semibold"; // Increased from text-lg

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
    console.log(`🔎 Detected AniList ID search: ${mangaId}`);

    const idResults = await getMangaByIds([mangaId], token);

    if (idResults.length > 0) {
      console.log(`🔎 Found manga by ID ${mangaId}:`, idResults[0]);

      const idMatches: MangaMatch[] = idResults.map((manga) => ({
        manga,
        confidence: 100,
      }));

      updateSearchResults(idMatches, pageNum, {
        hasNextPage: false,
        currentPage: 1,
      });
    } else {
      console.log(`⚠️ No manga found for ID ${mangaId}`);
      if (pageNum === 1) {
        setSearchResults([]);
      }
      setHasNextPage(false);
    }

    const endTime = performance.now();
    console.log(
      `🔎 Search completed in ${(endTime - startTime).toFixed(2)}ms for ID ${mangaId}`,
    );
  };

  // Handle title-based search
  const handleTitleSearch = async (
    query: string,
    pageNum: number,
    startTime: number,
  ) => {
    console.log(`🔎 Performing title search for: "${query}"`);

    const searchConfig = {
      bypassCache: !!bypassCache,
      maxSearchResults: 30,
      searchPerPage: 50,
      exactMatchingOnly: false,
    };

    console.log(`🔎 Search config:`, searchConfig);

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

    console.log(
      `🔎 Search completed in ${(endTime - startTime).toFixed(2)}ms for "${query}"`,
    );
    console.log(`🔎 Search returned ${results.length} results for "${query}"`);

    logSearchResults(results, query);
    updateSearchResults(results, pageNum, pageInfo);
  };

  // Log search results for debugging
  const logSearchResults = (results: MangaMatch[], query: string) => {
    if (results.length > 0) {
      console.log(
        `🔎 Titles received:`,
        results.map((m) => ({
          title: m.manga.title?.romaji || m.manga.title?.english || "unknown",
          confidence: m.confidence.toFixed(1),
          id: m.manga.id,
        })),
      );
    } else {
      console.log(
        `⚠️ No results found for "${query}" - this could indicate a cache or display issue`,
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
      console.log(`🔎 Resetting search results`);
      setSearchResults(results);
    } else {
      console.log(
        `🔎 Appending ${results.length} results to existing ${searchResults.length} results`,
      );
      setSearchResults((prev) => {
        const existingIds = new Set(prev.map((match) => match.manga.id));
        const newUniqueResults = results.filter(
          (match) => !existingIds.has(match.manga.id),
        );

        console.log(
          `🔎 Adding ${newUniqueResults.length} unique results (filtered ${results.length - newUniqueResults.length} duplicates)`,
        );

        return [...prev, ...newUniqueResults];
      });
    }

    if (pageInfo) {
      console.log(`🔎 Using API pagination info:`, pageInfo);
      setHasNextPage(pageInfo.hasNextPage);
      setPage(pageInfo.currentPage);
    } else {
      console.log(`🔎 No pagination info available, using fallback logic`);
      setHasNextPage(false);
      setPage(pageNum);
    }

    console.log(
      `🔎 UI state updated: searchResults.length=${results.length}, hasNextPage=${pageInfo?.hasNextPage || false}, page=${pageInfo?.currentPage || pageNum}`,
    );
  };

  const handleSearch = async (query: string, pageNum: number = 1) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      console.log(
        `🔎 Starting search for: "${query}" with bypassCache=${!!bypassCache}, page=${pageNum}`,
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
      console.log(
        `🔎 Search completed in ${(endTime - startTime).toFixed(2)}ms for "${query}"`,
      );
    } catch (error) {
      console.error("Error searching manga:", error);
      setError("Failed to search for manga. Please try again.");
      if (pageNum === 1) {
        setSearchResults([]);
        console.log(`⚠️ Search error - cleared results`);
      }
    } finally {
      setIsSearching(false);
      console.log(`🔎 Search complete, isSearching set to false`);
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
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
      aria-modal="true"
      aria-labelledby="search-title"
      tabIndex={-1}
    >
      <div className="border-b border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="mr-4 rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Go back"
            >
              <ArrowLeft size={24} aria-hidden="true" />
            </button>
            <h2
              id="search-title"
              className={`${headerClasses} text-gray-900 dark:text-white`}
            >
              Search for manga
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close search panel"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
      </div>

      {kenmeiManga && (
        <div className="border-b border-gray-200 bg-blue-50 p-5 dark:border-gray-700 dark:bg-blue-900/20">
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
            Looking for a match for:
          </h3>
          <p className={`${titleClasses} text-blue-700 dark:text-blue-300`}>
            {kenmeiManga.title}
          </p>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            {kenmeiManga.status} • {kenmeiManga.chapters_read} chapters read
            {kenmeiManga.score > 0 && ` • Score: ${kenmeiManga.score}/10`}
          </p>
        </div>
      )}

      <div className="border-b border-gray-200 p-5 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-3 pl-12 text-base text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              placeholder="Search by manga title or AniList ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              aria-label="Search manga title or AniList ID"
              autoComplete="off"
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-blue-700 px-5 py-3 text-base font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-none disabled:bg-blue-400 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
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
        <div className="mt-2 px-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 Tip: You can search by title (e.g., &ldquo;Attack on
            Titan&rdquo;) or AniList ID (e.g., &ldquo;53390&rdquo;)
          </p>
        </div>
      </div>

      <section
        ref={resultsContainerRef}
        className="flex-1 overflow-y-auto p-5"
        aria-label="Search results"
        aria-live="polite"
      >
        {error && (
          <div
            className="mb-5 rounded-md bg-red-50 p-4 text-base text-red-700 dark:bg-red-900/20 dark:text-red-400"
            role="alert"
          >
            <p>{error}</p>
          </div>
        )}

        {searchResults.length === 0 && !isSearching && !error && (
          <div className="text-center text-lg text-gray-500 dark:text-gray-400">
            {searchQuery.trim()
              ? "No results found"
              : "Enter a search term to find manga"}
          </div>
        )}

        <div className="space-y-5">
          {searchResults.map((result, index) => {
            const manga = result.manga; // Extract manga for easier access
            const mangaId = manga.id;
            const uniqueKey = mangaId
              ? `manga-${mangaId}`
              : `manga-${index}-${manga.title?.romaji?.replace(/\s/g, "") || "unknown"}`;

            return (
              <div
                key={uniqueKey}
                data-index={index}
                className={`relative flex flex-col space-y-3 rounded-lg border p-5 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${
                  index === selectedIndex
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200"
                }`}
                aria-pressed={index === selectedIndex}
              >
                <div className="flex w-full items-start space-x-5">
                  {(manga.coverImage?.large || manga.coverImage?.medium) && (
                    <div className="relative flex-shrink-0">
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
                            className={`h-40 w-28 rounded border border-gray-200 object-cover shadow-sm transition-all hover:scale-[1.02] hover:shadow dark:border-gray-700 ${
                              shouldBlurImage(`search-${manga.id}`)
                                ? "cursor-pointer blur-md"
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
                          className="h-40 w-28 rounded border border-gray-200 object-cover shadow-sm transition-all hover:scale-[1.02] hover:shadow dark:border-gray-700"
                          loading="lazy"
                          draggable={false}
                        />
                      )}
                      {/* Adult content warning badge */}
                      {isAdultContent(manga) && (
                        <div className="absolute top-1 left-1">
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
                              className="bg-opacity-75 inline-flex cursor-pointer items-center rounded-md bg-gray-800 px-2 py-1 text-xs font-medium text-white"
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

                  <div className="flex-1 space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {manga.title?.english ||
                        manga.title?.romaji ||
                        "Unknown Title"}
                    </h3>

                    {manga.title?.romaji &&
                      manga.title.romaji !== manga.title.english && (
                        <p className="text-base text-gray-600 dark:text-gray-400">
                          {manga.title.romaji}
                        </p>
                      )}

                    {/* Alternative source badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Show unified sourceInfo badge */}
                      {result.sourceInfo && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getSourceBadgeClasses(result.sourceInfo.source)}`}
                          >
                            📚 Found via{" "}
                            {result.sourceInfo.source === "mangadex"
                              ? "MangaDex"
                              : result.sourceInfo.source}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({result.sourceInfo.title})
                          </span>
                        </div>
                      )}

                      {/* Show individual source badges when both exist */}
                      {!result.sourceInfo && (
                        <>
                          {result.comickSource && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                📚 Found via Comick
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({result.comickSource.title})
                              </span>
                            </div>
                          )}
                          {result.mangaDexSource && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                📚 Found via MangaDex
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({result.mangaDexSource.title})
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {manga.format && (
                        <span className="inline-flex items-center rounded-md bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {manga.format.replace("_", " ")}
                        </span>
                      )}

                      {manga.status && (
                        <span className="inline-flex items-center rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          {manga.status.replace("_", " ")}
                        </span>
                      )}

                      {manga.chapters && (
                        <span className="inline-flex items-center rounded-md bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
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
                        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              On Your List:
                            </span>
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusBadgeColor(mediaListEntry.status)}`}
                            >
                              {formatMediaListStatus(mediaListEntry.status)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-blue-700 dark:text-blue-300">
                              Progress: {mediaListEntry.progress || 0}
                              {result.chapters &&
                                result.chapters > 0 &&
                                ` / ${result.chapters}`}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-blue-700 dark:text-blue-300">
                              Score: {formatScore(mediaListEntry.score)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {manga.genres
                        ?.slice(0, 3)
                        .map((genre: string, i: number) => (
                          <span
                            key={`${uniqueKey}-genre-${i}`}
                            className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          >
                            {genre}
                          </span>
                        ))}
                      {manga.genres && manga.genres.length > 3 && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          +{manga.genres.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-auto flex flex-col items-end justify-between self-stretch">
                    <a
                      href={`https://anilist.co/manga/${manga.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      aria-label="View on AniList"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={20} aria-hidden="true" />
                    </a>

                    <button
                      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-blue-600 dark:hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectResult(result, index);
                      }}
                      aria-label="Select this manga match"
                    >
                      <Check size={18} className="mr-2" aria-hidden="true" />{" "}
                      Select
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {hasNextPage && (
            <button
              className="w-full rounded-md border border-gray-200 bg-white py-3 text-center text-base font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
                "Load more results"
              )}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
