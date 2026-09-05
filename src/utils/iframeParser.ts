/**
 * Utility functions to extract, normalize, and sanitize iframe embeds and stream URLs
 */

export interface ParsedIframeResult {
  streamUrl: string;
  cleanIframeCode: string;
  isValid: boolean;
  error?: string;
}

/**
 * Decodes URL encodings (e.g. %72%65%64%65%63%61%6E%61%69%73%74%76%2E%61%66 -> redecanaistv.af)
 */
export function safelyDecodeUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/**
 * Normalizes a URL ensuring https: protocol when starts with //
 */
export function normalizeStreamUrl(url: string): string {
  let cleaned = url.trim();
  // Remove wrapping quotes if any
  cleaned = cleaned.replace(/^['"]|['"]$/g, '');

  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://') && !cleaned.startsWith('about:')) {
    cleaned = 'https://' + cleaned;
  }

  return safelyDecodeUrl(cleaned);
}

/**
 * Parses raw input from user which could be:
 * 1. A full <iframe ... src="..." ...></iframe> string
 * 2. Just the URL (e.g. //redecanaistv.af/... or https://...)
 * 3. Encoded URL fragments
 */
export function parseIframeInput(input: string): ParsedIframeResult {
  if (!input || !input.trim()) {
    return {
      streamUrl: '',
      cleanIframeCode: '',
      isValid: false,
      error: 'Por favor, insira o código do iframe ou o link do canal.',
    };
  }

  const raw = input.trim();

  // Check if input has an iframe tag
  const srcRegex = /src\s*=\s*["']([^"']+)["']/i;
  const iframeMatch = raw.match(srcRegex);

  let extractedUrl = '';

  if (iframeMatch && iframeMatch[1]) {
    extractedUrl = iframeMatch[1];
  } else if (raw.toLowerCase().startsWith('<iframe')) {
    // Attempt relaxed regex if quotes were missing
    const relaxedSrc = /src\s*=\s*([^\s>]+)/i.exec(raw);
    if (relaxedSrc && relaxedSrc[1]) {
      extractedUrl = relaxedSrc[1].replace(/['"]/g, '');
    }
  } else {
    // The user directly pasted a URL
    extractedUrl = raw;
  }

  if (!extractedUrl) {
    return {
      streamUrl: '',
      cleanIframeCode: '',
      isValid: false,
      error: 'Não foi possível encontrar o atributo "src" no iframe fornecido.',
    };
  }

  const streamUrl = normalizeStreamUrl(extractedUrl);

  // Generate standardized, clean iframe HTML code optimized for TV player
  const cleanIframeCode = `<iframe name="Player" src="${streamUrl}" frameborder="0" height="100%" width="100%" scrolling="no" allow="encrypted-media; autoplay; fullscreen" allowFullScreen></iframe>`;

  return {
    streamUrl,
    cleanIframeCode,
    isValid: true,
  };
}
