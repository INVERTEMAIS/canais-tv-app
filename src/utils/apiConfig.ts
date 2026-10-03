import { loadCatalogSettings } from './moviesCatalogStorage';

/**
 * Obtém a URL base da API do NetPlay dependendo se o ambiente é Web ou Android TV / Capacitor APK
 */
export function getApiBaseUrl(): string {
  // 1. Se o usuário definiu uma URL de backend personalizada nas configurações
  try {
    const settings = loadCatalogSettings();
    if (settings.backendServerUrl && settings.backendServerUrl.trim()) {
      return settings.backendServerUrl.trim().replace(/\/+$/, '');
    }
  } catch {}

  // 2. Variável de ambiente Vite se compilado
  const viteEnv = (import.meta as any).env?.VITE_API_BASE_URL;
  if (viteEnv) {
    return String(viteEnv).replace(/\/+$/, '');
  }

  // 3. Se estiver rodando dentro do Capacitor / Android APK (onde o origin é localhost ou capacitor://)
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      (window.location.hostname === 'localhost' && window.location.port !== '3000'))
  ) {
    // URL de fallback pública da instância backend
    return 'https://ais-dev-47xyhsubudtsuo5asmcidw-242902522090.us-west2.run.app';
  }

  // 4. No navegador Web normal rodando junto com o servidor Express (caminho relativo direto)
  return '';
}

/**
 * Constrói a URL completa para qualquer rota de API (/api/renovar-token, /api/fetch-movie-metadata, etc.)
 */
export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
}
