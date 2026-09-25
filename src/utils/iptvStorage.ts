import { IptvChannel, IptvPlaylist, IptvPlaylistBundle, IptvPlaylistItem } from '../types/iptv';

export const IPTV_CHANNELS_STORAGE_KEY = 'netplay_iptv_channels_v1';
export const IPTV_PLAYLISTS_STORAGE_KEY = 'netplay_iptv_playlists_v1';
export const IPTV_PLAYLIST_BUNDLES_STORAGE_KEY = 'netplay_iptv_bundles_v1';
export const IPTV_RECENT_CHANNELS_KEY = 'netplay_iptv_recent_v1';

// In-memory cache for ultra-fast, zero-lag rendering
const playlistBundleCache = new Map<string, IptvPlaylistBundle>();
let isIndexedDbInitialized = false;

// Initialize IndexedDB asynchronously for large playlists
function getIndexedDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open('NetPlayIptvDB', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('playlist_bundles')) {
          db.createObjectStore('playlist_bundles', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

// Preload bundles from IndexedDB / LocalStorage into memory cache
async function initStorageCache() {
  if (isIndexedDbInitialized) return;
  isIndexedDbInitialized = true;

  // First try LocalStorage backup
  try {
    const raw = localStorage.getItem(IPTV_PLAYLIST_BUNDLES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((b: IptvPlaylistBundle) => {
          if (b && b.id) playlistBundleCache.set(b.id, b);
        });
      }
    }
  } catch {}

  // Then load from IndexedDB
  try {
    const db = await getIndexedDb();
    if (db) {
      const tx = db.transaction('playlist_bundles', 'readonly');
      const store = tx.objectStore('playlist_bundles');
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const bundles: IptvPlaylistBundle[] = getAllReq.result || [];
        bundles.forEach((b) => {
          if (b && b.id) playlistBundleCache.set(b.id, b);
        });
      };
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  initStorageCache();
}

// Canais padrão públicos de demonstração e streaming ao vivo estáveis
export const DEFAULT_IPTV_CHANNELS: IptvChannel[] = [
  {
    id: 'iptv_rec_news',
    name: 'Record News HD',
    group: 'Notícias',
    streamUrl: 'https://stream.recordnews.com/live/recordnews.m3u8',
    logoUrl: 'https://images.tcdn.com.br/img/img_prod/704179/180_record_news_logo_1_20210204153036.png',
    quality: 'FHD',
    isFavorite: true,
    createdAt: Date.now() - 100000,
  },
  {
    id: 'iptv_band_sp',
    name: 'Band SP Ao Vivo',
    group: 'Abertos',
    streamUrl: 'https://ev-hls-fra-01.streann.com/live/band/live/chunklist.m3u8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/b/b5/Rede_Bandeirantes_logo.png',
    quality: 'HD',
    isFavorite: true,
    createdAt: Date.now() - 95000,
  },
  {
    id: 'iptv_tv_brasil',
    name: 'TV Brasil HD',
    group: 'Abertos',
    streamUrl: 'https://ebc-tvbrasil-lh.akamaihd.net/i/tvbrasil_1@112705/master.m3u8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/TV_Brasil_logo_2023.svg/512px-TV_Brasil_logo_2023.svg.png',
    quality: 'FHD',
    isFavorite: false,
    createdAt: Date.now() - 90000,
  },
  {
    id: 'iptv_tv_cultura',
    name: 'TV Cultura',
    group: 'Abertos',
    streamUrl: 'https://stream.tvcultura.com.br/hls/live.m3u8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/thumb/9/90/TV_Cultura_logo.png/400px-TV_Cultura_logo.png',
    quality: 'HD',
    isFavorite: true,
    createdAt: Date.now() - 85000,
  },
  {
    id: 'iptv_sbt_live',
    name: 'SBT Oficial',
    group: 'Abertos',
    streamUrl: 'https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/SBT_logo_2014.svg/512px-SBT_logo_2014.svg.png',
    quality: 'HD',
    isFavorite: true,
    createdAt: Date.now() - 80000,
  },
  {
    id: 'iptv_redbull_tv',
    name: 'Red Bull TV Esportes Radicais',
    group: 'Esportes',
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master_928.m3u8',
    logoUrl: 'https://resources.redbull.com/logos/redbull-tv-logo.png',
    quality: 'FHD',
    isFavorite: true,
    createdAt: Date.now() - 75000,
  },
  {
    id: 'iptv_nasa_tv',
    name: 'NASA TV UHD / Space Live',
    group: 'Documentários',
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg',
    quality: '4K',
    isFavorite: false,
    createdAt: Date.now() - 70000,
  },
  {
    id: 'iptv_bloomberg',
    name: 'Bloomberg TV Finanças Global',
    group: 'Notícias',
    streamUrl: 'https://liveproduseast.akamaized.net/us/Channel-USTV-AWS-virginia-1/Source-4000-1000_live.m3u8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Bloomberg_Television_logo_2015.svg/500px-Bloomberg_Television_logo_2015.svg.png',
    quality: 'FHD',
    isFavorite: false,
    createdAt: Date.now() - 65000,
  },
  {
    id: 'iptv_euronews_pt',
    name: 'Euronews em Português',
    group: 'Notícias',
    streamUrl: 'https://euronews-pt-p-euronews-fast-1-pt.samsung.wurl.tv/playlist.m3u8',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Euronews_2016_logo.svg/512px-Euronews_2016_logo.svg.png',
    quality: 'HD',
    isFavorite: false,
    createdAt: Date.now() - 60000,
  },
  {
    id: 'iptv_mux_demo',
    name: 'Big Buck Bunny (HLS Test Stream)',
    group: 'Filmes & Séries',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    logoUrl: 'https://peach.blender.org/wp-content/uploads/bbb-splash.png',
    quality: 'FHD',
    isFavorite: false,
    createdAt: Date.now() - 50000,
  },
  {
    id: 'iptv_tears_of_steel',
    name: 'Tears of Steel Sci-Fi 4K (HLS)',
    group: 'Filmes & Séries',
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    logoUrl: 'https://mango.blender.org/wp-content/themes/mango/images/logo.png',
    quality: '4K',
    isFavorite: false,
    createdAt: Date.now() - 40000,
  },
  {
    id: 'iptv_sintel',
    name: 'Sintel Fantasia & Animação (HLS)',
    group: 'Infantil',
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    logoUrl: 'https://durian.blender.org/wp-content/themes/durian/images/sintel_header.jpg',
    quality: 'HD',
    isFavorite: false,
    createdAt: Date.now() - 30000,
  },
];

// Carrega os canais unitários cadastrados
export function loadIptvChannels(): IptvChannel[] {
  try {
    const raw = localStorage.getItem(IPTV_CHANNELS_STORAGE_KEY);
    if (!raw) {
      saveIptvChannels(DEFAULT_IPTV_CHANNELS);
      return DEFAULT_IPTV_CHANNELS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_IPTV_CHANNELS;
  } catch (err) {
    console.error('Falha ao ler canais IPTV do localStorage:', err);
    return DEFAULT_IPTV_CHANNELS;
  }
}

export function saveIptvChannels(channels: IptvChannel[]): void {
  try {
    localStorage.setItem(IPTV_CHANNELS_STORAGE_KEY, JSON.stringify(channels));
  } catch (err) {
    console.error('Falha ao salvar canais IPTV no localStorage:', err);
  }
}

export function addIptvChannel(channel: IptvChannel): IptvChannel[] {
  const current = loadIptvChannels();
  const updated = [channel, ...current];
  saveIptvChannels(updated);
  return updated;
}

export function batchAddIptvChannels(newChannels: IptvChannel[]): IptvChannel[] {
  const current = loadIptvChannels();
  const existingUrls = new Set(current.map((c) => c.streamUrl.trim()));
  const filtered = newChannels.filter((c) => !existingUrls.has(c.streamUrl.trim()));
  const updated = [...filtered, ...current];
  saveIptvChannels(updated);
  return updated;
}

export function updateIptvChannel(updatedChannel: IptvChannel): IptvChannel[] {
  const current = loadIptvChannels();
  const updated = current.map((c) => (c.id === updatedChannel.id ? updatedChannel : c));
  saveIptvChannels(updated);
  return updated;
}

export function deleteIptvChannel(channelId: string): IptvChannel[] {
  const current = loadIptvChannels();
  const targetChannel = current.find((c) => c.id === channelId);
  const updated = current.filter((c) => c.id !== channelId);
  saveIptvChannels(updated);

  // Remove também de qualquer pacote de playlist importada (.M3U)
  for (const [bundleId, bundle] of playlistBundleCache.entries()) {
    const origChanLen = bundle.channels.length;
    const origMovLen = bundle.movies.length;
    const origSerLen = bundle.series.length;

    const filteredChannels = bundle.channels.filter(
      (c) =>
        c.id !== channelId &&
        (!targetChannel || (c.streamUrl !== targetChannel.streamUrl && c.name !== targetChannel.name))
    );
    const filteredMovies = bundle.movies.filter(
      (m) =>
        m.id !== channelId &&
        (!targetChannel || (m.streamUrl !== targetChannel.streamUrl && m.name !== targetChannel.name))
    );
    const filteredSeries = bundle.series.filter(
      (s) =>
        s.id !== channelId &&
        (!targetChannel || (s.streamUrl !== targetChannel.streamUrl && s.name !== targetChannel.name))
    );

    if (
      filteredChannels.length !== origChanLen ||
      filteredMovies.length !== origMovLen ||
      filteredSeries.length !== origSerLen
    ) {
      const updatedBundle: IptvPlaylistBundle = {
        ...bundle,
        channels: filteredChannels,
        movies: filteredMovies,
        series: filteredSeries,
        channelCount: filteredChannels.length,
        movieCount: filteredMovies.length,
        seriesCount: filteredSeries.length,
        totalCount: filteredChannels.length + filteredMovies.length + filteredSeries.length,
      };
      savePlaylistBundle(updatedBundle);
    }
  }

  return updated;
}

export function deleteIptvChannelsBatch(channelIds: string[]): IptvChannel[] {
  const idSet = new Set(channelIds);
  const current = loadIptvChannels();
  const updated = current.filter((c) => !idSet.has(c.id));
  saveIptvChannels(updated);

  // Remove em lote também de pacotes de playlists
  for (const [bundleId, bundle] of playlistBundleCache.entries()) {
    const filteredChannels = bundle.channels.filter((c) => !idSet.has(c.id));
    const filteredMovies = bundle.movies.filter((m) => !idSet.has(m.id));
    const filteredSeries = bundle.series.filter((s) => !idSet.has(s.id));

    if (
      filteredChannels.length !== bundle.channels.length ||
      filteredMovies.length !== bundle.movies.length ||
      filteredSeries.length !== bundle.series.length
    ) {
      const updatedBundle: IptvPlaylistBundle = {
        ...bundle,
        channels: filteredChannels,
        movies: filteredMovies,
        series: filteredSeries,
        channelCount: filteredChannels.length,
        movieCount: filteredMovies.length,
        seriesCount: filteredSeries.length,
        totalCount: filteredChannels.length + filteredMovies.length + filteredSeries.length,
      };
      savePlaylistBundle(updatedBundle);
    }
  }

  return updated;
}

export function toggleFavoriteIptvChannel(channelId: string): IptvChannel[] {
  const current = loadIptvChannels();
  const updated = current.map((c) => (c.id === channelId ? { ...c, isFavorite: !c.isFavorite } : c));
  saveIptvChannels(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// GERENCIAMENTO DE PACOTES DE LISTAS M3U (Canais + Filmes + Séries)
// ---------------------------------------------------------------------------

export function loadIptvPlaylists(): IptvPlaylist[] {
  try {
    const raw = localStorage.getItem(IPTV_PLAYLISTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveIptvPlaylists(playlists: IptvPlaylist[]): void {
  try {
    localStorage.setItem(IPTV_PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists));
  } catch {}
}

export function loadAllPlaylistBundles(): IptvPlaylistBundle[] {
  return Array.from(playlistBundleCache.values());
}

export function getPlaylistBundle(id: string): IptvPlaylistBundle | undefined {
  return playlistBundleCache.get(id);
}

export async function savePlaylistBundle(bundle: IptvPlaylistBundle): Promise<void> {
  playlistBundleCache.set(bundle.id, bundle);

  // Salva resumo em localStorage
  const currentPlaylists = loadIptvPlaylists().filter((p) => p.id !== bundle.id);
  const newSummary: IptvPlaylist = {
    id: bundle.id,
    name: bundle.name,
    sourceUrl: bundle.sourceUrl,
    channelCount: bundle.channelCount,
    movieCount: bundle.movieCount,
    seriesCount: bundle.seriesCount,
    importedAt: bundle.importedAt,
    groups: bundle.groups,
  };
  saveIptvPlaylists([newSummary, ...currentPlaylists]);

  // Salva no IndexedDB
  try {
    const db = await getIndexedDb();
    if (db) {
      const tx = db.transaction('playlist_bundles', 'readwrite');
      const store = tx.objectStore('playlist_bundles');
      store.put(bundle);
    } else {
      // Fallback para localStorage limitado
      const allBundles = Array.from(playlistBundleCache.values());
      localStorage.setItem(IPTV_PLAYLIST_BUNDLES_STORAGE_KEY, JSON.stringify(allBundles.slice(0, 5)));
    }
  } catch (err) {
    console.error('Falha ao salvar bundle em IndexedDB:', err);
  }
}

export async function deleteIptvPlaylistBundle(playlistId: string): Promise<void> {
  // Find key in cache
  let targetKey = playlistId;
  for (const [key, bundle] of playlistBundleCache.entries()) {
    if (key === playlistId || bundle.id === playlistId || bundle.name === playlistId) {
      targetKey = key;
      break;
    }
  }
  playlistBundleCache.delete(targetKey);
  playlistBundleCache.delete(playlistId);

  // Remove dos resumos
  const currentPlaylists = loadIptvPlaylists().filter((p) => p.id !== playlistId && p.name !== playlistId && p.id !== targetKey);
  saveIptvPlaylists(currentPlaylists);

  // Remove do backup em localStorage
  try {
    const raw = localStorage.getItem(IPTV_PLAYLIST_BUNDLES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (b: any) => b && b.id !== playlistId && b.name !== playlistId && b.id !== targetKey
        );
        localStorage.setItem(IPTV_PLAYLIST_BUNDLES_STORAGE_KEY, JSON.stringify(filtered));
      }
    }
  } catch {}

  // Remove do IndexedDB
  try {
    const db = await getIndexedDb();
    if (db) {
      const tx = db.transaction('playlist_bundles', 'readwrite');
      const store = tx.objectStore('playlist_bundles');
      store.delete(playlistId);
      if (targetKey !== playlistId) {
        store.delete(targetKey);
      }
    }
  } catch {}
}

export function deleteIptvPlaylist(playlistIdentifier: string): IptvChannel[] {
  deleteIptvPlaylistBundle(playlistIdentifier);

  const current = loadIptvChannels();
  const updated = current.filter(
    (c) => c.playlistId !== playlistIdentifier && c.playlistName !== playlistIdentifier
  );
  saveIptvChannels(updated);
  return updated;
}

export function clearAllIptvChannels(): IptvChannel[] {
  saveIptvChannels([]);
  saveIptvPlaylists([]);
  playlistBundleCache.clear();
  try {
    localStorage.removeItem(IPTV_PLAYLIST_BUNDLES_STORAGE_KEY);
    getIndexedDb().then((db) => {
      if (db) {
        const tx = db.transaction('playlist_bundles', 'readwrite');
        tx.objectStore('playlist_bundles').clear();
      }
    });
  } catch {}
  return [];
}

/**
 * Busca ultra rápida em canais unitários E em todas as listas importadas (canais, filmes e séries)
 */
export function searchAcrossIptv(
  query: string,
  unitChannels: IptvChannel[],
  limit = 120
): Array<IptvPlaylistItem | IptvChannel> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: Array<IptvPlaylistItem | IptvChannel> = [];

  // 1. Busca nos canais unitários
  for (const ch of unitChannels) {
    if (
      ch.name.toLowerCase().includes(q) ||
      (ch.group && ch.group.toLowerCase().includes(q))
    ) {
      results.push(ch);
      if (results.length >= limit) return results;
    }
  }

  // 2. Busca dentro de cada lista importada (canais, filmes, séries)
  for (const bundle of playlistBundleCache.values()) {
    // Canais da lista
    for (const item of bundle.channels) {
      if (
        item.name.toLowerCase().includes(q) ||
        (item.group && item.group.toLowerCase().includes(q))
      ) {
        results.push(item);
        if (results.length >= limit) return results;
      }
    }

    // Filmes da lista
    for (const item of bundle.movies) {
      if (
        item.name.toLowerCase().includes(q) ||
        (item.group && item.group.toLowerCase().includes(q))
      ) {
        results.push(item);
        if (results.length >= limit) return results;
      }
    }

    // Séries da lista
    for (const item of bundle.series) {
      if (
        item.name.toLowerCase().includes(q) ||
        (item.group && item.group.toLowerCase().includes(q))
      ) {
        results.push(item);
        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}

