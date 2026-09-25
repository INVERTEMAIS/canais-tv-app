import { MovieItem } from '../types/movies';
import { loadCatalogSettings, saveMoviesCatalog, extractTokenExpiration } from './moviesCatalogStorage';

export interface TokenRenewalResult {
  success: boolean;
  movieId: string;
  newStreamUrl?: string;
  error?: string;
  detectedToken?: string;
  expiresAt?: number | null;
  finalPageUrl?: string;
}

export interface DomainCheckResult {
  success: boolean;
  ok: boolean;
  status?: number;
  statusText?: string;
  finalUrl?: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Testa a conectividade com o domínio informado chamando a API backend
 */
export async function testDomainConnectivity(domain: string): Promise<DomainCheckResult> {
  try {
    const response = await fetch('/api/testar-dominio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });

    const data = await response.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      ok: false,
      error: err.message || 'Falha na requisição ao servidor NetPlay',
    };
  }
}

/**
 * Renova o token de um filme individual chamando a rota do backend
 */
export async function renewMovieToken(
  movie: MovieItem,
  customBaseDomain?: string
): Promise<TokenRenewalResult> {
  const settings = loadCatalogSettings();
  const baseDomain = customBaseDomain || settings.redecanaisDomain;

  if (!movie.sourcePageUrl) {
    return {
      success: false,
      movieId: movie.id,
      error: 'O filme não possui "Link de Origem" cadastrado para auto-renovação.',
    };
  }

  try {
    const response = await fetch('/api/renovar-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePageUrl: movie.sourcePageUrl,
        baseDomain,
        currentStreamUrl: movie.streamUrl,
      }),
    });

    const data = await response.json();

    if (data.success && data.newStreamUrl) {
      const expiresAt = data.expiresAt || extractTokenExpiration(data.newStreamUrl);
      return {
        success: true,
        movieId: movie.id,
        newStreamUrl: data.newStreamUrl,
        detectedToken: data.detectedToken,
        expiresAt,
        finalPageUrl: data.finalPageUrl,
      };
    }

    return {
      success: false,
      movieId: movie.id,
      error: data.error || 'Não foi possível extrair um link válido da página.',
    };
  } catch (err: any) {
    return {
      success: false,
      movieId: movie.id,
      error: err.message || 'Falha de comunicação com o servidor NetPlay',
    };
  }
}

/**
 * Renova em lote uma lista de filmes
 */
export async function renewMultipleMovies(
  movies: MovieItem[],
  baseDomain: string,
  onProgress?: (current: number, total: number, result: TokenRenewalResult) => void
): Promise<{ updatedMovies: MovieItem[]; successCount: number; failCount: number }> {
  const targetMovies = movies.filter((m) => !!m.sourcePageUrl);
  const total = targetMovies.length;
  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  const moviesMap = new Map<string, MovieItem>(movies.map((m) => [m.id, { ...m }]));

  for (const movie of targetMovies) {
    const result = await renewMovieToken(movie, baseDomain);
    completed++;

    if (result.success && result.newStreamUrl) {
      successCount++;
      const current = moviesMap.get(movie.id);
      if (current) {
        moviesMap.set(movie.id, {
          ...current,
          streamUrl: result.newStreamUrl,
          tokenExpiresAt: result.expiresAt || undefined,
          lastTokenRenewedAt: Date.now(),
        });
      }
    } else {
      failCount++;
    }

    if (onProgress) {
      onProgress(completed, total, result);
    }
  }

  const updatedMovies = Array.from(moviesMap.values());
  saveMoviesCatalog(updatedMovies);

  return { updatedMovies, successCount, failCount };
}
