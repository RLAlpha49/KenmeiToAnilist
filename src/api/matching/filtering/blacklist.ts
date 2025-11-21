/**
 * Blacklisted AniList manga titles that should never be surfaced to the user.
 * @module matching/filtering/blacklist
 */

import type { AniListManga } from "@/api/anilist/types";

const BLACKLISTED_MANGA_TITLES = [
  "watashi, isekai de dorei ni sarechaimashita (naki) shikamo goshujinsama wa seikaku no warui elf no joousama (demo chou bijin ← koko daiji) munou sugite nonoshiraremakuru kedo douryou no orc ga iyashi-kei da shi sato no elf wa kawaii shi",
  "Maoudou: Sen-nen Mae no Maou ga Fukkatsushitara Saijaku Mamono no Kobold Datta ga, Chishiki Keiken ni Otoroenashi. Kami to Seigi no Na no Shita ni Yaritai Houdaishiteiru Ningendomo wo Shitsuke Keteyaru to Shiyou",
];

const NORMALIZED_BLACKLISTED_TITLES = new Set(
  BLACKLISTED_MANGA_TITLES.map((title) => title.trim().toLowerCase()),
);

function getMangaTitles(manga: AniListManga): string[] {
  return [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
  ]
    .filter(Boolean)
    .map((title) => title!.trim().toLowerCase());
}

/**
 * @returns True if the manga matches any of the blacklisted titles.
 */
export function isBlacklistedManga(manga: AniListManga): boolean {
  const titlesToCheck = getMangaTitles(manga);
  return titlesToCheck.some((title) =>
    NORMALIZED_BLACKLISTED_TITLES.has(title),
  );
}

/**
 * Remove blacklisted manga entries from a list of AniList results.
 */
export function filterOutBlacklistedManga(
  results: AniListManga[],
): AniListManga[] {
  if (results.length === 0) {
    return results;
  }

  const filtered = results.filter((manga) => !isBlacklistedManga(manga));

  if (filtered.length !== results.length) {
    console.debug(
      `[MangaSearchService] 🧹 Removed ${results.length - filtered.length} blacklisted AniList result(s)`,
    );
  }

  return filtered;
}
