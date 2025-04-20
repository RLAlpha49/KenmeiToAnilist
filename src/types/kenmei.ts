export interface KenmeiMangaItem {
  title: string;
  status: string;
  score?: number;
  chapters_read?: number;
  volumes_read?: number;
  url?: string;
  source?: string;
  notes?: string;
  last_read_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KenmeiData {
  version?: string;
  exported_at?: string;
  manga: KenmeiMangaItem[];
}
