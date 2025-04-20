import { vi } from "vitest";

// Helper for creating a mock fetch response
export function createMockResponse(
  data: any,
  init: ResponseInit = { status: 200 },
): Response {
  return new Response(JSON.stringify(data), init);
}

// Helper for creating a mock GraphQL response
export function createMockGraphQLResponse(data: any, errors?: any[]) {
  const response: any = { data };
  if (errors) {
    response.errors = errors;
  }
  return createMockResponse(response);
}

// Helper for creating a rate limit response
export function createRateLimitResponse(retryAfter = 60) {
  return createMockResponse(
    { message: "Rate limit exceeded" },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": "90",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": (
          Math.floor(Date.now() / 1000) + retryAfter
        ).toString(),
      },
    },
  );
}

// Helper for mocking fetch with GraphQL responses
export function mockFetchForGraphQL(
  responseData: any,
  options: { status?: number; errors?: any[] } = {},
) {
  const { status = 200, errors } = options;

  return vi.fn().mockImplementation(() => {
    const response = {
      ok: status >= 200 && status < 300,
      status,
      json: vi
        .fn()
        .mockResolvedValue(
          errors ? { data: responseData, errors } : { data: responseData },
        ),
    };

    return Promise.resolve(response as unknown as Response);
  });
}

// Helper for simulating network errors
export function mockFetchWithNetworkError(errorMessage = "Network error") {
  return vi.fn().mockRejectedValue(new Error(errorMessage));
}

// Helper for simulating server errors
export function mockFetchWithServerError(
  statusCode = 500,
  message = "Internal Server Error",
) {
  return vi.fn().mockImplementation(() => {
    const response = {
      ok: false,
      status: statusCode,
      statusText: message,
      json: vi.fn().mockResolvedValue({ error: message }),
    };

    return Promise.resolve(response as unknown as Response);
  });
}

// Helper for creating mock AniList API responses
export function createMockAniListUserResponse(overrides = {}) {
  return {
    data: {
      Viewer: {
        id: 123456,
        name: "TestUser",
        avatar: {
          large: "https://example.com/avatar.png",
        },
        mediaListOptions: {
          scoreFormat: "POINT_10",
        },
        ...overrides,
      },
    },
  };
}

// Helper for creating mock manga list response
export function createMockMangaListResponse(count = 3) {
  const entries = [];

  for (let i = 1; i <= count; i++) {
    entries.push({
      id: i,
      status: i === 1 ? "CURRENT" : i === 2 ? "COMPLETED" : "PLANNING",
      score: i === 1 ? 8 : i === 2 ? 10 : 0,
      progress: i === 1 ? 42 : i === 2 ? 100 : 0,
      media: {
        id: 100 + i,
        title: {
          english: `Test Manga ${i}`,
          romaji: `Test Manga ${i}`,
          native: `テストマンガ ${i}`,
        },
        chapters: i === 2 ? 100 : null,
      },
    });
  }

  return {
    data: {
      MediaListCollection: {
        lists: [
          {
            name: "Reading",
            entries: entries.filter((e) => e.status === "CURRENT"),
          },
          {
            name: "Completed",
            entries: entries.filter((e) => e.status === "COMPLETED"),
          },
          {
            name: "Planning",
            entries: entries.filter((e) => e.status === "PLANNING"),
          },
        ],
      },
    },
  };
}

// Helper for creating mock manga search response
export function createMockMangaSearchResponse(searchQuery: string, count = 5) {
  const media = [];

  for (let i = 1; i <= count; i++) {
    media.push({
      id: 200 + i,
      title: {
        english: `${searchQuery} ${i}`,
        romaji: `${searchQuery} ${i}`,
        native: `${searchQuery}${i}`,
      },
      coverImage: {
        large: `https://example.com/${searchQuery.toLowerCase().replace(/\s+/g, "-")}-${i}.jpg`,
      },
      description: `This is a description for ${searchQuery} ${i}`,
      format: "MANGA",
      status: i % 2 === 0 ? "FINISHED" : "RELEASING",
      chapters: i % 2 === 0 ? 100 + i : null,
    });
  }

  return {
    data: {
      Page: {
        media,
      },
    },
  };
}

// Helper for mocking rate limit responses with different strategies
export class RateLimitMocker {
  private callCount = 0;
  private rateLimitAfter: number;
  private retryAfter: number;

  constructor(rateLimitAfter = 3, retryAfter = 60) {
    this.rateLimitAfter = rateLimitAfter;
    this.retryAfter = retryAfter;
  }

  mockFetch(normalResponse: any) {
    return vi.fn().mockImplementation(() => {
      this.callCount++;

      if (this.callCount > this.rateLimitAfter) {
        return Promise.resolve(createRateLimitResponse(this.retryAfter));
      }

      return Promise.resolve(createMockResponse(normalResponse));
    });
  }

  reset() {
    this.callCount = 0;
  }
}

// Helper for testing paginated responses
export function mockPaginatedResponses(pages: any[]) {
  let currentPage = 0;

  return vi.fn().mockImplementation(() => {
    const page =
      currentPage < pages.length
        ? pages[currentPage]
        : { data: { Page: { media: [] } } };
    currentPage++;

    return Promise.resolve(createMockResponse(page));
  });
}
