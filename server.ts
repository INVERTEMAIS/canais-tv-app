import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de Healthcheck para Render e Monitoramento
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

let genAIClient: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({});
  }
} catch (e) {
  console.warn('GoogleGenAI not initialized:', e);
}

// Estrutura de Sessões de Pareamento QR Code / Rede Local
interface PairingMovie {
  id?: string;
  title: string;
  streamUrl: string;
  sourcePageUrl?: string;
  category?: string;
  year?: number;
  synopsis?: string;
  duration?: string;
  rating?: string;
  addedAt: number;
}

interface PairingSession {
  token: string;
  code: string; // Ex: 492-184
  createdAt: number;
  expiresAt: number;
  pendingMovies: PairingMovie[];
}

const pairingSessions = new Map<string, PairingSession>();

// Limpeza automática de sessões antigas
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of pairingSessions.entries()) {
    if (session.expiresAt < now) {
      pairingSessions.delete(token);
    }
  }
}, 5 * 60 * 1000);

function getLocalIps(): string[] {
  const ips: string[] = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  } catch {}
  return ips;
}

// Headers comuns simulando navegador Google Chrome Desktop em português
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

/**
 * Função inteligente de extração de URL de vídeo MP4 e token dentro de HTML ou script
 */
function extractVideoUrlFromHtml(html: string, pageUrl: string): string | null {
  if (!html) return null;

  // 1. Procura por links de proxy com container=videos (padrão principal RedeCanais)
  // Ex: https://xn--l-...-2w85c.null-null.shop/tos-alisg-avt-0068/proxy?container=videos&refresh=...&url=https://...
  const proxyRegex = /https:\/\/[a-zA-Z0-9_\-.]+\.null-null\.shop\/[^\s"'<>]+proxy\?[^\s"'<>]+/gi;
  const proxyMatches = html.match(proxyRegex);
  if (proxyMatches && proxyMatches.length > 0) {
    // Retorna o primeiro link que contenha indicação de vídeo/mp4 ou token
    const best = proxyMatches.find((m) => m.includes('container=videos') || m.includes('.mp4') || m.includes('nu3zAQc9'));
    if (best) return best.replace(/&amp;/g, '&');
    return proxyMatches[0].replace(/&amp;/g, '&');
  }

  // 2. Procura links diretos .mp4 com parâmetros de segurança/token
  // Ex: https://neosoro.gq/.../MSOCGNHA.mp4?sv=24&nu3zAQc9HC3GbwJq=...
  const mp4WithTokenRegex = /https:\/\/[^\s"'<>]+\.mp4\?[^\s"'<>]+/gi;
  const mp4Matches = html.match(mp4WithTokenRegex);
  if (mp4Matches && mp4Matches.length > 0) {
    return mp4Matches[0].replace(/&amp;/g, '&');
  }

  // 3. Procura tags <video> ou <source> com src="..."
  const videoTagRegex = /<(?:video|source)[^>]+src=["']([^"']+\.mp4[^"']*)["']/i;
  const videoTagMatch = html.match(videoTagRegex);
  if (videoTagMatch && videoTagMatch[1]) {
    const rawSrc = videoTagMatch[1].replace(/&amp;/g, '&');
    try {
      return new URL(rawSrc, pageUrl).toString();
    } catch {
      return rawSrc;
    }
  }

  // 4. Procura links normais de .mp4 dentro de atributos href (botão baixar ou assistir)
  const hrefMp4Regex = /href=["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i;
  const hrefMatch = html.match(hrefMp4Regex);
  if (hrefMatch && hrefMatch[1]) {
    return hrefMatch[1].replace(/&amp;/g, '&');
  }

  // 5. Procura URLs escapadas em JSON ou Javascript ("url": "https:\/\/...")
  const escapedUrlRegex = /"(?:url|file|src|stream)":\s*"([^"]+)"/i;
  const escapedMatch = html.match(escapedUrlRegex);
  if (escapedMatch && escapedMatch[1]) {
    const unescaped = escapedMatch[1].replace(/\\\//g, '/').replace(/&amp;/g, '&');
    if (unescaped.startsWith('http') && (unescaped.includes('.mp4') || unescaped.includes('proxy?'))) {
      return unescaped;
    }
  }

  return null;
}

/**
 * Decodificador universal da página download.api do RedeCanais
 * A página do botão de download usa um algoritmo que armazena um array de strings Base64
 * com nomes dinâmicos (ex: gvR, uWX, etc.) de onde são extraídos dígitos numéricos,
 * subtraídos de um offset dinâmico para gerar caracteres ASCII, montando um HTML
 * que contém redirectUrl / window.open com o token fresco do stream.
 */
function decodeRedeCanaisDownloadApi(
  html: string,
  currentStreamUrl?: string
): {
  directMp4Url?: string;
  proxyUrl?: string;
  detectedToken?: string;
  expiresAt?: number;
  recommendedUrl?: string;
} | null {
  if (!html || !html.includes('String.fromCharCode') || !html.includes('forEach')) {
    return null;
  }

  // Regex universal compatível com qualquer nome de variável (gvR, uWX, etc.)
  const arrayMatch = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\s\S]*?)\];\s*\1\.forEach/);
  const offsetMatch = html.match(/-\s*(\d{7,10})\s*\)/);
  if (!arrayMatch || !offsetMatch) {
    return null;
  }

  const offset = parseInt(offsetMatch[1], 10);
  const rawItems = arrayMatch[2].match(/["']([^"']+)["']/g) || [];
  if (rawItems.length === 0) return null;

  let BEf = '';
  for (const item of rawItems) {
    const val = item.replace(/["']/g, '');
    try {
      const decoded = Buffer.from(val, 'base64').toString('binary');
      const numStr = decoded.replace(/\D/g, '');
      const charCode = parseInt(numStr, 10) - offset;
      BEf += String.fromCharCode(charCode);
    } catch {}
  }

  let decodedHtml = '';
  try {
    decodedHtml = decodeURIComponent(escape(BEf));
  } catch {
    decodedHtml = BEf;
  }

  // 1. Extrai link direto MP4
  let directMp4Url: string | undefined;
  const mp4Match = decodedHtml.match(/https?:\/\/[^\s"'<>]+\.mp4\?[^\s"'<>]+/i);
  if (mp4Match) {
    directMp4Url = mp4Match[0].replace(/&amp;/g, '&');
  }

  // 2. Extrai link do proxy null-null.shop (ou //...null-null.shop)
  let proxyUrl: string | undefined;
  const proxyMatch = decodedHtml.match(/(?:https?:)?\/\/([^\s"'<>]*null-null\.shop\/[^\s"'<>]+)/i);
  if (proxyMatch) {
    proxyUrl = 'https://' + proxyMatch[1].replace(/^\/+/, '').replace(/&amp;/g, '&');
  }

  // 3. Extrai token nu3zAQc9HC3GbwJq
  let detectedToken: string | undefined;
  let expiresAt: number | undefined;
  const tokenMatch = decodedHtml.match(/nu3zAQc9HC3GbwJq=([a-zA-Z0-9%\-_=]+)/);
  if (tokenMatch) {
    detectedToken = tokenMatch[1];
    const tsPart = detectedToken.split('-')[0];
    const tsNum = parseInt(tsPart, 10);
    if (!isNaN(tsNum) && tsNum > 1600000000) {
      expiresAt = tsNum * 1000;
    }
  }

  // 4. Se havia currentStreamUrl configurada com proxy anterior, renova preservando o host do usuário
  let updatedCurrentStream: string | undefined;
  if (proxyUrl && currentStreamUrl) {
    try {
      const currentHost = new URL(currentStreamUrl).host;
      if (currentHost.includes('null-null.shop')) {
        const proxyHost = new URL(proxyUrl).host;
        updatedCurrentStream = proxyUrl.replace(proxyHost, currentHost);
      }
    } catch {}
  }

  if (!updatedCurrentStream && directMp4Url && currentStreamUrl) {
    try {
      const urlObj = new URL(currentStreamUrl);
      if (detectedToken) {
        urlObj.searchParams.set('nu3zAQc9HC3GbwJq', detectedToken);
        updatedCurrentStream = urlObj.toString();
      }
    } catch {}
  }

  const recommendedUrl = directMp4Url || updatedCurrentStream || proxyUrl;

  return {
    directMp4Url,
    proxyUrl,
    detectedToken,
    expiresAt,
    recommendedUrl,
  };
}

/**
 * Utilitário de desembrulhar links de proxy do RedeCanais (null-null.shop ou similares)
 */
function unwrapVideoUrl(inputUrl: string): { unwrappedUrl: string; wasWrapped: boolean; clientIp?: string } {
  if (!inputUrl) return { unwrappedUrl: inputUrl, wasWrapped: false };
  let url = inputUrl.trim();
  if (url.startsWith('//')) url = `https:${url}`;

  // Se for proxy null-null.shop ou similar contendo parâmetro url=
  const urlParamIndex = url.indexOf('url=http');
  if (urlParamIndex !== -1) {
    const rawTarget = url.slice(urlParamIndex + 4);
    const ipMatch = url.match(/[?&]ip=([^&]+)/);
    const clientIp = ipMatch ? decodeURIComponent(ipMatch[1]) : undefined;
    return {
      unwrappedUrl: rawTarget,
      wasWrapped: true,
      clientIp,
    };
  }

  const ipMatch = url.match(/[?&]ip=([^&]+)/);
  const clientIp = ipMatch ? decodeURIComponent(ipMatch[1]) : undefined;

  return { unwrappedUrl: url, wasWrapped: false, clientIp };
}

// Validador do filtro de rede da macro Automa puxarlink_network_v2
// Intercepta qualquer URL que contenha hifens no host ou caminho e mp4 na query (como o proxy null-null.shop)
// ou streams diretos MP4 com parametros de autenticacao e token
function matchesAutomaMp4Pattern(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const clean = urlStr.trim().replace(/&amp;/g, '&');

  // 1. Padrao Estrito da Macro Automa com proxy e mp4
  // Ex: https://xn--l-...-2w85c.null-null.shop/tos-alisg-avt-0068/proxy?container=videos&refresh=31536000&url=https://...mp4...
  if (
    clean.includes('?') &&
    clean.toLowerCase().includes('mp4') &&
    (clean.includes('null-null.shop') ||
      clean.includes('tos-alisg') ||
      clean.includes('proxy?') ||
      clean.includes('container=videos') ||
      /[a-zA-Z0-9_\-]+-[a-zA-Z0-9_\-]+.*-[a-zA-Z0-9_\-]+/.test(clean))
  ) {
    return true;
  }

  // 2. Stream direto com query param de token (ex: /ondemand/MSOCGNHA.mp4?sv=24&nu3zAQc9...)
  if (/\.mp4\?[^\s"'<>]+/i.test(clean)) {
    return true;
  }

  // 3. Qualquer link que contenha o parâmetro de autorização específico do RedeCanais
  if (clean.includes('nu3zAQc9HC3GbwJq=')) {
    return true;
  }

  return false;
}

/**
 * Extrator de alvos baseado no seletor da macro Automa: "img, a:contains(\"Baixar\")"
 * Emula o clique no botão disparador de rede da macro, capturando:
 * - Links <a> cujo texto contenha "Baixar" (a:contains("Baixar")), "Download", "Assistir"
 * - Links <a> contendo tags <img> (imagens de botões de baixar/play)
 * - Tags <img> com onclick
 * - Endpoints download.api ou iframes de player
 */
function extractAutomaClickTargets(html: string, pageUrl: string): string[] {
  if (!html) return [];
  const targets = new Set<string>();

  // A. Links <a> contendo texto "Baixar" (a:contains("Baixar")) ou variações
  const aTextRegex = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>[\s\S]*?(?:baixar|download|assistir|download\.api)[\s\S]*?<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = aTextRegex.exec(html)) !== null) {
    const rawHref = match[1]?.trim();
    if (rawHref && !rawHref.startsWith('javascript:') && !rawHref.startsWith('#')) {
      try {
        targets.add(new URL(rawHref.replace(/&amp;/g, '&'), pageUrl).toString());
      } catch {}
    }
  }

  // B. Links <a> contendo tags <img> (img)
  const aImgRegex = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>[\s\S]*?<img[\s\S]*?<\/a>/gi;
  while ((match = aImgRegex.exec(html)) !== null) {
    const rawHref = match[1]?.trim();
    if (rawHref && !rawHref.startsWith('javascript:') && !rawHref.startsWith('#')) {
      try {
        targets.add(new URL(rawHref.replace(/&amp;/g, '&'), pageUrl).toString());
      } catch {}
    }
  }

  // C. Tags <img> com onclick direcionando para download / vídeo
  const imgOnclickRegex = /<img\s+[^>]*onclick=["'](?:window\.open|location\.href=)?['"]?([^'"\s;)]+)['"]?[^>]*>/gi;
  while ((match = imgOnclickRegex.exec(html)) !== null) {
    const rawUrl = match[1]?.trim();
    if (rawUrl && rawUrl.startsWith('http')) {
      try {
        targets.add(new URL(rawUrl.replace(/&amp;/g, '&'), pageUrl).toString());
      } catch {}
    }
  }

  // D. Qualquer link direto de download.api encontrado no HTML
  const dlLinkRegex = /["']([^"']*(?:player3\/)?download\.api\?download=[^"']+)["']/gi;
  while ((match = dlLinkRegex.exec(html)) !== null) {
    const rawUrl = match[1]?.trim();
    if (rawUrl) {
      try {
        targets.add(new URL(rawUrl.replace(/&amp;/g, '&'), pageUrl).toString());
      } catch {}
    }
  }

  // E. Iframes de player e server (ex: player3/server.php, video.php, etc.)
  const iframeRegex = /<iframe[^>]+src=["']([^"']*(?:player|embed|video|play|server|api|download)[^"']*)["']/gi;
  while ((match = iframeRegex.exec(html)) !== null) {
    const rawSrc = match[1]?.trim();
    if (rawSrc) {
      try {
        targets.add(new URL(rawSrc.replace(/&amp;/g, '&'), pageUrl).toString());
      } catch {}
    }
  }

  return Array.from(targets);
}

// Motor central de renovacao baseado na macro Automa puxarlink_network_v2
// Executa:
// 1. switch-tab: Acessa a pagina informada
// 2. web-request listener: Intercepta qualquer URL de proxy ou video contendo mp4
// 3. event-click: Dispara alvos correspondentes a img e botoes de Baixar
// 4. notification: Retorna o link fresco interceptado com o token novo
async function emulateAutomaMacroRenewal(
  sourcePageUrl: string,
  currentStreamUrl?: string
): Promise<{
  success: boolean;
  newStreamUrl?: string;
  directMp4Url?: string;
  proxyUrl?: string;
  detectedToken?: string;
  expiresAt?: number | null;
  methodUsed: string;
  finalPageUrl: string;
  error?: string;
}> {
  let resolvedUrl = sourcePageUrl.trim().replace(/#.*$/, '');
  if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
    resolvedUrl = `https://${resolvedUrl}`;
  }

  // 1. Se a URL fornecida for diretamente a API de download (download.api?download=...)
  if (resolvedUrl.includes('download.api')) {
    try {
      const apiRes = await fetch(resolvedUrl, {
        headers: { ...BROWSER_HEADERS, Referer: resolvedUrl },
        signal: AbortSignal.timeout(9000),
      });
      if (apiRes.ok) {
        const apiHtml = await apiRes.text();
        const decoded = decodeRedeCanaisDownloadApi(apiHtml, currentStreamUrl);
        if (decoded && (decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl)) {
          return {
            success: true,
            newStreamUrl: decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl,
            directMp4Url: decoded.directMp4Url,
            proxyUrl: decoded.proxyUrl,
            detectedToken: decoded.detectedToken,
            expiresAt: decoded.expiresAt || null,
            methodUsed: 'automa-direct-download-api',
            finalPageUrl: apiRes.url,
          };
        }
      }
    } catch (e: any) {
      console.warn('Falha no acesso direto à download.api:', e);
    }
  }

  // 2. switch-tab: Carrega a página do filme
  const pageRes = await fetch(resolvedUrl, {
    method: 'GET',
    headers: { ...BROWSER_HEADERS, Referer: resolvedUrl },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  });

  if (!pageRes.ok) {
    throw new Error(`Página de origem respondeu com status ${pageRes.status} (${pageRes.statusText})`);
  }

  const finalPageUrl = pageRes.url;
  const pageHtml = await pageRes.text();

  // 3. Verifica se a própria página já contém um link decodificado ou gerado correspondente a *://*/*-*-*/*?*mp4*
  const directAutomaMatches = pageHtml.match(/https?:\/\/[^\s"'<>]*(?:null-null|tos-alisg|proxy\?)[^\s"'<>]*\?[^\s"'<>]*mp4[^\s"'<>]*/gi);
  if (directAutomaMatches && directAutomaMatches.length > 0) {
    const freshUrl = directAutomaMatches[0].replace(/&amp;/g, '&');
    const { unwrappedUrl, wasWrapped } = unwrapVideoUrl(freshUrl);
    let detectedToken: string | undefined;
    let expiresAt: number | null = null;
    const tokenMatch = freshUrl.match(/nu3zAQc9HC3GbwJq=([a-zA-Z0-9%\-_=]+)/);
    if (tokenMatch) {
      detectedToken = tokenMatch[1];
      const ts = parseInt(detectedToken.split('-')[0], 10);
      if (!isNaN(ts) && ts > 1600000000) expiresAt = ts * 1000;
    }
    return {
      success: true,
      newStreamUrl: freshUrl,
      directMp4Url: wasWrapped ? unwrappedUrl : undefined,
      proxyUrl: freshUrl,
      detectedToken,
      expiresAt,
      methodUsed: 'automa-inline-network-match',
      finalPageUrl,
    };
  }

  // Se a página atual contém o código JavaScript do download.api (String.fromCharCode + forEach)
  if (pageHtml.includes('String.fromCharCode') && pageHtml.includes('forEach')) {
    const decoded = decodeRedeCanaisDownloadApi(pageHtml, currentStreamUrl);
    if (decoded && (decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl)) {
      return {
        success: true,
        newStreamUrl: decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl,
        directMp4Url: decoded.directMp4Url,
        proxyUrl: decoded.proxyUrl,
        detectedToken: decoded.detectedToken,
        expiresAt: decoded.expiresAt || null,
        methodUsed: 'automa-inline-download-api',
        finalPageUrl,
      };
    }
  }

  // 4. event-click no seletor: img, a:contains("Baixar")
  // Extrai todos os alvos engatilhados por cliques em botões de download e imagens
  const clickTargets = extractAutomaClickTargets(pageHtml, finalPageUrl);

  // Ordena os alvos: prioriza endpoints download.api e player3
  clickTargets.sort((a, b) => {
    const aIsDl = a.includes('download.api') ? 2 : a.includes('player3') ? 1 : 0;
    const bIsDl = b.includes('download.api') ? 2 : b.includes('player3') ? 1 : 0;
    return bIsDl - aIsDl;
  });

  // Itera sobre os alvos clicáveis (emulando as requisições geradas pelo clique)
  for (const targetUrl of clickTargets) {
    try {
      // Se for download.api
      if (targetUrl.includes('download.api')) {
        const dlRes = await fetch(targetUrl, {
          headers: { ...BROWSER_HEADERS, Referer: finalPageUrl },
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });
        if (dlRes.ok) {
          const dlHtml = await dlRes.text();
          const decoded = decodeRedeCanaisDownloadApi(dlHtml, currentStreamUrl);
          if (decoded && (decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl)) {
            return {
              success: true,
              newStreamUrl: decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl,
              directMp4Url: decoded.directMp4Url,
              proxyUrl: decoded.proxyUrl,
              detectedToken: decoded.detectedToken,
              expiresAt: decoded.expiresAt || null,
              methodUsed: 'automa-macro-click-download-api',
              finalPageUrl: dlRes.url,
            };
          }
        }
      }

      // Se for um redirect ou player
      const subRes = await fetch(targetUrl, {
        headers: { ...BROWSER_HEADERS, Referer: finalPageUrl },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });

      // web-request: se o redirecionamento final da requisição bater com o padrão *://*/*-*-*/*?*mp4*
      if (matchesAutomaMp4Pattern(subRes.url)) {
        const finalUrl = subRes.url;
        const { unwrappedUrl, wasWrapped } = unwrapVideoUrl(finalUrl);
        let detectedToken: string | undefined;
        let expiresAt: number | null = null;
        const tokenMatch = finalUrl.match(/nu3zAQc9HC3GbwJq=([a-zA-Z0-9%\-_=]+)/);
        if (tokenMatch) {
          detectedToken = tokenMatch[1];
          const ts = parseInt(detectedToken.split('-')[0], 10);
          if (!isNaN(ts) && ts > 1600000000) expiresAt = ts * 1000;
        }
        return {
          success: true,
          newStreamUrl: finalUrl,
          directMp4Url: wasWrapped ? unwrappedUrl : undefined,
          proxyUrl: finalUrl,
          detectedToken,
          expiresAt,
          methodUsed: 'automa-macro-webrequest-redirect',
          finalPageUrl: subRes.url,
        };
      }

      if (subRes.ok) {
        const subHtml = await subRes.text();

        // 1. Procura URLs que casam com a macro no corpo da resposta
        const subMatches = subHtml.match(/https?:\/\/[^\s"'<>]*(?:null-null|tos-alisg|proxy\?)[^\s"'<>]*\?[^\s"'<>]*mp4[^\s"'<>]*/gi);
        if (subMatches && subMatches.length > 0) {
          const freshUrl = subMatches[0].replace(/&amp;/g, '&');
          const { unwrappedUrl, wasWrapped } = unwrapVideoUrl(freshUrl);
          let detectedToken: string | undefined;
          let expiresAt: number | null = null;
          const tokenMatch = freshUrl.match(/nu3zAQc9HC3GbwJq=([a-zA-Z0-9%\-_=]+)/);
          if (tokenMatch) {
            detectedToken = tokenMatch[1];
            const ts = parseInt(detectedToken.split('-')[0], 10);
            if (!isNaN(ts) && ts > 1600000000) expiresAt = ts * 1000;
          }
          return {
            success: true,
            newStreamUrl: freshUrl,
            directMp4Url: wasWrapped ? unwrappedUrl : undefined,
            proxyUrl: freshUrl,
            detectedToken,
            expiresAt,
            methodUsed: 'automa-macro-webrequest-body',
            finalPageUrl: subRes.url,
          };
        }

        // 2. Se for uma página de download.api aninhada
        if (subHtml.includes('String.fromCharCode') && subHtml.includes('forEach')) {
          const decoded = decodeRedeCanaisDownloadApi(subHtml, currentStreamUrl);
          if (decoded && (decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl)) {
            return {
              success: true,
              newStreamUrl: decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl,
              directMp4Url: decoded.directMp4Url,
              proxyUrl: decoded.proxyUrl,
              detectedToken: decoded.detectedToken,
              expiresAt: decoded.expiresAt || null,
              methodUsed: 'automa-macro-nested-download-api',
              finalPageUrl: subRes.url,
            };
          }
        }

        // 3. Procura link interno para download.api
        const innerDlMatch = subHtml.match(/["']([^"']*(?:player3\/)?download\.api\?download=[^"']+)["']/i);
        if (innerDlMatch && innerDlMatch[1]) {
          try {
            const innerUrl = new URL(innerDlMatch[1].replace(/&amp;/g, '&'), subRes.url).toString();
            const innerRes = await fetch(innerUrl, {
              headers: { ...BROWSER_HEADERS, Referer: subRes.url },
              signal: AbortSignal.timeout(8000),
            });
            if (innerRes.ok) {
              const innerHtml = await innerRes.text();
              const decoded = decodeRedeCanaisDownloadApi(innerHtml, currentStreamUrl);
              if (decoded && (decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl)) {
                return {
                  success: true,
                  newStreamUrl: decoded.recommendedUrl || decoded.directMp4Url || decoded.proxyUrl,
                  directMp4Url: decoded.directMp4Url,
                  proxyUrl: decoded.proxyUrl,
                  detectedToken: decoded.detectedToken,
                  expiresAt: decoded.expiresAt || null,
                  methodUsed: 'automa-macro-inner-download-api',
                  finalPageUrl: innerRes.url,
                };
              }
            }
          } catch {}
        }
      }
    } catch (targetErr) {
      // Continua para o próximo alvo
    }
  }

  // 5. Fallback por regex geral de vídeo caso nenhum clique produza resultado
  const fallbackUrl = extractVideoUrlFromHtml(pageHtml, finalPageUrl);
  if (fallbackUrl) {
    return {
      success: true,
      newStreamUrl: fallbackUrl,
      methodUsed: 'automa-fallback-regex',
      finalPageUrl,
    };
  }

  // 6. Fallback final: se tínhamos currentStreamUrl, tenta extrair o parâmetro nu3zAQc9HC3GbwJq da página
  if (currentStreamUrl) {
    const tokenParamMatch = pageHtml.match(/nu3zAQc9HC3GbwJq=([a-zA-Z0-9%\-_=]+)/);
    if (tokenParamMatch && tokenParamMatch[1]) {
      try {
        const streamObj = new URL(currentStreamUrl);
        streamObj.searchParams.set('nu3zAQc9HC3GbwJq', tokenParamMatch[1]);
        return {
          success: true,
          newStreamUrl: streamObj.toString(),
          detectedToken: tokenParamMatch[1],
          methodUsed: 'automa-token-param-swap',
          finalPageUrl,
        };
      } catch {}
    }
  }

  return {
    success: false,
    methodUsed: 'automa-none',
    finalPageUrl,
    error: 'A macro não conseguiu interceptar nenhuma URL com o padrão *://*/*-*-*/*?*mp4* nos botões da página.',
  };
}

/**
 * Rota 1: Teste de conectividade e status de domínio
 */
app.post('/api/testar-dominio', async (req: Request, res: Response) => {
  const { domain } = req.body;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ success: false, error: 'Domínio não informado' });
  }

  let targetUrl = domain.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  const startTime = Date.now();
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });

    const latencyMs = Date.now() - startTime;
    return res.json({
      success: true,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url,
      latencyMs,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return res.json({
      success: false,
      ok: false,
      error: err.message || 'Falha ao conectar no domínio',
      latencyMs,
    });
  }
});

// Rota 2: Renovacao automatica de Token via Pagina de Origem
// Configurada com a macro Automa (puxarlink_network_v2)
// Dispara cliques nos botoes img e a:contains(Baixar) e intercepta links com mp4
app.post('/api/renovar-token', async (req: Request, res: Response) => {
  const { sourcePageUrl, baseDomain, currentStreamUrl } = req.body;

  if (!sourcePageUrl || typeof sourcePageUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'URL da página de origem não fornecida para este filme',
    });
  }

  let resolvedPageUrl = sourcePageUrl.trim().replace(/#.*$/, '');

  // Aplica domínio base caso seja relativo ou se baseDomain for especificado (exceto para links diretos de download.api)
  if (baseDomain && typeof baseDomain === 'string' && !resolvedPageUrl.includes('download.api')) {
    const cleanBase = baseDomain.replace(/\/+$/, '');
    if (resolvedPageUrl.startsWith('/')) {
      resolvedPageUrl = `${cleanBase}${resolvedPageUrl}`;
    } else {
      try {
        const parsed = new URL(resolvedPageUrl);
        if (parsed.hostname.includes('redecanais') || parsed.hostname.includes('rcfilmes')) {
          resolvedPageUrl = `${cleanBase}${parsed.pathname}${parsed.search}`;
        }
      } catch {}
    }
  }

  if (!resolvedPageUrl.startsWith('http://') && !resolvedPageUrl.startsWith('https://')) {
    resolvedPageUrl = `https://${resolvedPageUrl}`;
  }

  try {
    const renewalResult = await emulateAutomaMacroRenewal(resolvedPageUrl, currentStreamUrl);

    if (renewalResult.success && renewalResult.newStreamUrl) {
      return res.json({
        success: true,
        newStreamUrl: renewalResult.newStreamUrl,
        directMp4Url: renewalResult.directMp4Url,
        proxyUrl: renewalResult.proxyUrl,
        detectedToken: renewalResult.detectedToken,
        expiresAt: renewalResult.expiresAt,
        methodUsed: renewalResult.methodUsed,
        finalPageUrl: renewalResult.finalPageUrl,
        macroVersion: 'puxarlink_network_v2',
        macroPattern: '*://*/*-*-*/*?*mp4*',
        selector: 'img, a:contains("Baixar")',
        renewedAt: Date.now(),
      });
    }

    return res.status(404).json({
      success: false,
      error:
        renewalResult.error ||
        'Não foi possível interceptar o link de vídeo com o padrão *://*/*-*-*/*?*mp4* nos botões da página.',
      finalPageUrl: renewalResult.finalPageUrl,
    });
  } catch (err: any) {
    console.error('Erro na renovação de token com macro Automa:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro de comunicação ao raspar página de origem',
    });
  }
});

/**
 * Rota: Puxar metadados do filme/vídeo a partir de um link ou nome
 * Extrai título limpo, sinopse, ano, duração, categoria, pôster e vídeo
 */
app.post('/api/fetch-movie-metadata', async (req: Request, res: Response) => {
  try {
    const { url, query } = req.body;
    const inputUrl = (url || '').trim();
    const inputQuery = (query || '').trim();

    if (!inputUrl && !inputQuery) {
      return res.status(400).json({ success: false, error: 'Link ou título não informado.' });
    }

    let pageTitle = '';
    let pageDesc = '';
    let pageImage = '';
    let detectedStreamUrl = '';
    let isDirectVideo = false;

    // Se for URL direta de vídeo
    if (inputUrl) {
      if (
        inputUrl.includes('.mp4') ||
        inputUrl.includes('.m3u8') ||
        inputUrl.includes('proxy?container=videos') ||
        inputUrl.includes('/ondemand/')
      ) {
        detectedStreamUrl = inputUrl;
        isDirectVideo = true;
      }

      // Se for URL web, busca HTML para extrair OpenGraph e meta tags
      if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
        try {
          const fetchRes = await fetch(inputUrl, {
            headers: BROWSER_HEADERS,
            signal: AbortSignal.timeout(7000),
          });

          if (fetchRes.ok) {
            const html = await fetchRes.text();

            // Extrai title da página
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) pageTitle = titleMatch[1].trim();

            const ogTitleMatch =
              html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
            if (ogTitleMatch) pageTitle = ogTitleMatch[1].trim();

            // Extrai description da página
            const ogDescMatch =
              html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
              html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            if (ogDescMatch) pageDesc = ogDescMatch[1].trim();

            // Extrai imagem de pôster / capa
            const ogImgMatch =
              html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            if (ogImgMatch) pageImage = ogImgMatch[1].trim();

            // Se for página do RedeCanais download.api, decodifica diretamente
            if (inputUrl.includes('download.api')) {
              const decoded = decodeRedeCanaisDownloadApi(html);
              if (decoded && (decoded.recommendedUrl || decoded.directMp4Url)) {
                detectedStreamUrl = decoded.recommendedUrl || decoded.directMp4Url || '';
              }
            } else if (!detectedStreamUrl) {
              // Aplica a macro Automa puxarlink_network_v2 (*://*/*-*-*/*?*mp4* e img, a:contains("Baixar"))
              try {
                const automaRes = await emulateAutomaMacroRenewal(inputUrl);
                if (automaRes.success && automaRes.newStreamUrl) {
                  detectedStreamUrl = automaRes.newStreamUrl;
                }
              } catch {}

              if (!detectedStreamUrl) {
                const extracted = extractVideoUrlFromHtml(html, inputUrl);
                if (extracted) detectedStreamUrl = extracted;
              }
            }
          }
        } catch (fetchErr) {
          console.warn('Falha ao raspar URL (usando heurísticas locais):', fetchErr);
        }
      }
    }

    // Heurística de limpeza de nome de arquivo ou slug
    let fallbackTitle = pageTitle || inputQuery;
    if (!fallbackTitle && inputUrl) {
      try {
        const parsed = new URL(inputUrl);
        const segments = parsed.pathname.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1] || '';
        fallbackTitle = decodeURIComponent(lastSegment)
          .replace(/\.(mp4|m3u8|mkv|avi|mov)$/i, '')
          .replace(/[._\-+]/g, ' ')
          .replace(/\b(1080p|720p|4k|dual|audio|dublado|legendado|web-dl|bluray|x264|h264|hevc)\b/gi, '')
          .trim();
      } catch {}
    }

    // Limpa termos repetitivos de sites agregadores
    if (fallbackTitle) {
      fallbackTitle = fallbackTitle
        .replace(/assistir\s+/gi, '')
        .replace(/\s*-\s*redecanais.*/gi, '')
        .replace(/\s*\|\s*.*/gi, '')
        .replace(/\s*-\s*filme\s*completo.*/gi, '')
        .replace(/\s*dublado\s*(e\s*legendado)?/gi, '')
        .replace(/\s*legendado/gi, '')
        .replace(/\s*online/gi, '')
        .replace(/\s*hd/gi, '')
        .replace(/\s*4k/gi, '')
        .replace(/\s*grátis/gi, '')
        .trim();
    }

    // Extrai ano por regex
    const yearMatch = (pageTitle + ' ' + pageDesc + ' ' + inputUrl + ' ' + inputQuery).match(/\b(19\d{2}|20\d{2})\b/);
    const fallbackYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    // Extrai categoria por palavras-chave
    const textCorpus = (pageTitle + ' ' + pageDesc + ' ' + fallbackTitle).toLowerCase();
    let fallbackCategory = 'Ação';
    if (
      textCorpus.includes('animaç') ||
      textCorpus.includes('desenho') ||
      textCorpus.includes('disney') ||
      textCorpus.includes('pixar')
    ) {
      fallbackCategory = 'Animação';
    } else if (textCorpus.includes('coméd') || textCorpus.includes('engraçad')) {
      fallbackCategory = 'Comédia';
    } else if (
      textCorpus.includes('terror') ||
      textCorpus.includes('suspense') ||
      textCorpus.includes('horror') ||
      textCorpus.includes('medo')
    ) {
      fallbackCategory = 'Terror & Suspense';
    } else if (
      textCorpus.includes('ficç') ||
      textCorpus.includes('fantasia') ||
      textCorpus.includes('espac') ||
      textCorpus.includes('alien') ||
      textCorpus.includes('magia')
    ) {
      fallbackCategory = 'Ficção & Fantasia';
    } else if (
      textCorpus.includes('document') ||
      textCorpus.includes('vida') ||
      textCorpus.includes('natureza') ||
      textCorpus.includes('história real')
    ) {
      fallbackCategory = 'Documentário';
    } else if (textCorpus.includes('drama') || textCorpus.includes('romance') || textCorpus.includes('emocion')) {
      fallbackCategory = 'Drama';
    }

    let finalTitle = fallbackTitle || 'Filme Sem Título';
    let finalSynopsis = pageDesc || 'Filme adicionado ao catálogo NetPlay.';
    let finalCategory = fallbackCategory;
    let finalYear = fallbackYear;
    let finalDuration = '1h 50m';
    let finalRating = '14';

    // Se temos cliente Gemini disponível, faz enriquecimento inteligente com modelo moderno
    if (genAIClient) {
      try {
        const prompt = `Você é um catálogo cinematográfico inteligente. A partir das informações coletadas:
URL: "${inputUrl}"
Título identificado: "${fallbackTitle}"
Descrição da página: "${pageDesc}"

Retorne estritamente um objeto JSON com estes campos (sem formatação markdown extra):
{
  "title": "Nome oficial do filme em português (ex: Gladiador II)",
  "synopsis": "Sinopse bem escrita em português com 2 a 3 frases envolventes",
  "category": "Uma entre: Ação, Ficção & Fantasia, Comédia, Drama, Terror & Suspense, Animação, Documentário",
  "year": 2024,
  "duration": "ex: 2h 15m",
  "rating": "Livre, 10, 12, 14, 16 ou 18"
}`;

        const aiRes = await genAIClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        const responseText = aiRes.text || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.title) finalTitle = parsed.title;
          if (parsed.synopsis) finalSynopsis = parsed.synopsis;
          if (parsed.category) finalCategory = parsed.category;
          if (parsed.year) finalYear = parseInt(parsed.year, 10) || finalYear;
          if (parsed.duration) finalDuration = parsed.duration;
          if (parsed.rating) finalRating = parsed.rating;
        }
      } catch (aiErr) {
        console.warn('Enriquecimento Gemini não concluído, mantendo dados raspados:', aiErr);
      }
    }

    return res.json({
      success: true,
      metadata: {
        title: finalTitle,
        synopsis: finalSynopsis,
        category: finalCategory,
        year: finalYear,
        duration: finalDuration,
        rating: finalRating,
        posterUrl: pageImage || undefined,
        streamUrl: detectedStreamUrl || (isDirectVideo ? inputUrl : undefined),
        sourcePageUrl: !isDirectVideo && inputUrl.startsWith('http') ? inputUrl : undefined,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar metadados de filme:', error);
    return res.status(500).json({ success: false, error: error.message || 'Falha ao processar link' });
  }
});

/**
 * Rota: Proxy de Streaming de Vídeo MP4 com suporte a HTTP Range (206 Partial Content) e HEAD
 * Resolve restrições de CORS, referer bloqueado, proxies instáveis (null-null.shop) e mixed-content
 */
app.all('/api/stream-video', async (req: Request, res: Response) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Método não permitido');
  }

  // Extrai a URL com suporte a parâmetros brutos não-escapados
  const rawOriginalUrl = req.originalUrl || req.url;
  let videoUrl = (req.query.url as string) || '';
  const urlParamIndex = rawOriginalUrl.indexOf('url=');
  if (urlParamIndex !== -1) {
    const rawUrlPart = rawOriginalUrl.slice(urlParamIndex + 4);
    try {
      videoUrl = decodeURIComponent(rawUrlPart);
    } catch {
      videoUrl = rawUrlPart;
    }
  }

  if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
    return res.status(400).send('URL do vídeo ausente');
  }

  let cleanUrl = videoUrl.trim();
  if (cleanUrl.startsWith('//')) {
    cleanUrl = `https:${cleanUrl}`;
  }

  const { unwrappedUrl, wasWrapped, clientIp } = unwrapVideoUrl(cleanUrl);

  // Lista de URLs candidatas: se o link veio embrulhado em proxy (como null-null.shop),
  // testa tanto o link direto (.mp4) quanto o proxy embrulhado
  const candidates: string[] = [];
  if (wasWrapped && unwrappedUrl) {
    candidates.push(unwrappedUrl);
    if (cleanUrl !== unwrappedUrl) {
      candidates.push(cleanUrl);
    }
  } else {
    candidates.push(cleanUrl);
  }

  const rangeHeader = req.headers.range;
  let lastErrorStatus = 502;
  let lastErrorMessage = 'Falha ao conectar no servidor de vídeo upstream';

  for (const candidate of candidates) {
    try {
      const fetchHeaders: Record<string, string> = {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        Accept: '*/*',
      };

      if (clientIp) {
        fetchHeaders['X-Forwarded-For'] = clientIp;
        fetchHeaders['X-Real-IP'] = clientIp;
        fetchHeaders['Client-IP'] = clientIp;
      } else {
        const incomingIp =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.socket.remoteAddress;
        if (incomingIp) {
          fetchHeaders['X-Forwarded-For'] = incomingIp;
        }
      }

      if (
        candidate.includes('redecanais') ||
        candidate.includes('null-null.shop') ||
        candidate.includes('neosoro') ||
        candidate.includes('rcf')
      ) {
        fetchHeaders['Referer'] = 'https://redecanais.af/';
        fetchHeaders['Origin'] = 'https://redecanais.af';
      }

      if (rangeHeader) {
        fetchHeaders['Range'] = rangeHeader;
      }

      const upstreamRes = await fetch(candidate, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: fetchHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        lastErrorStatus = upstreamRes.status;
        lastErrorMessage = `Erro upstream: ${upstreamRes.statusText || upstreamRes.status}`;
        continue;
      }

      res.status(upstreamRes.status);
      const contentType = upstreamRes.headers.get('content-type') || 'video/mp4';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      res.setHeader('Accept-Ranges', 'bytes');

      const contentRange = upstreamRes.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      const contentLength = upstreamRes.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (req.method === 'HEAD' || !upstreamRes.body) {
        return res.end();
      }

      const reader = upstreamRes.body.getReader();
      let isClientClosed = false;

      req.on('close', () => {
        isClientClosed = true;
        reader.cancel().catch(() => {});
      });

      try {
        while (!isClientClosed) {
          const { done, value } = await reader.read();
          if (done || isClientClosed) break;
          const canWriteMore = res.write(value);
          if (!canWriteMore && !isClientClosed) {
            await new Promise((resolve) => res.once('drain', resolve));
          }
        }
      } catch (streamErr) {
        // Ignora erros de aborto quando o cliente encerra a conexão prematuramente
      }
      return res.end();
    } catch (err: any) {
      lastErrorMessage = err.message || 'Timeout ou erro de rede';
    }
  }

  if (!res.headersSent) {
    return res.status(lastErrorStatus).send(lastErrorMessage);
  }
  return res.end();
});

/**
 * Rota 3: Obter IPs locais para conexão de rede Wi-Fi / LAN
 */
app.get('/api/ip-local', (req: Request, res: Response) => {
  const ips = getLocalIps();
  return res.json({
    success: true,
    port: PORT,
    localIps: ips,
    primaryIp: ips[0] || 'localhost',
  });
});

/**
 * Rota 4: Criar ou renovar Sessão de Pareamento para adicionar filmes via Celular / QR Code
 */
app.post('/api/pareamento/criar', (req: Request, res: Response) => {
  const token = `tv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  // Código de 6 dígitos formatado (ex: 742-198)
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(100 + Math.random() * 900);
  const code = `${part1}-${part2}`;
  const now = Date.now();
  const expiresAt = now + 2 * 60 * 60 * 1000; // 2 horas

  const session: PairingSession = {
    token,
    code,
    createdAt: now,
    expiresAt,
    pendingMovies: [],
  };

  pairingSessions.set(token, session);
  pairingSessions.set(code, session); // Permite buscar por código simples também

  const ips = getLocalIps();
  return res.json({
    success: true,
    token,
    code,
    expiresAt,
    port: PORT,
    localIps: ips,
    primaryIp: ips[0] || 'localhost',
  });
});

/**
 * Rota 5: Verificar status da sessão e filmes pendentes (chamado pela TV)
 */
app.get('/api/pareamento/status/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const session = pairingSessions.get(token);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Sessão de pareamento não encontrada ou expirada',
    });
  }

  return res.json({
    success: true,
    token: session.token,
    code: session.code,
    pendingCount: session.pendingMovies.length,
    pendingMovies: session.pendingMovies,
  });
});

/**
 * Rota 6: Consumir e limpar filmes pendentes (quando a TV importa para o seu catálogo)
 */
app.post('/api/pareamento/consumir/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const session = pairingSessions.get(token);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Sessão não encontrada',
    });
  }

  const movies = [...session.pendingMovies];
  session.pendingMovies = []; // Limpa a fila após consumo

  return res.json({
    success: true,
    movies,
  });
});

/**
 * Rota 7: Adicionar filme na Smart TV (chamado pelo Celular / Navegador na rede local)
 */
app.post('/api/pareamento/adicionar', async (req: Request, res: Response) => {
  const { token, code, movie } = req.body;

  const sessionKey = token || code;
  if (!sessionKey) {
    return res.status(400).json({
      success: false,
      error: 'Token ou Código da TV é obrigatório',
    });
  }

  const session = pairingSessions.get(sessionKey);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Smart TV não encontrada com este token ou código. Gere um novo QR code na TV.',
    });
  }

  if (!movie || !movie.title || !movie.streamUrl) {
    return res.status(400).json({
      success: false,
      error: 'Título e Link do Vídeo (streamUrl) são obrigatórios',
    });
  }

  let finalStreamUrl = movie.streamUrl.trim();
  let detectedToken: string | undefined;
  let expiresAt: number | undefined;
  let sourcePageUrl = movie.sourcePageUrl ? movie.sourcePageUrl.trim().replace(/#.*$/, '') : undefined;

  // Se o usuário forneceu sourcePageUrl, executa a macro Automa para validar e capturar o link fresco
  if (sourcePageUrl) {
    try {
      const automaRes = await emulateAutomaMacroRenewal(sourcePageUrl, finalStreamUrl);
      if (automaRes.success && automaRes.newStreamUrl) {
        finalStreamUrl = automaRes.newStreamUrl;
        detectedToken = automaRes.detectedToken;
        expiresAt = automaRes.expiresAt || undefined;
      }
    } catch (e) {
      console.warn('Auto-teste no envio mobile via Automa macro falhou (mantendo link informado):', e);
    }
  }

  const newMovie: PairingMovie = {
    id: `movie-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: movie.title.trim(),
    streamUrl: finalStreamUrl,
    sourcePageUrl,
    category: movie.category || 'Ação',
    year: movie.year ? parseInt(movie.year, 10) : new Date().getFullYear(),
    synopsis: movie.synopsis || '',
    duration: movie.duration || '2h 00m',
    rating: movie.rating || '14',
    addedAt: Date.now(),
  };

  session.pendingMovies.push(newMovie);

  return res.json({
    success: true,
    message: `Filme "${newMovie.title}" enviado com sucesso para a Smart TV!`,
    movie: newMovie,
    detectedToken,
    expiresAt,
  });
});

// Inicialização de middleware e servidor Vite / Estático
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Modo Desenvolvimento: monta o Vite como middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Modo Produção: serve os assets compilados
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 NetPlay Cinema Server rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
