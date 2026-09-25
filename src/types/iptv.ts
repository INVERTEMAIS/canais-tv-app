export type IptvItemType = 'channel' | 'movie' | 'series';

export interface IptvChannel {
  id: string;
  name: string;
  streamUrl: string; // URL .m3u8, .ts ou stream direto
  group: string; // Grupo/Categoria (ex: 'Abertos', 'Notícias', 'Esportes', 'Filmes & Séries', 'Infantil', 'Música', 'Documentários', 'Variedades', 'Internacionais')
  logoUrl?: string; // tvg-logo
  tvgId?: string;
  tvgName?: string;
  isFavorite?: boolean;
  createdAt: number;
  quality?: '4K' | 'FHD' | 'HD' | 'SD' | 'AUTO';
  httpReferrer?: string;
  userAgent?: string;
  playlistId?: string;
  playlistName?: string;
  type?: IptvItemType;
}

export interface IptvPlaylistItem {
  id: string;
  name: string;
  streamUrl: string;
  group: string;
  logoUrl?: string;
  tvgId?: string;
  tvgName?: string;
  quality?: '4K' | 'FHD' | 'HD' | 'SD' | 'AUTO';
  type: IptvItemType;
  playlistId: string;
  playlistName: string;
  createdAt?: number;
  isFavorite?: boolean;
}

export interface IptvPlaylistBundle {
  id: string;
  name: string;
  sourceUrl?: string;
  importedAt: number;
  channelCount: number;
  movieCount: number;
  seriesCount: number;
  totalCount: number;
  channels: IptvPlaylistItem[];
  movies: IptvPlaylistItem[];
  series: IptvPlaylistItem[];
  groups: string[];
}

export interface IptvPlaylist {
  id: string;
  name: string;
  sourceUrl?: string;
  channelCount: number;
  movieCount?: number;
  seriesCount?: number;
  importedAt: number;
  groups: string[];
}

export type IptvFilterTab = 'TODOS' | 'FAVORITOS' | string;

