/**
 * GraphQL queries for AniList API
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
    }
  }
}
`;

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
    }
  }
}
`;

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
  }
}
`;

/**
 * Query to fetch multiple manga by their IDs in a single request
 * Can fetch up to 50 manga at once
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
    }
  }
}
`;
