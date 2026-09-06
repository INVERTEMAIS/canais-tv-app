import { AdBlockMode } from '../types';

export const PLAYER_MODE_STORAGE_KEY = 'canaistv_player_mode';

/**
 * Retorna o modo de reprodução configurado.
 * Padrão: 'direct' (Direto/Compatível sem sandbox) para evitar que o RedeCanais
 * detecte restrições de iframe e exiba a tela 'Pagina Bloqueada! Os Espertinhos sempre se ferra!'.
 */
export function getStoredPlayerMode(): AdBlockMode {
  try {
    const saved = localStorage.getItem(PLAYER_MODE_STORAGE_KEY);
    if (saved === 'direct' || saved === 'standard' || saved === 'strict') {
      return saved;
    }
  } catch {
    // fallback se localStorage estiver indisponível
  }
  return 'direct';
}

export function savePlayerMode(mode: AdBlockMode): void {
  try {
    localStorage.setItem(PLAYER_MODE_STORAGE_KEY, mode);
  } catch {
    // ignorar
  }
}

/**
 * Retorna o valor do atributo sandbox para a tag <iframe>.
 * Se 'direct', retorna undefined (a tag <iframe> não terá o atributo sandbox),
 * que é o padrão oficial esperado pelo player do RedeCanais para não acionar o detector de anúncios.
 */
export function getSandboxAttribute(mode: AdBlockMode): string | undefined {
  if (mode === 'direct') {
    return undefined;
  }
  if (mode === 'standard') {
    return 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox allow-modals';
  }
  return 'allow-scripts allow-same-origin allow-forms allow-presentation';
}
