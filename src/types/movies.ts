export interface MovieItem {
  id: string;
  title: string;
  category: string;
  streamUrl: string; // URL direta de streaming MP4
  sourcePageUrl?: string; // URL fixa da página de origem do filme (usada para raspar novo token se expirar)
  sourceProvider?: string; // Identificador do provedor (ex: 'redecanais', 'custom')
  tokenParamKey?: string; // Chave do parâmetro de token se existir (ex: nu3zAQc9HC3GbwJq)
  duration?: string;
  year?: number;
  rating?: string;
  synopsis?: string;
  backdropColor?: string; // Paleta de gradiente sofisticada estilo Netflix
  accentColor?: string;
  createdAt: number;
  lastWatchedPosition?: number;
  tokenExpiresAt?: number; // Timestamp estimado de expiração se detectado
  lastTokenRenewedAt?: number;
}

export type MovieCategory =
  | 'TODOS'
  | 'Ação'
  | 'Comédia'
  | 'Drama'
  | 'Ficção & Fantasia'
  | 'Terror & Suspense'
  | 'Animação'
  | 'Documentário';

export interface CatalogSettings {
  redecanaisDomain: string; // Domínio global ativo (ex: 'https://redecanais.la')
  autoRenewOn403: boolean; // Se deve tentar renovação automática no erro 403
  lastCheckedDomainStatus?: {
    ok: boolean;
    status: number;
    checkedAt: number;
    url?: string;
  };
}
