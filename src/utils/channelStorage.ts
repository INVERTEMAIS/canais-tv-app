export const DEFAULT_CHANNEL_IFRAME_TEMPLATE =
  '<iframe name="Player" src="//%72%65%64%65%63%61%6E%61%69%73%74%76%2E%61%66/player3/ch.php?canal={canal}" frameborder="0" height="400" scrolling="no" width="640" allow="encrypted-media" allowFullScreen></iframe>';

export const CHANNEL_TEMPLATE_STORAGE_KEY = 'canais_tv_channel_iframe_template_v1';

/**
 * Retorna o template de iframe padrão salvo para canais ou o default
 */
export function getStoredChannelTemplate(): string {
  try {
    const saved = localStorage.getItem(CHANNEL_TEMPLATE_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    console.error('Erro ao ler template de canal do localStorage', e);
  }
  return DEFAULT_CHANNEL_IFRAME_TEMPLATE;
}

/**
 * Salva o template de iframe padrão para os canais
 */
export function saveStoredChannelTemplate(template: string): void {
  try {
    let clean = template.trim();
    // Se o usuário colou um iframe com canal=XYZ em vez de {canal}, converte automaticamente
    if (!clean.includes('{canal}') && clean.includes('canal=')) {
      clean = clean.replace(/canal=([^&"'\s]+)/i, 'canal={canal}');
    }
    localStorage.setItem(CHANNEL_TEMPLATE_STORAGE_KEY, clean);
  } catch (e) {
    console.error('Erro ao salvar template de canal no localStorage', e);
  }
}

/**
 * Restaura o template de iframe para o padrão original
 */
export function resetChannelTemplate(): string {
  try {
    localStorage.removeItem(CHANNEL_TEMPLATE_STORAGE_KEY);
  } catch (e) {
    console.error('Erro ao restaurar template de canal', e);
  }
  return DEFAULT_CHANNEL_IFRAME_TEMPLATE;
}

/**
 * Extrai o código do parâmetro 'canal' a partir de um texto, url ou código iframe
 * Exemplo: canal=BD -> 'BD'
 * Exemplo: ch.php?canal=caze1 -> 'caze1'
 */
export function extractCanalFromInput(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Se já for apenas o código simples (ex: "BD", "caze1", "dazn1")
  if (!trimmed.includes('=') && !trimmed.includes('<') && !trimmed.includes('/')) {
    return trimmed;
  }

  // Tenta extrair canal=...
  const match = trimmed.match(/canal=([^&"'\s>]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  return trimmed;
}

/**
 * Constrói a URL direta de streaming (src) a partir do código do canal e do template configurado
 */
export function buildChannelStreamUrl(canalCode: string, template?: string): string {
  const tpl = (template || getStoredChannelTemplate()).trim();
  const cleanCanal = canalCode.trim();

  // Se o template tem {canal}, substitui
  let url = tpl;
  if (url.includes('{canal}')) {
    url = url.replace(/\{canal\}/g, cleanCanal);
  } else if (url.includes('canal=')) {
    url = url.replace(/canal=([^&"'\s>]+)/i, `canal=${cleanCanal}`);
  }

  // Extrai o src="..." se for um iframe
  const srcMatch = url.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    url = srcMatch[1];
  }

  if (url.startsWith('//')) {
    url = 'https:' + url;
  }

  return url;
}

/**
 * Constrói o código completo do iframe a partir do código do canal e template
 */
export function buildChannelIframeCode(canalCode: string, template?: string): string {
  const tpl = (template || getStoredChannelTemplate()).trim();
  const cleanCanal = canalCode.trim();

  if (tpl.includes('{canal}')) {
    return tpl.replace(/\{canal\}/g, cleanCanal);
  } else if (tpl.includes('canal=')) {
    return tpl.replace(/canal=([^&"'\s>]+)/i, `canal=${cleanCanal}`);
  }

  return `<iframe name="Player" src="${buildChannelStreamUrl(canalCode, tpl)}" frameborder="0" height="400" scrolling="no" width="640" allow="encrypted-media" allowFullScreen></iframe>`;
}
