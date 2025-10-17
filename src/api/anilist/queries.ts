/**
 * @packageDocumentation
 * @module anilist-queries
 * @description GraphQL queries for AniList API, including user, manga, and advanced search queries.
 */

/**
 * Query to fetch the current AniList user (Viewer).
 *
 * @source
 */
export const GET_VIEWER = `
query {
  Viewer {
    id
    name
    avatar {
      large
      medium
    }
  }
}
`;

/**
 * Query to fetch a user's manga list from AniList.
 *
 * @source
 */
export const GET_USER_MANGA_LIST = `
query ($userId: Int, $chunk: Int, $perChunk: Int) {
  MediaListCollection(userId: $userId, type: MANGA, chunk: $chunk, perChunk: $perChunk) {
    lists {
      name
      entries {
        id
        mediaId
        status
        progress
        score
        private
        media {
          id
          title {
            romaji
            english
            native
          }
        }
      }
    }
  }
}
`;

/**
 * Query to search for manga by title.
 *
 * @source
 */
export const SEARCH_MANGA = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(type: MANGA, search: $search, format_not_in: [NOVEL]) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      format
      status
      chapters
      volumes
      coverImage {
        large
        medium
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
      isAdult
    }
  }
}
`;

/**
 * Query to perform an advanced manga search using the dedicated endpoint.
 *
 * @source
 */
export const ADVANCED_SEARCH_MANGA = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(type: MANGA, search: $search, format_not_in: [NOVEL]) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      format
      status
      chapters
      volumes
      coverImage {
        large
        medium
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
      isAdult
    }
  }
}
`;

/**
 * Query to fetch a single manga by its AniList ID.
 *
 * @source
 */
export const GET_MANGA_BY_ID = `
query ($id: Int) {
  Media(id: $id, type: MANGA, format_not_in: [NOVEL]) {
    id
    title {
      romaji
      english
      native
    }
    synonyms
    format
    status
    chapters
    volumes
    coverImage {
      large
      medium
    }
    mediaListEntry {
      id
      status
      progress
      score
      private
    }
    isAdult
  }
}
`;

/**
 * Query to fetch multiple manga by their IDs in a single request. Can fetch up to 50 manga at once.
 *
 * @source
 */
export const GET_MANGA_BY_IDS = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(id_in: $ids, type: MANGA, format_not_in: [NOVEL]) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      format
      status
      chapters
      volumes
      coverImage {
        large
        medium
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
      isAdult
    }
  }
}
`;
