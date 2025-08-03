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
          format
          status
          chapters
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
    media(type: MANGA, search: $search) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description
      format
      status
      chapters
      volumes
      countryOfOrigin
      source
      coverImage {
        large
        medium
      }
      genres
      tags {
        id
        name
        category
      }
      startDate {
        year
        month
        day
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
    }
  }
}
`;

/**
 * Query to perform an advanced manga search with filters.
 *
 * @source
 */
export const ADVANCED_SEARCH_MANGA = `
query ($search: String, $page: Int, $perPage: Int, $genre_in: [String], $tag_in: [String], $format_in: [MediaFormat]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(
      type: MANGA, 
      search: $search, 
      genre_in: $genre_in, 
      tag_in: $tag_in, 
      format_in: $format_in
    ) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description
      format
      status
      chapters
      volumes
      countryOfOrigin
      coverImage {
        large
        medium
      }
      genres
      tags {
        id
        name
        category
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
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
  Media(id: $id, type: MANGA) {
    id
    title {
      romaji
      english
      native
    }
    synonyms
    description
    format
    status
    chapters
    volumes
    coverImage {
      large
      medium
    }
    genres
    tags {
      id
      name
    }
    mediaListEntry {
      id
      status
      progress
      score
      private
    }
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
    media(id_in: $ids, type: MANGA) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description
      format
      status
      chapters
      volumes
      countryOfOrigin
      source
      coverImage {
        large
        medium
      }
      genres
      tags {
        id
        name
        category
      }
      startDate {
        year
        month
        day
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
    }
  }
}
`;
