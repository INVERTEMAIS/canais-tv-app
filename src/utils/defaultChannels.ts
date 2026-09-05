import { Channel } from '../types';
import { parseIframeInput } from './iframeParser';
import { extractCanalFromInput, buildChannelStreamUrl, buildChannelIframeCode } from './channelStorage';

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'ch-canal-bd',
    name: 'Canal BD',
    canalCode: 'BD',
    iframeCode: buildChannelIframeCode('BD'),
    streamUrl: buildChannelStreamUrl('BD'),
    description: 'Canal Rede Canais - BD',
    isFavorite: true,
    createdAt: 1,
  },
  {
    id: 'ch-canal-bg',
    name: 'Canal BG',
    canalCode: 'BG',
    iframeCode: buildChannelIframeCode('BG'),
    streamUrl: buildChannelStreamUrl('BG'),
    description: 'Canal Rede Canais - BG',
    isFavorite: true,
    createdAt: 2,
  },
  {
    id: 'ch-caze-tv-1',
    name: 'Cazé TV 1',
    canalCode: 'caze1',
    iframeCode: buildChannelIframeCode('caze1'),
    streamUrl: buildChannelStreamUrl('caze1'),
    description: 'Transmissões esportivas Cazé TV 1',
    isFavorite: true,
    createdAt: 3,
  },
  {
    id: 'ch-caze-tv-2',
    name: 'Cazé TV 2',
    canalCode: 'caze2',
    iframeCode: buildChannelIframeCode('caze2'),
    streamUrl: buildChannelStreamUrl('caze2'),
    description: 'Transmissões esportivas Cazé TV 2',
    isFavorite: true,
    createdAt: 4,
  },
  {
    id: 'ch-caze-tv-3',
    name: 'Cazé TV 3',
    canalCode: 'caze3',
    iframeCode: buildChannelIframeCode('caze3'),
    streamUrl: buildChannelStreamUrl('caze3'),
    description: 'Transmissões esportivas Cazé TV 3',
    isFavorite: false,
    createdAt: 5,
  },
  {
    id: 'ch-dazn-1',
    name: 'DAZN 1',
    canalCode: 'dazn1',
    iframeCode: buildChannelIframeCode('dazn1'),
    streamUrl: buildChannelStreamUrl('dazn1'),
    description: 'Canal de Esportes e Lutas DAZN 1',
    isFavorite: false,
    createdAt: 6,
  },
  {
    id: 'ch-dazn-2',
    name: 'DAZN 2',
    canalCode: 'dazn2',
    iframeCode: buildChannelIframeCode('dazn2'),
    streamUrl: buildChannelStreamUrl('dazn2'),
    description: 'Canal de Esportes e Lutas DAZN 2',
    isFavorite: false,
    createdAt: 7,
  },
  {
    id: 'ch-redecanais-ver',
    name: 'Rede Canais - Ao Vivo',
    canalCode: 'ver',
    iframeCode: buildChannelIframeCode('ver'),
    streamUrl: buildChannelStreamUrl('ver'),
    description: 'Canal oficial Rede Canais Ao Vivo',
    isFavorite: true,
    createdAt: 8,
  },
];

export const STORAGE_KEY = 'canais_tv_user_registered_v3';
const LEGACY_STORAGE_KEY_V2 = 'canais_tv_user_registered_v2';
const LEGACY_STORAGE_KEY_V1 = 'canais_tv_play_list_v1';

/**
 * Ordena os canais em ordem alfabética (A-Z)
 */
export function sortChannelsAlphabetically(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true })
  );
}
const SIMULATED_CHANNEL_IDS = new Set([
  'ch-band-news',
  'ch-cnn-brasil',
  'ch-discovery-nature',
  'ch-espn-esportes',
  'ch-globo-news',
  'ch-lofi-chill',
  'ch-nasa-tv',
  'ch-sbt-aovivo',
  'ch-telecine-cult',
]);

function normalizeChannel(ch: Partial<Channel> & { id: string; name: string }): Channel {
  const extractedCode = ch.canalCode || extractCanalFromInput(ch.iframeCode || ch.streamUrl || '') || 'ver';
  const streamUrl = ch.streamUrl || buildChannelStreamUrl(extractedCode);
  const iframeCode = ch.iframeCode || buildChannelIframeCode(extractedCode);

  return {
    id: ch.id,
    name: ch.name,
    canalCode: extractedCode,
    streamUrl,
    iframeCode,
    logoUrl: ch.logoUrl,
    description: ch.description,
    isFavorite: !!ch.isFavorite,
    createdAt: ch.createdAt || Date.now(),
  };
}

export function loadChannelsFromStorage(): Channel[] {
  try {
    // 1. Tenta carregar da chave v3
    const savedV3 = localStorage.getItem(STORAGE_KEY);
    if (savedV3) {
      const parsed = JSON.parse(savedV3);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .filter((ch) => !SIMULATED_CHANNEL_IDS.has(ch.id))
          .map(normalizeChannel);
        if (cleaned.length > 0) {
          return sortChannelsAlphabetically(cleaned);
        }
      }
    }

    // 2. Tenta migrar de v2
    const savedV2 = localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (savedV2) {
      const parsed = JSON.parse(savedV2);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .filter((ch) => !SIMULATED_CHANNEL_IDS.has(ch.id))
          .map(normalizeChannel);
        if (cleaned.length > 0) {
          saveChannelsToStorage(cleaned);
          return sortChannelsAlphabetically(cleaned);
        }
      }
    }

    // 3. Tenta migrar de v1
    const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (legacySaved) {
      const legacyParsed = JSON.parse(legacySaved);
      if (Array.isArray(legacyParsed)) {
        const userCustom = legacyParsed
          .filter((ch) => !SIMULATED_CHANNEL_IDS.has(ch.id))
          .map(normalizeChannel);
        if (userCustom.length > 0) {
          saveChannelsToStorage(userCustom);
          return sortChannelsAlphabetically(userCustom);
        }
      }
    }
  } catch (e) {
    console.error('Failed to read channels from localStorage', e);
  }
  return sortChannelsAlphabetically(INITIAL_CHANNELS);
}

export function saveChannelsToStorage(channels: Channel[]): void {
  try {
    const cleaned = channels
      .filter((ch) => !SIMULATED_CHANNEL_IDS.has(ch.id))
      .map(normalizeChannel);
    const sorted = sortChannelsAlphabetically(cleaned);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch (e) {
    console.error('Failed to save channels to localStorage', e);
  }
}

