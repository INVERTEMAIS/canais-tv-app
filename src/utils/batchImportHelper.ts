import { MovieItem, MovieCategory } from '../types/movies';
import { NETFLIX_PALETTES, extractTokenExpiration } from './moviesCatalogStorage';

export interface ParsedBatchMovie {
  id: string;
  title: string;
  streamUrl: string;
  sourcePageUrl?: string;
  category: MovieCategory;
  year?: number;
  synopsis?: string;
  duration?: string;
  detectedDuration?: string;
  status: 'valid' | 'invalid' | 'loading';
  errorMessage?: string;
  tokenKey?: string;
  tokenExpiresAt?: number;
}

/**
 * Detecta se a URL possui token de autenticação temporário
 */
export function detectTokenFromUrl(url: string): string | undefined {
  if (!url) return undefined;

  // Detecção direta rápida de parâmetros conhecidos de IPTV / CDN
  if (url.includes('nu3zAQc9HC3GbwJq=')) {
    return 'nu3zAQc9HC3GbwJq';
  }

  const ignoreKeys = new Set(['url', 'container', 'refresh', 'sv', 'cc', 'secure_uri', 'id', 'v']);

  try {
    const parsed = new URL(url);

    // Se for proxy com parâmetro url=, inspeciona também a URL interna
    const innerUrlStr = parsed.searchParams.get('url');
    if (innerUrlStr && (innerUrlStr.startsWith('http://') || innerUrlStr.startsWith('https://'))) {
      try {
        const innerParsed = new URL(innerUrlStr);
        for (const [key, value] of innerParsed.searchParams.entries()) {
          const lower = key.toLowerCase();
          if (
            !ignoreKeys.has(lower) &&
            (lower.includes('token') ||
              lower.includes('sig') ||
              lower.includes('auth') ||
              lower.includes('hash') ||
              key.includes('nu3zAQc9') ||
              value.length > 25)
          ) {
            return key;
          }
        }
      } catch {}
    }

    for (const [key, value] of parsed.searchParams.entries()) {
      const lower = key.toLowerCase();
      if (
        !ignoreKeys.has(lower) &&
        (lower.includes('token') ||
          lower.includes('sig') ||
          lower.includes('auth') ||
          lower.includes('hash') ||
          key.includes('nu3zAQc9') ||
          value.length > 25)
      ) {
        return key;
      }
    }
  } catch {}

  return undefined;
}

/**
 * Normaliza o gênero para uma das categorias padrão do sistema
 */
export function normalizeCategory(cat: string): MovieCategory {
  if (!cat) return 'Ação';
  const clean = cat.trim().toLowerCase();

  if (clean.includes('ação') || clean.includes('acao') || clean.includes('action')) return 'Ação';
  if (clean.includes('ficção') || clean.includes('ficcao') || clean.includes('sci') || clean.includes('fantasia'))
    return 'Ficção & Fantasia';
  if (clean.includes('comédia') || clean.includes('comedia') || clean.includes('comedy')) return 'Comédia';
  if (clean.includes('drama') || clean.includes('romance')) return 'Drama';
  if (clean.includes('terror') || clean.includes('horror') || clean.includes('suspense') || clean.includes('thriller'))
    return 'Terror & Suspense';
  if (clean.includes('anima') || clean.includes('anime') || clean.includes('desenho')) return 'Animação';
  if (clean.includes('doc') || clean.includes('biografia') || clean.includes('história') || clean.includes('historia'))
    return 'Documentário';

  return 'Ação';
}

/**
 * Tenta obter a duração de um vídeo MP4 via elemento HTMLVideo em segundo plano
 */
export function probeVideoDuration(url: string, timeoutMs: number = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      resolve(null);
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    let timer: number | null = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    const cleanup = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      video.onloadedmetadata = null;
      video.onerror = null;
      video.src = '';
    };

    video.onloadedmetadata = () => {
      const dur = video.duration;
      cleanup();
      if (!dur || isNaN(dur) || dur <= 0) {
        resolve(null);
        return;
      }
      const m = Math.floor(dur / 60);
      const h = Math.floor(m / 60);
      const remM = m % 60;
      if (h > 0) {
        resolve(`${h}h ${remM < 10 ? '0' : ''}${remM}m`);
      } else {
        resolve(`${m}m`);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    try {
      video.src = url;
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

/**
 * Converte links de compartilhamento do Google Drive ou Dropbox para link direto de download/stream
 */
export function convertCloudShareUrlToDirectUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // 1. Google Drive (file/d/ID/view ou id=ID)
  if (trimmed.includes('drive.google.com')) {
    const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
  }

  // 2. Google Docs/Sheets (Exportar como CSV)
  if (trimmed.includes('docs.google.com/spreadsheets')) {
    const docIdMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (docIdMatch && docIdMatch[1]) {
      return `https://docs.google.com/spreadsheets/d/${docIdMatch[1]}/export?format=csv`;
    }
  }

  // 3. Dropbox (troca dl=0 por dl=1)
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace(/[?&]dl=0/, '?dl=1');
  }

  return trimmed;
}

/**
 * Tenta extrair um título amigável a partir do link ou nome do arquivo
 */
export function extractTitleFromUrl(url: string, fallbackIndex: number = 1): string {
  if (!url) return `Filme #${fallbackIndex}`;
  try {
    const parsed = new URL(url);
    let target = url;
    const inner = parsed.searchParams.get('url');
    if (inner && (inner.startsWith('http://') || inner.startsWith('https://'))) {
      target = inner;
    }

    const path = new URL(target).pathname;
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      let name = last.replace(/\.[a-zA-Z0-9]+$/, '');
      try {
        name = decodeURIComponent(name);
      } catch {}
      name = name.replace(/[_\-+.]+/g, ' ').trim();
      if (name.length >= 2) {
        return name;
      }
    }
  } catch {}

  return `Filme #${fallbackIndex}`;
}

/**
 * Tenta fazer parse de JSON
 */
function tryParseJson(text: string): any | null {
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Normaliza um objeto estruturado de filme (ex: do JSON)
 */
function parseStructuredObject(obj: any, index: number): ParsedBatchMovie {
  const normalizedMap = new Map<string, any>();
  for (const key of Object.keys(obj)) {
    normalizedMap.set(key.toLowerCase().replace(/[^a-z0-9]/g, ''), obj[key]);
  }

  const title =
    normalizedMap.get('nome') ||
    normalizedMap.get('nomedofilme') ||
    normalizedMap.get('title') ||
    normalizedMap.get('titulo') ||
    normalizedMap.get('name');

  const streamUrl =
    normalizedMap.get('link') ||
    normalizedMap.get('url') ||
    normalizedMap.get('linkmp4') ||
    normalizedMap.get('linkfilme') ||
    normalizedMap.get('streamurl') ||
    normalizedMap.get('video');

  const sourcePageUrl =
    normalizedMap.get('linkorigem') ||
    normalizedMap.get('urlorigem') ||
    normalizedMap.get('sourcepageurl') ||
    normalizedMap.get('sourceurl') ||
    normalizedMap.get('paginaorigem') ||
    normalizedMap.get('origem');

  const rawCat =
    normalizedMap.get('categoria') ||
    normalizedMap.get('category') ||
    normalizedMap.get('genero') ||
    normalizedMap.get('genre') ||
    'Ação';

  const rawYear =
    normalizedMap.get('ano') ||
    normalizedMap.get('year') ||
    normalizedMap.get('datalancamento') ||
    new Date().getFullYear();

  const synopsis =
    normalizedMap.get('sinopse') ||
    normalizedMap.get('synopsis') ||
    normalizedMap.get('descricao') ||
    normalizedMap.get('description') ||
    'Importado via lista NetPlay.';

  const duration =
    normalizedMap.get('duration') ||
    normalizedMap.get('duracao') ||
    normalizedMap.get('tempo') ||
    normalizedMap.get('time');

  const strUrl = typeof streamUrl === 'string' ? streamUrl.trim() : '';
  const strSourcePage = typeof sourcePageUrl === 'string' ? sourcePageUrl.trim() : undefined;
  const isValidUrl = strUrl.startsWith('http://') || strUrl.startsWith('https://');

  const finalTitle =
    typeof title === 'string' && title.trim()
      ? title.trim()
      : extractTitleFromUrl(strUrl, index + 1);

  const expiresAt = extractTokenExpiration(strUrl);

  return {
    id: `batch_json_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
    title: finalTitle,
    streamUrl: strUrl,
    sourcePageUrl: strSourcePage,
    category: normalizeCategory(String(rawCat)),
    year: typeof rawYear === 'number' ? rawYear : parseInt(String(rawYear), 10) || new Date().getFullYear(),
    synopsis: String(synopsis),
    duration: duration && String(duration).toLowerCase() !== 'auto' ? String(duration) : undefined,
    detectedDuration: undefined,
    status: isValidUrl ? 'valid' : 'invalid',
    errorMessage: !isValidUrl
      ? 'Link inválido (deve iniciar com http:// ou https://)'
      : !finalTitle
      ? 'Título ausente'
      : undefined,
    tokenKey: detectTokenFromUrl(strUrl),
    tokenExpiresAt: expiresAt || undefined,
  };
}

/**
 * Faz o parse de texto CSV/Planilha ou JSON
 * Suporta formatos:
 * - 7 colunas: Nome do Filme;Link MP4;Link_Origem;Categoria;Ano;Sinopse;Duracao
 * - 6 colunas: Nome do Filme;Link MP4;Categoria;Ano;Sinopse;Duracao
 * - Linhas com 1 ou 2 URLs HTTP
 */
export function parseSpreadsheetText(rawInput: string): ParsedBatchMovie[] {
  if (!rawInput) return [];
  const trimmed = rawInput.trim();

  // 1. Suporte Nativo a arquivos e listas no formato JSON
  const parsedJson = tryParseJson(trimmed);
  if (parsedJson) {
    let rawItems: any[] = [];
    if (Array.isArray(parsedJson)) {
      rawItems = parsedJson;
    } else if (typeof parsedJson === 'object' && parsedJson !== null) {
      for (const key of ['filmes', 'movies', 'lista', 'items', 'data', 'results', 'catalogo', 'videos', 'content']) {
        if (Array.isArray((parsedJson as any)[key])) {
          rawItems = (parsedJson as any)[key];
          break;
        }
      }
    }
    if (rawItems.length > 0) {
      return rawItems
        .filter((it) => typeof it === 'object' && it !== null)
        .map((it, idx) => parseStructuredObject(it, idx));
    }
  }

  // 2. Parse de CSV / Delimitadores
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const hasLinkUrl = (text: string) => /https?:\/\//i.test(text);

  let startIndex = 0;
  let is7ColumnsFormat = false;

  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    const keywords = ['nome', 'titulo', 'title', 'link', 'url', 'categoria', 'genero', 'ano', 'sinopse', 'duracao'];
    const matched = keywords.filter((k) => firstLine.includes(k)).length;
    if (matched >= 2 && !hasLinkUrl(firstLine)) {
      startIndex = 1;
      if (firstLine.includes('origem') || firstLine.includes('source')) {
        is7ColumnsFormat = true;
      }
    }
  }

  const results: ParsedBatchMovie[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const stripped = line.replace(/(https?:\/\/[^\s;'",|]+)/g, '');
    let delimiter = ';';
    const semicolonCount = (stripped.match(/;/g) || []).length;
    const commaCount = (stripped.match(/,/g) || []).length;
    const tabCount = (stripped.match(/\t/g) || []).length;
    const pipeCount = (stripped.match(/\|/g) || []).length;

    if (pipeCount > semicolonCount && pipeCount > commaCount && pipeCount > tabCount) {
      delimiter = '|';
    } else if (tabCount > semicolonCount && tabCount > commaCount) {
      delimiter = '\t';
    } else if (commaCount > semicolonCount) {
      delimiter = ',';
    } else {
      delimiter = ';';
    }

    let cols: string[] = [];
    if (line.includes(delimiter)) {
      cols = line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
    } else {
      cols = [line.trim()];
    }

    // Identifica todas as URLs presentes na linha
    const urlIndices: number[] = [];
    cols.forEach((col, idx) => {
      if (col.startsWith('http://') || col.startsWith('https://')) {
        urlIndices.push(idx);
      }
    });

    let streamUrl = '';
    let sourcePageUrl: string | undefined = undefined;
    let title = '';
    let rawCategory = 'Ação';
    let rawYear = `${new Date().getFullYear()}`;
    let synopsis = '';
    let rawDuration = '';

    // Se detectou o formato padrão de 7 colunas ou se cols[2] é uma URL
    if (is7ColumnsFormat || (cols.length >= 3 && (cols[2].startsWith('http') || cols[2].includes('redecanais') || cols[2].startsWith('/')))) {
      title = cols[0];
      streamUrl = cols[1];
      sourcePageUrl = cols[2];
      rawCategory = cols[3] || 'Ação';
      rawYear = cols[4] || `${new Date().getFullYear()}`;
      synopsis = cols[5] || '';
      rawDuration = cols[6] || '';
    } else if (urlIndices.length >= 2) {
      // Duas URLs: define streamUrl e sourcePageUrl
      const firstUrl = cols[urlIndices[0]];
      const secondUrl = cols[urlIndices[1]];

      if (firstUrl.includes('.mp4') || firstUrl.includes('proxy?') || firstUrl.includes('nu3zAQc9')) {
        streamUrl = firstUrl;
        sourcePageUrl = secondUrl;
      } else {
        streamUrl = secondUrl;
        sourcePageUrl = firstUrl;
      }

      title = cols[0] && !urlIndices.includes(0) ? cols[0] : extractTitleFromUrl(streamUrl, i + 1);
      const otherCols = cols.filter((_, idx) => !urlIndices.includes(idx) && idx !== 0);
      rawCategory = otherCols[0] || 'Ação';
      rawYear = otherCols[1] || `${new Date().getFullYear()}`;
      synopsis = otherCols[2] || '';
      rawDuration = otherCols[3] || '';
    } else if (urlIndices.length === 1) {
      const uIdx = urlIndices[0];
      streamUrl = cols[uIdx];
      if (uIdx > 0) {
        title = cols[0];
      } else if (cols.length > 1) {
        title = cols[1];
      } else {
        title = extractTitleFromUrl(streamUrl, i + 1);
      }

      const otherCols = cols.filter((_, idx) => idx !== uIdx && cols[idx] !== title);
      rawCategory = otherCols[0] || 'Ação';
      rawYear = otherCols[1] || `${new Date().getFullYear()}`;
      synopsis = otherCols[2] || '';
      rawDuration = otherCols[3] || '';
    } else {
      // Sem URL evidente
      title = cols[0] || `Filme #${i + 1}`;
      streamUrl = cols[1] || '';
    }

    const isValidUrl = streamUrl.startsWith('http://') || streamUrl.startsWith('https://');
    const finalTitle = title.trim() || extractTitleFromUrl(streamUrl, i + 1);
    const expiresAt = extractTokenExpiration(streamUrl);

    const movie: ParsedBatchMovie = {
      id: `batch_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      title: finalTitle,
      streamUrl: streamUrl.trim(),
      sourcePageUrl: sourcePageUrl && sourcePageUrl.trim() ? sourcePageUrl.trim() : undefined,
      category: normalizeCategory(rawCategory),
      year: parseInt(rawYear, 10) || new Date().getFullYear(),
      synopsis: synopsis || 'Importado via planilha NetPlay.',
      duration: rawDuration && rawDuration.toLowerCase() !== 'auto' ? rawDuration : undefined,
      detectedDuration: undefined,
      status: isValidUrl ? 'valid' : 'invalid',
      errorMessage: !isValidUrl
        ? 'Link inválido (deve iniciar com http:// ou https://)'
        : !finalTitle
        ? 'Título ausente'
        : undefined,
      tokenKey: detectTokenFromUrl(streamUrl),
      tokenExpiresAt: expiresAt || undefined,
    };

    results.push(movie);
  }

  return results;
}

/**
 * Converte ParsedBatchMovie em MovieItem pronto para o catálogo
 */
export function convertParsedToMovieItems(parsed: ParsedBatchMovie[]): MovieItem[] {
  return parsed
    .filter((m) => m.status === 'valid')
    .map((m, index) => {
      const palette = NETFLIX_PALETTES[index % NETFLIX_PALETTES.length];
      return {
        id: `movie_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        title: m.title,
        streamUrl: m.streamUrl,
        sourcePageUrl: m.sourcePageUrl,
        category: m.category,
        year: m.year || new Date().getFullYear(),
        duration: m.duration || m.detectedDuration || '1h 50m',
        synopsis: m.synopsis || 'Filme importado no catálogo.',
        tokenParamKey: m.tokenKey,
        tokenExpiresAt: m.tokenExpiresAt,
        backdropColor: palette.bg,
        accentColor: palette.accent,
        createdAt: Date.now() - index * 100,
      };
    });
}

/**
 * Converte a lista de filmes do catálogo para formato CSV exportável para Excel
 * Agora inclui a coluna Link_Origem para auto-renovação de tokens
 */
export function exportCatalogToCsv(movies: MovieItem[]): string {
  const header = 'Nome do Filme;Link MP4;Link_Origem;Categoria;Ano;Sinopse;Duracao';
  const rows = movies.map((m) => {
    const sanitize = (val?: string | number) => {
      if (val === undefined || val === null) return '';
      const str = String(val).replace(/;/g, ',').replace(/\r?\n/g, ' ');
      return `"${str}"`;
    };

    return [
      sanitize(m.title),
      sanitize(m.streamUrl),
      sanitize(m.sourcePageUrl || ''),
      sanitize(m.category),
      sanitize(m.year || new Date().getFullYear()),
      sanitize(m.synopsis || ''),
      sanitize(m.duration || 'auto'),
    ].join(';');
  });

  return [header, ...rows].join('\r\n');
}

/**
 * Dispara o download de um arquivo de texto no navegador
 */
export function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
