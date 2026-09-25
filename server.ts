import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

/**
 * Rota 2: Renovação automática de Token via Página de Origem
 */
app.post('/api/renovar-token', async (req: Request, res: Response) => {
  const { sourcePageUrl, baseDomain, currentStreamUrl } = req.body;

  if (!sourcePageUrl || typeof sourcePageUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'URL da página de origem não fornecida para este filme',
    });
  }

  let resolvedPageUrl = sourcePageUrl.trim();

  // Aplica domínio base caso seja relativo ou se baseDomain for especificado
  if (baseDomain && typeof baseDomain === 'string') {
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
    // 1. Faz a requisição na página de origem do filme
    const pageResponse = await fetch(resolvedPageUrl, {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        Referer: resolvedPageUrl,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!pageResponse.ok) {
      return res.status(pageResponse.status).json({
        success: false,
        error: `A página de origem respondeu com status ${pageResponse.status} (${pageResponse.statusText})`,
        finalUrl: pageResponse.url,
      });
    }

    const html = await pageResponse.text();
    const finalPageUrl = pageResponse.url;

    // 2. Extrai link direto do MP4
    let newStreamUrl = extractVideoUrlFromHtml(html, finalPageUrl);

    // 3. Se não achou na página principal, verifica se há iframe de player (ex: player.php, embed, api)
    if (!newStreamUrl) {
      const iframeRegex = /<iframe[^>]+src=["']([^"']*(?:player|embed|video|play|api)[^"']*)["']/i;
      const iframeMatch = html.match(iframeRegex);

      if (iframeMatch && iframeMatch[1]) {
        let iframeSrc = iframeMatch[1].replace(/&amp;/g, '&');
        try {
          iframeSrc = new URL(iframeSrc, finalPageUrl).toString();
        } catch {}

        try {
          const iframeRes = await fetch(iframeSrc, {
            headers: {
              ...BROWSER_HEADERS,
              Referer: finalPageUrl,
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
          });

          if (iframeRes.ok) {
            const iframeHtml = await iframeRes.text();
            newStreamUrl = extractVideoUrlFromHtml(iframeHtml, iframeRes.url);
          }
        } catch (iframeErr) {
          console.warn('Falha ao inspecionar iframe interno de player:', iframeErr);
        }
      }
    }

    // 4. Se ainda não achou, verifica se o currentStreamUrl tem um token anterior que podemos revalidar se o link no HTML tiver novo parâmetro
    if (!newStreamUrl && currentStreamUrl) {
      // Procura nu3zAQc9HC3GbwJq= na página
      const tokenParamMatch = html.match(/nu3zAQc9HC3GbwJq=([a-zA-Z0-9%\-_=]+)/);
      if (tokenParamMatch && tokenParamMatch[1]) {
        try {
          const streamObj = new URL(currentStreamUrl);
          streamObj.searchParams.set('nu3zAQc9HC3GbwJq', tokenParamMatch[1]);
          newStreamUrl = streamObj.toString();
        } catch {}
      }
    }

    if (!newStreamUrl) {
      return res.status(404).json({
        success: false,
        error:
          'Não foi possível extrair um link de vídeo MP4 na página do filme. A estrutura da página pode ter mudado ou o vídeo requer interação especial.',
        finalPageUrl,
      });
    }

    // Identifica token e expiração da nova URL
    let detectedToken: string | undefined;
    let expiresAt: number | null = null;
    try {
      const parsedStream = new URL(newStreamUrl);
      const nuVal = parsedStream.searchParams.get('nu3zAQc9HC3GbwJq');
      if (nuVal) {
        detectedToken = nuVal;
        const sec = parseInt(nuVal.split('-')[0], 10);
        if (!isNaN(sec) && sec > 1000000000) {
          expiresAt = sec * 1000;
        }
      }
    } catch {}

    return res.json({
      success: true,
      newStreamUrl,
      detectedToken,
      expiresAt,
      finalPageUrl,
      renewedAt: Date.now(),
    });
  } catch (err: any) {
    console.error('Erro na renovação de token:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro de comunicação ao raspar página de origem',
    });
  }
});

/**
 * Rota 3: Proxy de Listas IPTV (M3U / M3U8)
 * Resolve CORS para download e importação de listas remotas da web
 */
app.all('/api/proxy-m3u', async (req: Request, res: Response) => {
  const targetUrl = (req.query.url as string) || (req.body && req.body.url);
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ success: false, error: 'URL da lista não informada' });
  }

  let cleanUrl = targetUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    const upstreamRes = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        Referer: cleanUrl,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        success: false,
        error: `Servidor remoto da lista retornou HTTP ${upstreamRes.status} (${upstreamRes.statusText})`,
      });
    }

    const text = await upstreamRes.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(text);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Falha ao baixar lista remota via proxy',
    });
  }
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
