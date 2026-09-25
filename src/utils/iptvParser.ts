import { IptvChannel, IptvItemType } from '../types/iptv';

export interface ParseM3UResult {
  channels: IptvChannel[]; // Canais ao vivo
  movies: IptvChannel[];   // Filmes VOD
  series: IptvChannel[];   // Séries e episódios
  all: IptvChannel[];      // Todos os itens identificados
  groups: string[];
  totalParsed: number;
  errorsCount: number;
}

/**
 * Classifica um item da lista M3U entre canal de TV ao vivo, filme ou série
 */
export function classifyIptvItem(
  name: string,
  rawGroup: string,
  streamUrl: string
): IptvItemType {
  const combined = `${name} ${rawGroup}`.toLowerCase();
  const urlLower = streamUrl.toLowerCase();

  // Séries detection
  // Ex: "S01E02", "Temporada 1", "Serie", "Séries", "Series", "/series/"
  if (
    urlLower.includes('/series/') ||
    combined.includes('série') ||
    combined.includes('serie') ||
    combined.includes('series') ||
    combined.includes('séries') ||
    combined.includes('temporada') ||
    combined.includes('season') ||
    /s\d{1,2}\s?e\d{1,2}/i.test(combined) ||
    /ep\s?\d+/i.test(combined) ||
    /epis[oó]dio/i.test(combined)
  ) {
    return 'series';
  }

  // Filmes / Cinema / VOD detection
  // Ex: "Filmes", "Cinema", "VOD", "Movie", "Movies", "/movie/", ".mp4"
  if (
    urlLower.includes('/movie/') ||
    urlLower.endsWith('.mp4') ||
    urlLower.endsWith('.mkv') ||
    urlLower.endsWith('.avi') ||
    combined.includes('filme') ||
    combined.includes('filmes') ||
    combined.includes('movie') ||
    combined.includes('movies') ||
    combined.includes('vod') ||
    combined.includes('cinema') ||
    combined.includes('telecine') ||
    combined.includes('lançamento') ||
    combined.includes('lancamento')
  ) {
    return 'movie';
  }

  // Padrão: canal de TV ao vivo
  return 'channel';
}

/**
 * Detecta a qualidade do stream a partir do nome ou da URL
 */
function detectQuality(name: string, url: string): '4K' | 'FHD' | 'HD' | 'SD' | 'AUTO' {
  const combined = `${name} ${url}`.toUpperCase();
  if (combined.includes('4K') || combined.includes('UHD') || combined.includes('2160P')) {
    return '4K';
  }
  if (combined.includes('FHD') || combined.includes('1080P') || combined.includes('FULL HD')) {
    return 'FHD';
  }
  if (combined.includes('HD') || combined.includes('720P')) {
    return 'HD';
  }
  if (combined.includes('SD') || combined.includes('480P') || combined.includes('360P')) {
    return 'SD';
  }
  return 'AUTO';
}

/**
 * Normaliza o grupo do canal para manter coerência visual
 */
export function normalizeGroup(rawGroup?: string): string {
  if (!rawGroup || !rawGroup.trim()) return 'Variedades';
  const clean = rawGroup.trim();

  const lower = clean.toLowerCase();
  if (lower.includes('aberto') || lower.includes('naciona') || lower.includes('tv aberta')) return 'Abertos';
  if (lower.includes('notícia') || lower.includes('noticia') || lower.includes('news')) return 'Notícias';
  if (lower.includes('esporte') || lower.includes('sport') || lower.includes('futebol')) return 'Esportes';
  if (lower.includes('filme') || lower.includes('cinema') || lower.includes('movie') || lower.includes('série') || lower.includes('serie')) return 'Filmes & Séries';
  if (lower.includes('infantil') || lower.includes('desenho') || lower.includes('kids') || lower.includes('cartoon')) return 'Infantil';
  if (lower.includes('doc') || lower.includes('document')) return 'Documentários';
  if (lower.includes('música') || lower.includes('musica') || lower.includes('music') || lower.includes('clip')) return 'Música';
  if (lower.includes('religio') || lower.includes('gospel') || lower.includes('igreja')) return 'Religiosos';
  if (lower.includes('internacio') || lower.includes('inter') || lower.includes('world')) return 'Internacionais';
  if (lower.includes('variedade') || lower.includes('entretenimento')) return 'Variedades';

  return clean;
}

/**
 * Faz o parse completo de texto no padrão M3U / M3U8 ou XMLTV (EPG)
 */
export function parseM3UPlaylist(
  content: string,
  playlistId?: string,
  playlistName?: string
): ParseM3UResult {
  const allItems: IptvChannel[] = [];
  const groupSet = new Set<string>();
  let errorsCount = 0;

  if (!content || typeof content !== 'string') {
    return { channels: [], movies: [], series: [], all: [], groups: [], totalParsed: 0, errorsCount: 0 };
  }

  const trimmed = content.trim();

  // Detecção Inteligente de Arquivo XMLTV / EPG (como brazil1.xml)
  if (trimmed.startsWith('<?xml') || trimmed.includes('<tv') || trimmed.includes('<channel id=')) {
    return parseXmlTvChannels(trimmed, playlistId, playlistName);
  }

  const lines = content.split(/\r?\n/);
  let currentExtInf: string | null = null;
  let currentGroupFromExtGrp: string | null = null;
  let currentReferrer: string | null = null;
  let currentUserAgent: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Linha com metadados do canal (#EXTINF)
    if (rawLine.startsWith('#EXTINF:')) {
      currentExtInf = rawLine;
      continue;
    }

    // Diretiva de Grupo (#EXTGRP:Nome)
    if (rawLine.startsWith('#EXTGRP:')) {
      currentGroupFromExtGrp = rawLine.substring(8).trim();
      continue;
    }

    // Diretivas do VLC / IPTV Player
    if (rawLine.startsWith('#EXTVLCOPT:http-referrer=')) {
      currentReferrer = rawLine.replace('#EXTVLCOPT:http-referrer=', '').trim();
      continue;
    }
    if (rawLine.startsWith('#EXTVLCOPT:http-user-agent=')) {
      currentUserAgent = rawLine.replace('#EXTVLCOPT:http-user-agent=', '').trim();
      continue;
    }

    // Ignora outros comentários M3U
    if (rawLine.startsWith('#')) {
      continue;
    }

    // Chegamos na linha da URL (stream)
    const streamUrl = rawLine;
    if (streamUrl.startsWith('http://') || streamUrl.startsWith('https://') || streamUrl.startsWith('rtmp://')) {
      let channelName = '';
      let tvgLogo = '';
      let tvgId = '';
      let tvgName = '';
      let groupTitle = currentGroupFromExtGrp || '';

      if (currentExtInf) {
        // Extrai atributos com regex
        // tvg-name="..."
        const tvgNameMatch = currentExtInf.match(/tvg-name=["']([^"']+)["']/i);
        if (tvgNameMatch) tvgName = tvgNameMatch[1].trim();

        // tvg-logo="..."
        const tvgLogoMatch = currentExtInf.match(/tvg-logo=["']([^"']+)["']/i);
        if (tvgLogoMatch) tvgLogo = tvgLogoMatch[1].trim();

        // tvg-id="..."
        const tvgIdMatch = currentExtInf.match(/tvg-id=["']([^"']+)["']/i);
        if (tvgIdMatch) tvgId = tvgIdMatch[1].trim();

        // group-title="..."
        const groupMatch = currentExtInf.match(/group-title=["']([^"']+)["']/i);
        if (groupMatch) {
          groupTitle = groupMatch[1].trim();
        }

        // Nome do canal após a última vírgula da linha #EXTINF
        const commaIndex = currentExtInf.indexOf(',');
        if (commaIndex !== -1) {
          channelName = currentExtInf.substring(commaIndex + 1).trim();
        }
      }

      // Se não encontrou nome após a vírgula, usa tvg-name ou gera a partir da URL
      if (!channelName) {
        channelName = tvgName || getChannelNameFromUrl(streamUrl);
      }

      // Limpeza de caracteres excessivos
      channelName = channelName.replace(/\s+/g, ' ').trim();
      const finalGroup = normalizeGroup(groupTitle);
      groupSet.add(finalGroup);

      const channelId = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const itemType = classifyIptvItem(channelName, finalGroup, streamUrl);

      const parsedItem: IptvChannel = {
        id: channelId,
        name: channelName || 'Canal Desconhecido',
        streamUrl,
        group: finalGroup,
        logoUrl: tvgLogo || undefined,
        tvgId: tvgId || undefined,
        tvgName: tvgName || undefined,
        quality: detectQuality(channelName, streamUrl),
        httpReferrer: currentReferrer || undefined,
        userAgent: currentUserAgent || undefined,
        playlistId,
        playlistName: playlistName || (playlistId ? 'Lista M3U' : undefined),
        createdAt: Date.now(),
        isFavorite: false,
        type: itemType,
      };

      allItems.push(parsedItem);

      // Limpa os dados temporários para o próximo canal
      currentExtInf = null;
      currentGroupFromExtGrp = null;
      currentReferrer = null;
      currentUserAgent = null;
    } else {
      errorsCount++;
    }
  }

  // Se o usuário digitou uma única URL sem #EXTINF (Link Único puro)
  if (allItems.length === 0 && (content.startsWith('http://') || content.startsWith('https://'))) {
    const singleUrl = content.trim();
    const singleName = getChannelNameFromUrl(singleUrl);
    const itemType = classifyIptvItem(singleName, 'Geral', singleUrl);
    allItems.push({
      id: `ch_single_${Date.now()}`,
      name: singleName,
      streamUrl: singleUrl,
      group: 'Geral',
      quality: detectQuality(singleName, singleUrl),
      createdAt: Date.now(),
      isFavorite: false,
      type: itemType,
    });
    groupSet.add('Geral');
  }

  const liveChannels = allItems.filter((i) => i.type === 'channel' || !i.type);
  const movies = allItems.filter((i) => i.type === 'movie');
  const series = allItems.filter((i) => i.type === 'series');

  return {
    channels: liveChannels,
    movies,
    series,
    all: allItems,
    groups: Array.from(groupSet).sort(),
    totalParsed: allItems.length,
    errorsCount,
  };
}

/**
 * Faz o parse de listas e guias no formato XMLTV (EPG XML)
 * Suporta arquivos como brazil1.xml extraindo os canais cadastrados no guia
 */
export function parseXmlTvChannels(
  xmlContent: string,
  playlistId?: string,
  playlistName?: string
): ParseM3UResult {
  const allItems: IptvChannel[] = [];
  const groupSet = new Set<string>();
  let errorsCount = 0;

  try {
    // Regex eficiente para capturar blocos <channel id="..."> ... </channel> sem travar o browser
    const channelRegex = /<channel\s+id=["']([^"']+)["']>([\s\S]*?)<\/channel>/gi;
    let match: RegExpExecArray | null;

    while ((match = channelRegex.exec(xmlContent)) !== null) {
      const channelIdAttr = match[1].trim();
      const channelBody = match[2];

      // <display-name>Nome do Canal</display-name>
      const nameMatch = channelBody.match(/<display-name[^>]*>([^<]+)<\/display-name>/i);
      let channelName = nameMatch ? nameMatch[1].trim() : channelIdAttr;
      // Remove sufixo .br ou similar se presente
      channelName = channelName.replace(/\.br$/i, '').trim();

      // <icon src="..."/>
      const iconMatch = channelBody.match(/<icon\s+src=["']([^"']+)["']/i);
      const logoUrl = iconMatch ? iconMatch[1].trim() : undefined;

      // <url>...</url> se houver stream direto no xml
      const urlMatch = channelBody.match(/<url[^>]*>([^<]+)<\/url>/i);
      const streamUrl = urlMatch ? urlMatch[1].trim() : '';

      const group = 'Guia EPG Brasil';
      groupSet.add(group);

      const channelId = `epg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      allItems.push({
        id: channelId,
        name: channelName,
        streamUrl: streamUrl || `https://epg.netplay.internal/stream/${encodeURIComponent(channelIdAttr)}`,
        group,
        logoUrl,
        tvgId: channelIdAttr,
        tvgName: channelName,
        quality: channelName.toUpperCase().includes('HD') ? 'HD' : 'FHD',
        playlistId: playlistId || 'epg_brazil',
        playlistName: playlistName || 'Guia de Programação EPG',
        createdAt: Date.now(),
        isFavorite: false,
        type: 'channel',
      });
    }
  } catch (err) {
    console.warn('Erro ao processar XMLTV EPG:', err);
    errorsCount++;
  }

  return {
    channels: allItems,
    movies: [],
    series: [],
    all: allItems,
    groups: Array.from(groupSet),
    totalParsed: allItems.length,
    errorsCount,
  };
}

/**
 * Extrai um nome amigável caso a linha M3U não tenha nome
 */
function getChannelNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      const withoutExt = last.replace(/\.(m3u8|mp4|ts|flv)$/i, '');
      if (withoutExt && withoutExt.length > 2) {
        return decodeURIComponent(withoutExt).replace(/[-_]/g, ' ');
      }
    }
    return parsed.hostname;
  } catch {
    return 'Transmissão IPTV';
  }
}
