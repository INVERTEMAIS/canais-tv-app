import { SavedMovie } from '../types';

export const DEFAULT_MOVIE_IFRAME_TEMPLATE =
  '<iframe name="Player" src="//%72%65%64%65%63%61%6E%61%69%73%2E%61%66/player3/server.php?server={server}&subfolder=ondemand&vid={vid}" frameborder="0" height="400" scrolling="no" width="640" allow="encrypted-media" allowFullScreen></iframe>';

export const MOVIE_TEMPLATE_STORAGE_KEY = 'canais_tv_movie_template_v1';
export const MOVIES_STORAGE_KEY = 'canais_tv_movies_list_v1';

export const INITIAL_SAVED_MOVIES: SavedMovie[] = [
  {
    id: 'movie-ex-1',
    title: 'Filme / Vídeo 1 (Exemplo)',
    server: 'RCServer27',
    vid: 'DY',
    createdAt: Date.now() - 10000,
  },
  {
    id: 'movie-ex-2',
    title: 'Filme / Vídeo 2 (Exemplo)',
    server: 'RCFServer3',
    vid: 'JCKRCHSRTN',
    createdAt: Date.now(),
  },
];

export function getStoredMovieTemplate(): string {
  try {
    const saved = localStorage.getItem(MOVIE_TEMPLATE_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved;
    }
  } catch (e) {
    console.error('Error loading movie template', e);
  }
  return DEFAULT_MOVIE_IFRAME_TEMPLATE;
}

export function saveStoredMovieTemplate(template: string): void {
  try {
    localStorage.setItem(MOVIE_TEMPLATE_STORAGE_KEY, template.trim());
  } catch (e) {
    console.error('Error saving movie template', e);
  }
}

export function loadSavedMovies(): SavedMovie[] {
  try {
    const saved = localStorage.getItem(MOVIES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading saved movies', e);
  }
  return INITIAL_SAVED_MOVIES;
}

export function saveMoviesList(movies: SavedMovie[]): void {
  try {
    localStorage.setItem(MOVIES_STORAGE_KEY, JSON.stringify(movies));
  } catch (e) {
    console.error('Error saving movies list', e);
  }
}

/**
 * Constrói a URL do stream a partir do template de iframe ou da URL base substituindo {server} e {vid}
 */
export function buildMovieStreamUrl(server: string, vid: string, template?: string): string {
  const tpl = template || getStoredMovieTemplate();
  const cleanServer = encodeURIComponent(server.trim());
  const cleanVid = encodeURIComponent(vid.trim());

  // Se o template for um iframe completo, extrai a propriedade src
  let srcString = tpl;
  const srcMatch = tpl.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    srcString = srcMatch[1];
  }

  let finalUrl = srcString
    .replace(/\{server\}/gi, cleanServer)
    .replace(/\{vid\}/gi, cleanVid);

  // Se não possuía as tags {server} e {vid}, mas tem os parâmetros na query string, substitui via regex
  if (!tpl.includes('{server}') && finalUrl.includes('server=')) {
    finalUrl = finalUrl.replace(/server=[^&"'\s]+/i, `server=${cleanServer}`);
  }
  if (!tpl.includes('{vid}') && finalUrl.includes('vid=')) {
    finalUrl = finalUrl.replace(/vid=[^&"'\s]+/i, `vid=${cleanVid}`);
  }

  // Se começar com //, adiciona https:
  if (finalUrl.startsWith('//')) {
    finalUrl = 'https:' + finalUrl;
  }

  return finalUrl;
}

/**
 * Tenta extrair server e vid caso o usuário cole um código de iframe completo
 */
export function parseServerAndVidFromText(input: string): { server: string; vid: string } | null {
  if (!input) return null;

  // Decodifica possíveis URLs codificadas (ex %72%65%64%65%63%61%6E%61%69%73)
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    // continua com original se falhar decodificação
  }

  const serverMatch = decoded.match(/server=([^&"'\s>]+)/i);
  const vidMatch = decoded.match(/vid=([^&"'\s>]+)/i);

  if (serverMatch && vidMatch) {
    return {
      server: serverMatch[1].trim(),
      vid: vidMatch[1].trim(),
    };
  }

  return null;
}
