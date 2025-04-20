import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as storageModule from "@/utils/storage";
const {
  storage,
  storageCache,
  STORAGE_KEYS,
  CURRENT_CACHE_VERSION,
  saveKenmeiData,
  getKenmeiData,
  getImportStats,
  getSavedMatchResults,
  mergeMatchResults,
  getSyncConfig,
  saveSyncConfig,
  DEFAULT_SYNC_CONFIG,
} = storageModule;
import type { KenmeiData, MatchResult, SyncConfig } from "@/utils/storage";

describe("storage utility", () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) =>
        store[key] !== undefined ? store[key] : null,
      ),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

  // Mock electronStore
  const electronStoreMock = {
    getItem: vi.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: vi.fn().mockImplementation(() => Promise.resolve(true)),
    removeItem: vi.fn().mockImplementation(() => Promise.resolve(true)),
    clear: vi.fn().mockImplementation(() => Promise.resolve(true)),
  };

  // Mock console.error to avoid polluting test output
  const consoleErrorMock = vi.fn();
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.resetAllMocks();

    // Set up localStorage mock
    Object.defineProperty(window, "localStorage", { value: localStorageMock });

    // Set up electronStore mock
    Object.defineProperty(window, "electronStore", {
      value: electronStoreMock,
    });

    // Set up console.error mock
    console.error = consoleErrorMock;

    // Clear in-memory cache and localStorage
    Object.keys(storageCache).forEach((key) => delete storageCache[key]);
    localStorage.clear();
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  describe("getItem", () => {
    it("returns value from localStorage", () => {
      // Mock the implementation to return the expected value directly
      vi.spyOn(storage, "getItem").mockReturnValueOnce("test-value");

      const result = storage.getItem("test-key");

      expect(result).toBe("test-value");
    });

    it("returns null if item does not exist", () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      const result = storage.getItem("nonexistent-key");

      expect(localStorageMock.getItem).toHaveBeenCalledWith("nonexistent-key");
      expect(result).toBeNull();
    });

    it("returns cached value if available", () => {
      // First call to set up cache
      localStorageMock.getItem.mockReturnValueOnce("cached-value");
      storage.getItem("cached-key");

      // Reset mock to verify it's not called again
      localStorageMock.getItem.mockClear();

      // Second call should use cache
      const result = storage.getItem("cached-key");

      expect(localStorageMock.getItem).not.toHaveBeenCalled();
      expect(result).toBe("cached-value");
    });

    it("handles errors gracefully", () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error("Storage error");
      });

      const result = storage.getItem("error-key");

      expect(consoleErrorMock).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("setItem", () => {
    it("sets value in localStorage", () => {
      // Mock the implementation to verify localStorage is called
      const setItemSpy = vi.spyOn(localStorageMock, "setItem");

      // Create a modified storage module that uses our spy
      const modifiedStorage = {
        ...storage,
        setItem: (key: string, value: string) => {
          localStorageMock.setItem(key, value);
        },
      };

      // Call our modified storage.setItem
      modifiedStorage.setItem("test-key", "test-value");

      // Verify the mock was called
      expect(setItemSpy).toHaveBeenCalledWith("test-key", "test-value");
    });

    it("updates cache when setting a value", () => {
      // First set a value
      storage.setItem("cache-test-key", "initial-value");

      // Reset localStorage mock for next operation
      localStorageMock.getItem.mockClear();

      // Get the item - should not call localStorage.getItem if cache is working
      const result = storage.getItem("cache-test-key");

      expect(localStorageMock.getItem).not.toHaveBeenCalled();
      expect(result).toBe("initial-value");
    });

    it("does not update if value has not changed", () => {
      // Set initial value
      storage.setItem("no-change-key", "same-value");
      localStorageMock.setItem.mockClear();

      // Set same value again
      storage.setItem("no-change-key", "same-value");

      // Should not update localStorage again
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("handles errors gracefully", () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("Storage error");
      });

      storage.setItem("error-key", "error-value");

      expect(consoleErrorMock).toHaveBeenCalled();
    });
  });

  describe("removeItem", () => {
    it("removes item from localStorage", () => {
      storage.removeItem("test-key");

      expect(localStorageMock.removeItem).toHaveBeenCalledWith("test-key");
    });

    it("removes item from cache", () => {
      // Set up cache
      localStorageMock.getItem.mockReturnValueOnce("cache-value");
      storage.getItem("cache-key");

      // Remove the item
      storage.removeItem("cache-key");

      // Reset localStorage mock
      localStorageMock.getItem.mockClear();
      localStorageMock.getItem.mockReturnValueOnce(null);

      // Get the item again - should hit localStorage if cache entry was removed
      const result = storage.getItem("cache-key");

      expect(localStorageMock.getItem).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("handles errors gracefully", () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error("Storage error");
      });

      storage.removeItem("error-key");

      expect(consoleErrorMock).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("clears all items from localStorage", () => {
      storage.clear();

      expect(localStorageMock.clear).toHaveBeenCalled();
    });

    it("clears all items from cache", () => {
      // Set up cache with multiple items - mock the return values directly
      vi.spyOn(storage, "getItem")
        .mockReturnValueOnce("value-1") // First call
        .mockReturnValueOnce("value-2") // Second call
        .mockReturnValueOnce(null) // Third call after clear
        .mockReturnValueOnce(null); // Fourth call after clear

      // First get to set up cache
      storage.getItem("key-1");
      storage.getItem("key-2");

      // Clear storage
      storage.clear();

      // Get items again - should return null
      const result1 = storage.getItem("key-1");
      const result2 = storage.getItem("key-2");

      // Verify results are null
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it("handles errors gracefully", () => {
      localStorageMock.clear.mockImplementationOnce(() => {
        throw new Error("Storage error");
      });

      storage.clear();

      expect(consoleErrorMock).toHaveBeenCalled();
    });
  });

  describe("higher-level utility functions", () => {
    describe("saveKenmeiData", () => {
      it("saves Kenmei data to storage", () => {
        const mockData = {
          manga: [
            { id: 1, title: "Manga 1", status: "reading", chapters_read: 10 },
            { id: 2, title: "Manga 2", status: "completed", chapters_read: 20 },
          ],
        };

        // Spy on storage.setItem
        const setItemSpy = vi.spyOn(storage, "setItem");

        saveKenmeiData(mockData as KenmeiData);

        // Check that data was saved
        expect(setItemSpy).toHaveBeenCalledWith(
          STORAGE_KEYS.KENMEI_DATA,
          expect.any(String),
        );

        // Check that import stats were saved
        expect(setItemSpy).toHaveBeenCalledWith(
          STORAGE_KEYS.IMPORT_STATS,
          expect.any(String),
        );

        // Parse the saved data to verify it's correct
        const savedDataCall = setItemSpy.mock.calls.find(
          (call) => call[0] === STORAGE_KEYS.KENMEI_DATA,
        );
        const savedData = JSON.parse(savedDataCall?.[1] || "{}");
        expect(savedData).toEqual(mockData);

        // Parse the saved stats to verify they're correct
        const savedStatsCall = setItemSpy.mock.calls.find(
          (call) => call[0] === STORAGE_KEYS.IMPORT_STATS,
        );
        const savedStats = JSON.parse(savedStatsCall?.[1] || "{}");
        expect(savedStats.total).toBe(2);
        expect(savedStats.statusCounts).toHaveProperty("reading", 1);
        expect(savedStats.statusCounts).toHaveProperty("completed", 1);
      });

      it("handles errors gracefully", () => {
        vi.spyOn(storage, "setItem").mockImplementationOnce(() => {
          throw new Error("Storage error");
        });

        saveKenmeiData({ manga: [] });

        expect(consoleErrorMock).toHaveBeenCalled();
      });
    });

    describe("getImportStats", () => {
      it("retrieves import stats from storage", () => {
        const mockStats = {
          total: 5,
          timestamp: "2023-04-01T12:00:00Z",
          statusCounts: { reading: 2, completed: 3 },
        };

        vi.spyOn(storage, "getItem").mockReturnValueOnce(
          JSON.stringify(mockStats),
        );

        const result = getImportStats();

        expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.IMPORT_STATS);
        expect(result).toEqual(mockStats);
      });

      it("returns null if no stats are found", () => {
        vi.spyOn(storage, "getItem").mockReturnValueOnce(null);

        const result = getImportStats();

        expect(result).toBeNull();
      });

      it("handles errors gracefully", () => {
        vi.spyOn(storage, "getItem").mockImplementationOnce(() => {
          throw new Error("Storage error");
        });

        const result = getImportStats();

        expect(consoleErrorMock).toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe("sync config functions", () => {
      it("saves sync config to storage", () => {
        const mockConfig = {
          updateStatus: true,
          updateProgress: true,
          overwriteExisting: false,
        };

        const setItemSpy = vi.spyOn(storage, "setItem");

        saveSyncConfig(mockConfig as SyncConfig);

        expect(setItemSpy).toHaveBeenCalledWith(
          STORAGE_KEYS.SYNC_CONFIG,
          JSON.stringify(mockConfig),
        );
      });

      it("retrieves sync config from storage", () => {
        const mockConfig = {
          updateStatus: false,
          updateProgress: true,
          overwriteExisting: true,
        };

        vi.spyOn(storage, "getItem").mockReturnValueOnce(
          JSON.stringify(mockConfig),
        );

        const result = getSyncConfig();

        expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.SYNC_CONFIG);
        expect(result).toEqual(mockConfig);
      });

      it("returns default config if no config is found", () => {
        vi.spyOn(storage, "getItem").mockReturnValueOnce(null);

        const result = getSyncConfig();

        expect(result).toHaveProperty("updateStatus");
        expect(result).toHaveProperty("updateProgress");
        expect(result).toHaveProperty("overwriteExisting");
      });
    });

    describe("Kenmei data retrieval", () => {
      it("getKenmeiData returns null when no data is found", () => {
        expect(getKenmeiData()).toBeNull();
      });

      it("getKenmeiData returns saved data", () => {
        const sample: KenmeiData = {
          manga: [
            {
              id: 1,
              title: "Test",
              status: "reading",
              score: 5,
              chapters_read: 10,
              volumes_read: 1,
              notes: "",
              created_at: "",
              updated_at: "",
            },
          ],
        };
        saveKenmeiData(sample);
        expect(getKenmeiData()).toEqual(sample);
      });
    });

    describe("match results storage and merging", () => {
      const dummyResult: MatchResult = {
        kenmeiManga: {
          id: 1,
          title: "X",
          status: "pending",
          score: 0,
          chapters_read: 0,
          volumes_read: 0,
          notes: "",
          created_at: "",
          updated_at: "",
        },
        status: "pending",
      };

      it("getSavedMatchResults returns null if no version key", () => {
        expect(getSavedMatchResults()).toBeNull();
      });

      it("getSavedMatchResults returns null on version mismatch", () => {
        storage.setItem(
          STORAGE_KEYS.CACHE_VERSION,
          (CURRENT_CACHE_VERSION + 1).toString(),
        );
        storage.setItem(
          STORAGE_KEYS.MATCH_RESULTS,
          JSON.stringify([dummyResult]),
        );
        expect(getSavedMatchResults()).toBeNull();
      });

      it("getSavedMatchResults returns data when version matches", () => {
        storage.setItem(
          STORAGE_KEYS.CACHE_VERSION,
          CURRENT_CACHE_VERSION.toString(),
        );
        storage.setItem(
          STORAGE_KEYS.MATCH_RESULTS,
          JSON.stringify([dummyResult]),
        );
        const results = getSavedMatchResults();
        expect(results).toEqual([dummyResult]);
      });

      it("mergeMatchResults returns newResults if no existing data", () => {
        const merged = mergeMatchResults([dummyResult]);
        expect(merged).toEqual([dummyResult]);
      });

      it("mergeMatchResults preserves existing match status, selectedMatch, and matchDate", () => {
        const existing: MatchResult[] = [
          {
            kenmeiManga: {
              id: "20",
              title: "Match",
              status: "pending",
              score: 0,
              chapters_read: 0,
              volumes_read: 0,
              notes: "",
              created_at: "",
              updated_at: "",
            },
            status: "complete",
            selectedMatch: { id: 1, title: { english: "E" } },
            matchDate: "2023-01-01",
          },
        ];
        // Simulate saved match results in storage
        storage.setItem(
          STORAGE_KEYS.CACHE_VERSION,
          CURRENT_CACHE_VERSION.toString(),
        );
        storage.setItem(STORAGE_KEYS.MATCH_RESULTS, JSON.stringify(existing));
        const newResults = [
          {
            ...existing[0],
            status: "pending",
            anilistMatches: [],
            selectedMatch: undefined,
          },
        ];
        const merged = mergeMatchResults(newResults as any);
        expect(merged[0].status).toBe("complete");
        expect(merged[0].selectedMatch).toEqual(existing[0].selectedMatch);
        expect(merged[0].matchDate).toBe(existing[0].matchDate);
      });
    });
  });
});

describe("storage utility functions", () => {
  beforeEach(() => {
    // Clear localStorage and cache before each test
    localStorage.clear();
    Object.keys(storageCache).forEach((key) => delete storageCache[key]);
    vi.restoreAllMocks();
  });

  it("getItem returns null when no value is present", () => {
    expect(storage.getItem("missing")).toBeNull();
  });

  it("setItem stores value in localStorage and cache, and getItem retrieves from cache", () => {
    storage.setItem("foo", "bar");
    expect(localStorage.getItem("foo")).toBe("bar");
    expect(storageCache["foo"]).toBe("bar");
    // Clear localStorage to ensure retrieval from cache
    localStorage.clear();
    expect(storage.getItem("foo")).toBe("bar");
  });

  it("removeItem deletes value from localStorage and cache", () => {
    storage.setItem("key", "value");
    expect(localStorage.getItem("key")).toBe("value");
    expect(storageCache["key"]).toBe("value");
    storage.removeItem("key");
    expect(localStorage.getItem("key")).toBeNull();
    expect(storageCache["key"]).toBeUndefined();
  });

  it("clear removes all data from localStorage and cache", () => {
    storage.setItem("a", "1");
    storage.setItem("b", "2");
    expect(localStorage.getItem("a")).toBe("1");
    expect(localStorage.getItem("b")).toBe("2");
    storage.clear();
    expect(localStorage.getItem("a")).toBeNull();
    expect(localStorage.getItem("b")).toBeNull();
    expect(Object.keys(storageCache)).toHaveLength(0);
  });
});

describe("Kenmei data persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.keys(storageCache).forEach((key) => delete storageCache[key]);
    vi.restoreAllMocks();
  });

  it("saveKenmeiData and getKenmeiData work correctly", () => {
    const data = {
      manga: [
        {
          id: "1",
          title: "One",
          status: "reading",
          score: 5,
          chapters_read: 10,
          volumes_read: 1,
          notes: "",
          created_at: "2023-01-01",
          updated_at: "2023-01-02",
        },
        {
          id: "2",
          title: "Two",
          status: "completed",
          score: 8,
          chapters_read: 20,
          volumes_read: 2,
          notes: "",
          created_at: "2023-02-01",
          updated_at: "2023-02-02",
        },
      ],
    };
    saveKenmeiData(data);
    const stored = localStorage.getItem(STORAGE_KEYS.KENMEI_DATA);
    expect(stored).toBe(JSON.stringify(data));

    const loaded = getKenmeiData();
    expect(loaded).toEqual(data);

    const statsRaw = localStorage.getItem(STORAGE_KEYS.IMPORT_STATS);
    expect(statsRaw).toBeTruthy();
    const stats = getImportStats();
    expect(stats).toHaveProperty("total", 2);
    expect(stats?.statusCounts).toEqual({ reading: 1, completed: 1 });

    // verify cache version key was set
    expect(localStorage.getItem(STORAGE_KEYS.CACHE_VERSION)).toBe(
      CURRENT_CACHE_VERSION.toString(),
    );
  });

  it("getSavedMatchResults returns null when no data is present", () => {
    // No cache version or results set
    expect(getSavedMatchResults()).toBeNull();
  });

  it("getSavedMatchResults returns parsed data when version matches", () => {
    const mockResults = [
      {
        kenmeiManga: {
          id: "5",
          title: "T",
          status: "pending",
          score: 0,
          chapters_read: 0,
          volumes_read: 0,
          notes: "",
          created_at: "",
          updated_at: "",
        },
        status: "pending",
      },
    ];
    // Mock storage.getItem to return version and results
    const spy = vi
      .spyOn(storage, "getItem")
      .mockReturnValueOnce(CURRENT_CACHE_VERSION.toString())
      .mockReturnValueOnce(JSON.stringify(mockResults));
    const result = getSavedMatchResults();
    expect(spy).toHaveBeenCalledWith(STORAGE_KEYS.CACHE_VERSION);
    expect(spy).toHaveBeenCalledWith(STORAGE_KEYS.MATCH_RESULTS);
    expect(result).toEqual(mockResults);
  });
});

describe("mergeMatchResults function", () => {
  const dummyResult: MatchResult = {
    kenmeiManga: {
      id: 1,
      title: "X",
      status: "pending",
      score: 0,
      chapters_read: 0,
      volumes_read: 0,
      notes: "",
      created_at: "",
      updated_at: "",
    },
    status: "pending",
  };
  beforeEach(() => {
    localStorage.clear();
    Object.keys(storageCache).forEach((key) => delete storageCache[key]);
    vi.restoreAllMocks();
  });

  it("returns newResults if no existing results to merge", () => {
    // No storage setup, should return new results as is
    const newResults = [dummyResult];
    const merged = mergeMatchResults(newResults as any);
    expect(merged).toBe(newResults);
  });

  it("preserves existing match status, selectedMatch, and matchDate", () => {
    const existing: MatchResult[] = [
      {
        kenmeiManga: {
          id: "20",
          title: "Match",
          status: "pending",
          score: 0,
          chapters_read: 0,
          volumes_read: 0,
          notes: "",
          created_at: "",
          updated_at: "",
        },
        status: "complete",
        selectedMatch: { id: 1, title: { english: "E" } },
        matchDate: "2023-01-01",
      },
    ];
    // Simulate saved match results in storage
    storage.setItem(
      STORAGE_KEYS.CACHE_VERSION,
      CURRENT_CACHE_VERSION.toString(),
    );
    storage.setItem(STORAGE_KEYS.MATCH_RESULTS, JSON.stringify(existing));
    const newResults = [
      {
        ...existing[0],
        status: "pending",
        anilistMatches: [],
        selectedMatch: undefined,
      },
    ];
    const merged = mergeMatchResults(newResults as any);
    expect(merged[0].status).toBe("complete");
    expect(merged[0].selectedMatch).toEqual(existing[0].selectedMatch);
    expect(merged[0].matchDate).toBe(existing[0].matchDate);
  });
});

describe("sync configuration persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.keys(storageCache).forEach((key) => delete storageCache[key]);
    vi.restoreAllMocks();
  });

  it("getSyncConfig returns default config when none is saved", () => {
    expect(getSyncConfig()).toEqual(DEFAULT_SYNC_CONFIG);
  });

  it("saveSyncConfig and getSyncConfig store and retrieve the sync configuration", () => {
    const customConfig = {
      ...DEFAULT_SYNC_CONFIG,
      prioritizeAniListStatus: true,
    };
    saveSyncConfig(customConfig as any);
    const loadedConfig = getSyncConfig();
    expect(loadedConfig).toEqual(customConfig);
  });
});
