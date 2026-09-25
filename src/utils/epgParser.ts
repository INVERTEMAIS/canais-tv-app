/**
 * Módulo de Processamento e Integração de EPG (XMLTV / Electronic Program Guide)
 * Suporta feeds XMLTV como https://raw.githubusercontent.com/globetvapp/epg/refs/heads/main/Brazil/brazil1.xml
 */

export interface EpgChannel {
  id: string;
  displayName: string;
  iconSrc?: string;
  url?: string;
}

export interface EpgProgram {
  channelId: string;
  start: Date;
  stop: Date;
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  episode?: string;
}

export interface EpgData {
  channels: Map<string, EpgChannel>;
  programmesByChannel: Map<string, EpgProgram[]>;
  lastUpdated: number;
}

// In-memory cache for loaded EPG feeds
const epgCache = new Map<string, EpgData>();

/**
 * Converte strings de data do padrão XMLTV (ex: "20260925143000 +0000" ou "20260925143000 -0300")
 */
export function parseXmlTvDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.trim();
  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10) - 1;
  const day = parseInt(clean.substring(6, 8), 10);
  const hour = parseInt(clean.substring(8, 10), 10);
  const minute = parseInt(clean.substring(10, 12), 10);
  const second = parseInt(clean.substring(12, 14) || '0', 10);

  // Timezone offset (ex: "+0000" ou "-0300")
  const tzMatch = clean.match(/([+-])(\d{2})(\d{2})$/);
  if (tzMatch) {
    const sign = tzMatch[1] === '+' ? 1 : -1;
    const tzHours = parseInt(tzMatch[2], 10);
    const tzMins = parseInt(tzMatch[3], 10);
    const totalOffsetMinutes = sign * (tzHours * 60 + tzMins);
    const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
    return new Date(utcDate.getTime() - totalOffsetMinutes * 60 * 1000);
  }

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Faz o parse de uma string XMLTV pura
 */
export function parseXmlTvString(xmlText: string): EpgData {
  const channels = new Map<string, EpgChannel>();
  const programmesByChannel = new Map<string, EpgProgram[]>();

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // 1. Extrair Canais
    const channelNodes = xmlDoc.getElementsByTagName('channel');
    for (let i = 0; i < channelNodes.length; i++) {
      const node = channelNodes[i];
      const id = node.getAttribute('id') || '';
      if (!id) continue;

      const dispNameNode = node.getElementsByTagName('display-name')[0];
      const displayName = dispNameNode?.textContent?.trim() || id;

      const iconNode = node.getElementsByTagName('icon')[0];
      const iconSrc = iconNode?.getAttribute('src') || undefined;

      const urlNode = node.getElementsByTagName('url')[0];
      const url = urlNode?.textContent?.trim() || undefined;

      channels.set(id, { id, displayName, iconSrc, url });
    }

    // 2. Extrair Programas
    const programmeNodes = xmlDoc.getElementsByTagName('programme');
    for (let i = 0; i < programmeNodes.length; i++) {
      const node = programmeNodes[i];
      const channelId = node.getAttribute('channel') || '';
      const startStr = node.getAttribute('start') || '';
      const stopStr = node.getAttribute('stop') || '';
      if (!channelId || !startStr) continue;

      const titleNode = node.getElementsByTagName('title')[0];
      const title = titleNode?.textContent?.trim() || 'Sem título';

      const descNode = node.getElementsByTagName('desc')[0];
      const description = descNode?.textContent?.trim() || undefined;

      const catNode = node.getElementsByTagName('category')[0];
      const category = catNode?.textContent?.trim() || undefined;

      const iconNode = node.getElementsByTagName('icon')[0];
      const icon = iconNode?.getAttribute('src') || undefined;

      const start = parseXmlTvDate(startStr);
      const stop = stopStr ? parseXmlTvDate(stopStr) : new Date(start.getTime() + 3600000);

      const prog: EpgProgram = {
        channelId,
        start,
        stop,
        title,
        description,
        category,
        icon,
      };

      if (!programmesByChannel.has(channelId)) {
        programmesByChannel.set(channelId, []);
      }
      programmesByChannel.get(channelId)!.push(prog);
    }
  }

  // Ordena programas cronologicamente
  for (const list of programmesByChannel.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return {
    channels,
    programmesByChannel,
    lastUpdated: Date.now(),
  };
}

/**
 * Carrega feed XMLTV de uma URL com fallback e cache em memória
 */
export async function fetchEpgFeed(url: string, forceRefresh = false): Promise<EpgData> {
  if (!forceRefresh && epgCache.has(url)) {
    const cached = epgCache.get(url)!;
    if (Date.now() - cached.lastUpdated < 3600000) {
      return cached;
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar feed EPG: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const epgData = parseXmlTvString(text);
  epgCache.set(url, epgData);
  return epgData;
}

/**
 * Encontra o programa atualmente no ar para um canal (busca por ID ou similaridade de nome)
 */
export function getCurrentProgramForChannel(
  epg: EpgData,
  channelNameOrId: string,
  now = new Date()
): EpgProgram | null {
  const normSearch = channelNameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Procura direta por ID
  let targetChannelId = channelNameOrId;
  if (!epg.programmesByChannel.has(targetChannelId)) {
    // 2. Busca por similaridade de nome nos canais do EPG
    for (const [id, ch] of epg.channels.entries()) {
      const normName = ch.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normId = id.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        normName === normSearch ||
        normId === normSearch ||
        normName.includes(normSearch) ||
        normSearch.includes(normName)
      ) {
        targetChannelId = id;
        break;
      }
    }
  }

  const programs = epg.programmesByChannel.get(targetChannelId);
  if (!programs || programs.length === 0) return null;

  const current = programs.find((p) => p.start <= now && now < p.stop);
  return current || programs[0];
}

/**
 * Obtém os próximos programas para o guia
 */
export function getUpcomingProgramsForChannel(
  epg: EpgData,
  channelNameOrId: string,
  limit = 5,
  now = new Date()
): EpgProgram[] {
  const normSearch = channelNameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');
  let targetChannelId = channelNameOrId;

  if (!epg.programmesByChannel.has(targetChannelId)) {
    for (const [id, ch] of epg.channels.entries()) {
      const normName = ch.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normId = id.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        normName === normSearch ||
        normId === normSearch ||
        normName.includes(normSearch) ||
        normSearch.includes(normName)
      ) {
        targetChannelId = id;
        break;
      }
    }
  }

  const programs = epg.programmesByChannel.get(targetChannelId);
  if (!programs) return [];

  return programs.filter((p) => p.stop > now).slice(0, limit);
}
