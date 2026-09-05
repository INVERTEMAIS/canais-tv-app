export interface Channel {
  id: string;
  name: string;
  canalCode?: string;
  number?: number;
  category?: string;
  iframeCode?: string;
  streamUrl: string;
  description?: string;
  logoUrl?: string;
  isFavorite?: boolean;
  createdAt: number;
}

export interface SavedMovie {
  id: string;
  title: string;
  server: string;
  vid: string;
  createdAt: number;
}

export type AppView = 'channels' | 'movies';

export type AlphabetFilter = 'TODOS' | string;

export type AdBlockMode = 'strict' | 'standard';

export interface RemoteKeyFeedback {
  key: string;
  timestamp: number;
}
