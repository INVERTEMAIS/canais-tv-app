import { MovieItem, CatalogSettings } from '../types/movies';

export const MOVIES_CATALOG_STORAGE_KEY = 'netplay_movies_catalog_v3';
export const LAST_WATCHED_STORAGE_KEY = 'netplay_last_watched_v3';
export const MOVIE_VIEW_STATS_KEY = 'netplay_movie_view_stats_v1';
export const CATALOG_SETTINGS_KEY = 'netplay_catalog_settings_v1';

// Configurações padrão de catálogo e domínio base
export const DEFAULT_CATALOG_SETTINGS: CatalogSettings = {
  redecanaisDomain: 'https://redecanais.la',
  autoRenewOn403: true,
};

// Paleta estrita: Branco, Preto e Vermelho (#E50914)
export const NETFLIX_PALETTES = [
  { bg: 'from-black via-[#160404] to-black', accent: '#E50914', border: 'border-red-950/80' },
  { bg: 'from-[#140000] via-black to-[#0d0d0d]', accent: '#E50914', border: 'border-neutral-800' },
  { bg: 'from-black via-[#1c0606] to-[#0a0a0a]', accent: '#E50914', border: 'border-red-900/40' },
  { bg: 'from-[#111111] via-black to-[#180505]', accent: '#E50914', border: 'border-neutral-800' },
];

/**
 * Lê o timestamp estimado de expiração do link do vídeo se contiver parâmetro compatível
 * Retorna milissegundos unix ou null se não detectável.
 */
export function extractTokenExpiration(streamUrl: string): number | null {
  if (!streamUrl) return null;
  try {
    const url = new URL(streamUrl);
    // 1. Procura nu3zAQc9HC3GbwJq (formato TIMESTAMP-HASH)
    const nuVal = url.searchParams.get('nu3zAQc9HC3GbwJq');
    if (nuVal) {
      const parts = nuVal.split('-');
      const sec = parseInt(parts[0], 10);
      if (!isNaN(sec) && sec > 1000000000 && sec < 3000000000) {
        return sec * 1000;
      }
    }

    // 2. Parâmetros padrão expires / exp
    const exp = url.searchParams.get('expires') || url.searchParams.get('exp');
    if (exp) {
      const sec = parseInt(exp, 10);
      if (!isNaN(sec) && sec > 1000000000) {
        return sec > 1000000000000 ? sec : sec * 1000;
      }
    }
  } catch {
    const match = streamUrl.match(/nu3zAQc9HC3GbwJq=(\d{10})/);
    if (match && match[1]) {
      return parseInt(match[1], 10) * 1000;
    }
  }
  return null;
}

/**
 * Avalia o status do token de um filme
 */
export function evaluateTokenHealth(movie: MovieItem): {
  status: 'valid' | 'warning' | 'expired' | 'no-source';
  message: string;
  expiresInText?: string;
  expiresAt?: number;
} {
  if (!movie) {
    return {
      status: 'valid',
      message: 'Link Direto',
    };
  }

  const streamUrl = typeof movie.streamUrl === 'string' ? movie.streamUrl : '';
  const expiresAt = movie.tokenExpiresAt || extractTokenExpiration(streamUrl);

  if (!movie.sourcePageUrl && (!streamUrl || !streamUrl.includes('nu3zAQc9'))) {
    return {
      status: 'valid',
      message: 'Link Direto Estático',
    };
  }

  if (!expiresAt) {
    if (movie.sourcePageUrl) {
      return {
        status: 'valid',
        message: 'Auto-renovação Vinculada',
      };
    }
    return {
      status: 'no-source',
      message: 'Sem Link de Origem (Aviso)',
    };
  }

  const now = Date.now();
  const diffMs = expiresAt - now;

  if (diffMs <= 0) {
    return {
      status: 'expired',
      message: 'Token Expirado',
      expiresInText: 'Expirado',
      expiresAt,
    };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours < 3) {
    return {
      status: 'warning',
      message: `Expira em ${hours > 0 ? `${hours}h ` : ''}${minutes}m`,
      expiresInText: `${hours > 0 ? `${hours}h ` : ''}${minutes}m`,
      expiresAt,
    };
  }

  return {
    status: 'valid',
    message: `Válido por ${hours}h ${minutes}m`,
    expiresInText: `${hours}h`,
    expiresAt,
  };
}

/**
 * Carrega as configurações de catálogo e domínio
 */
export function loadCatalogSettings(): CatalogSettings {
  try {
    const raw = localStorage.getItem(CATALOG_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        redecanaisDomain: parsed.redecanaisDomain || DEFAULT_CATALOG_SETTINGS.redecanaisDomain,
        autoRenewOn403: parsed.autoRenewOn403 !== false,
        lastCheckedDomainStatus: parsed.lastCheckedDomainStatus,
      };
    }
  } catch {}
  return DEFAULT_CATALOG_SETTINGS;
}

/**
 * Salva as configurações de catálogo e domínio
 */
export function saveCatalogSettings(settings: CatalogSettings): void {
  try {
    localStorage.setItem(CATALOG_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * Normaliza uma URL de página de origem com o domínio ativo atual se for relativa ou contiver outro domínio antigo
 */
export function resolveSourceUrlWithDomain(sourceUrl: string, baseDomain: string): string {
  if (!sourceUrl) return '';
  const trimmed = sourceUrl.trim();
  const cleanBase = baseDomain.replace(/\/+$/, '');

  // Se já for relativa (ex: /filme-x)
  if (trimmed.startsWith('/')) {
    return `${cleanBase}${trimmed}`;
  }

  // Se for URL absoluta que pode ter um domínio do RedeCanais antigo
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('redecanais') || host.includes('rcfilmes')) {
      return `${cleanBase}${parsed.pathname}${parsed.search}`;
    }
    return trimmed;
  } catch {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `${cleanBase}/${trimmed.replace(/^\/+/, '')}`;
  }
}

/**
 * Substitui em massa o domínio antigo pelo novo domínio em todo o catálogo
 */
export function bulkUpdateMoviesDomain(
  movies: MovieItem[],
  oldDomain: string,
  newDomain: string
): { updatedMovies: MovieItem[]; count: number } {
  if (!oldDomain || !newDomain) return { updatedMovies: movies, count: 0 };
  const cleanOld = oldDomain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
  const cleanNew = newDomain.trim().replace(/\/+$/, '');

  let count = 0;
  const updatedMovies = movies.map((movie) => {
    let changed = false;
    let newSourcePage = movie.sourcePageUrl;

    if (newSourcePage && newSourcePage.toLowerCase().includes(cleanOld)) {
      newSourcePage = newSourcePage.replace(new RegExp(`https?://[^/]*${cleanOld}[^/]*`, 'gi'), cleanNew);
      changed = true;
    }

    if (changed) {
      count++;
      return {
        ...movie,
        sourcePageUrl: newSourcePage,
      };
    }
    return movie;
  });

  return { updatedMovies, count };
}

/**
 * Utilitário anti-expiração de tokens:
 * Se um link contiver token temporário com timestamp (ex: nu3zAQc9HC3GbwJq=1789858783-...),
 * detectamos e preparamos a URL para permitir renovação ou manter o vídeo tocando.
 */
export function prepareStreamUrl(rawUrl: string, freshToken?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // Se o usuário passou um novo token para reanimar o link
  if (freshToken && freshToken.trim()) {
    try {
      const parsed = new URL(url);
      const tokenKeys = ['nu3zAQc9HC3GbwJq', 'token', 'auth', 'expires', 'sig', 'hash'];
      let replaced = false;
      for (const key of tokenKeys) {
        if (parsed.searchParams.has(key)) {
          parsed.searchParams.set(key, freshToken.trim());
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        parsed.searchParams.set('token', freshToken.trim());
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  return url;
}

export const INITIAL_MOVIES_CATALOG: MovieItem[] = [
  {
    id: 'movie-redecanais-sample',
    title: 'Missão Resgate (Exemplo Auto-Renovação)',
    category: 'Ação',
    year: 2024,
    rating: '16',
    duration: '1h 58m',
    synopsis:
      'Um soldado de operações clandestinas embarca em uma perigosa missão através da Europa Oriental para resgatar civis após um atentado.',
    streamUrl:
      'https://xn--l---------------------------_________________________-2w85c.null-null.shop/tos-alisg-avt-0068/proxy?container=videos&refresh=31536000&url=https://neosoro.gq/V/RCFServer4/ondemand/MSOCGNHA.mp4?sv=24&cc=y&secure_uri=true&nu3zAQc9HC3GbwJq=1789858783-1aVawtjNUaVr1Fmgr5piXHcGJHExiHUZzfGFwHV9ypk%3D',
    sourcePageUrl: 'https://redecanais.la/missao-resgate-dublado',
    sourceProvider: 'redecanais',
    tokenParamKey: 'nu3zAQc9HC3GbwJq',
    tokenExpiresAt: 1789858783000,
    backdropColor: 'from-black via-[#1c0606] to-[#0a0a0a]',
    accentColor: '#E50914',
    createdAt: Date.now(),
  },
  {
    id: 'movie-big-buck-bunny',
    title: 'Big Buck Bunny (Full HD 4K)',
    category: 'Animação',
    year: 2023,
    rating: 'Livre',
    duration: '9m 56s',
    synopsis:
      'Em uma floresta encantada, um adorável coelho gigante é provocado por esquilos e criaturas travessas até decidir ensinar-lhes uma grande lição.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    backdropColor: 'from-black via-[#140000] to-[#0d0d0d]',
    accentColor: '#E50914',
    createdAt: Date.now() - 1000,
  },
  {
    id: 'movie-tears-of-steel',
    title: 'Tears of Steel (Guerra Tecnológica)',
    category: 'Ficção & Fantasia',
    year: 2022,
    rating: '14',
    duration: '12m 14s',
    synopsis:
      'Em um futuro distópico dominado por robôs e inteligência artificial, um grupo de cientistas e combatentes em Amsterdã constrói uma última esperança.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    backdropColor: 'from-[#111111] via-black to-[#180505]',
    accentColor: '#E50914',
    createdAt: Date.now() - 2000,
  },
  {
    id: 'movie-elephants-dream',
    title: 'Elephants Dream (Mundo das Máquinas)',
    category: 'Ficção & Fantasia',
    year: 2021,
    rating: '12',
    duration: '10m 54s',
    synopsis:
      'Dois viajantes exploram os segredos de uma máquina colossal que parece ter consciência própria e desafia as leis da física.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    backdropColor: 'from-black via-[#1c0606] to-[#0a0a0a]',
    accentColor: '#E50914',
    createdAt: Date.now() - 3000,
  },
  {
    id: 'movie-sintel',
    title: 'Sintel (A Busca do Dragão)',
    category: 'Animação',
    year: 2020,
    rating: '10',
    duration: '15m 20s',
    synopsis:
      'Uma jovem guerreira solitária viaja por montanhas nevadas e desertos implacáveis em busca de seu pequeno dragão de estimação que foi capturado.',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    backdropColor: 'from-black via-[#160404] to-black',
    accentColor: '#E50914',
    createdAt: Date.now() - 4000,
  },
];

export function loadMoviesCatalog(): MovieItem[] {
  try {
    const saved = localStorage.getItem(MOVIES_CATALOG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => ({
          ...item,
          tokenExpiresAt: item.tokenExpiresAt || extractTokenExpiration(item.streamUrl),
          backdropColor: item.backdropColor?.includes('emerald') || item.backdropColor?.includes('purple') || item.backdropColor?.includes('cyan') || item.backdropColor?.includes('blue') || item.backdropColor?.includes('amber')
            ? 'from-black via-[#160404] to-black'
            : item.backdropColor || 'from-black via-[#160404] to-black',
          accentColor: '#E50914',
        }));
      }
    }
  } catch (err) {
    console.error('Falha ao carregar filmes', err);
  }
  return INITIAL_MOVIES_CATALOG;
}

export function saveMoviesCatalog(movies: MovieItem[]): void {
  try {
    localStorage.setItem(MOVIES_CATALOG_STORAGE_KEY, JSON.stringify(movies));
  } catch (err) {
    console.error('Falha ao salvar filmes', err);
  }
}

export interface WatchProgressInfo {
  time: number;
  duration?: number;
}

export function getSavedWatchProgress(movieId: string): WatchProgressInfo {
  try {
    const saved = localStorage.getItem(`${LAST_WATCHED_STORAGE_KEY}_${movieId}`);
    if (!saved) return { time: 0, duration: 0 };
    if (saved.startsWith('{')) {
      const parsed = JSON.parse(saved);
      return { time: parsed.time || 0, duration: parsed.duration || 0 };
    }
    const val = parseFloat(saved);
    return { time: isNaN(val) ? 0 : val, duration: 0 };
  } catch {
    return { time: 0, duration: 0 };
  }
}

export function getSavedWatchTime(movieId: string): number {
  return getSavedWatchProgress(movieId).time;
}

export function saveWatchTime(movieId: string, seconds: number, duration?: number): void {
  try {
    const payload = JSON.stringify({
      time: Math.max(0, seconds),
      duration: duration || 0,
      updatedAt: Date.now(),
    });
    localStorage.setItem(`${LAST_WATCHED_STORAGE_KEY}_${movieId}`, payload);
  } catch {}
}

export interface MovieViewStats {
  playCount: number;
  totalSecondsWatched: number;
  lastPlayedAt: number;
}

export function recordMoviePlay(movieId: string): void {
  try {
    const allStatsRaw = localStorage.getItem(MOVIE_VIEW_STATS_KEY);
    const allStats: Record<string, MovieViewStats> = allStatsRaw ? JSON.parse(allStatsRaw) : {};
    const current = allStats[movieId] || { playCount: 0, totalSecondsWatched: 0, lastPlayedAt: 0 };

    allStats[movieId] = {
      ...current,
      playCount: (current.playCount || 0) + 1,
      lastPlayedAt: Date.now(),
    };

    localStorage.setItem(MOVIE_VIEW_STATS_KEY, JSON.stringify(allStats));
  } catch {}
}

export function getAllMovieStats(): Record<string, MovieViewStats> {
  try {
    const allStatsRaw = localStorage.getItem(MOVIE_VIEW_STATS_KEY);
    return allStatsRaw ? JSON.parse(allStatsRaw) : {};
  } catch {
    return {};
  }
}

export function determineHeroMovie(movies: MovieItem[]): MovieItem | null {
  if (!movies || movies.length === 0) return null;
  const stats = getAllMovieStats();

  let bestMovie: MovieItem = movies[0];
  let bestScore = -1;

  for (const movie of movies) {
    const stat = stats[movie.id];
    const progress = getSavedWatchProgress(movie.id);

    const playCount = stat?.playCount || 0;
    const watchSeconds = progress.time || 0;
    const lastPlayed = stat?.lastPlayedAt || 0;

    let score = playCount * 1000 + Math.floor(watchSeconds / 10);
    if (lastPlayed > 0) {
      const hoursAgo = (Date.now() - lastPlayed) / (1000 * 3600);
      if (hoursAgo < 48) {
        score += Math.max(0, Math.floor(500 - hoursAgo * 10));
      }
    }

    if (score > bestScore && score > 0) {
      bestScore = score;
      bestMovie = movie;
    }
  }

  return bestMovie;
}
