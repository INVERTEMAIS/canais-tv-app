import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Tv,
  Film,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  FileText,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  ExternalLink,
  Info,
  Check,
  Search
} from 'lucide-react';
import { MovieCategory } from '../types/movies';

const CATEGORIES: MovieCategory[] = [
  'Ação',
  'Ficção & Fantasia',
  'Comédia',
  'Drama',
  'Terror & Suspense',
  'Animação',
  'Documentário',
  'TODOS',
];

interface MobileConnectViewProps {
  onBackToApp?: () => void;
}

export const MobileConnectView: React.FC<MobileConnectViewProps> = ({ onBackToApp }) => {
  const [token, setToken] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [tab, setTab] = useState<'single' | 'batch' | 'help'>('single');

  // Formulário de Filme Individual
  const [title, setTitle] = useState<string>('');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [sourcePageUrl, setSourcePageUrl] = useState<string>('');
  const [category, setCategory] = useState<MovieCategory>('Ação');
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [duration, setDuration] = useState<string>('2h 00m');
  const [synopsis, setSynopsis] = useState<string>('');

  // Formulário em Lote
  const [batchText, setBatchText] = useState<string>('');

  // Estados de Envio e Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isTestingToken, setIsTestingToken] = useState<boolean>(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState<boolean>(false);
  const [tokenTestResult, setTokenTestResult] = useState<any>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Lê parâmetros da URL ao carregar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlCode = params.get('code');

    if (urlToken) setToken(urlToken);
    if (urlCode) setCode(urlCode);

    if (urlToken) {
      checkSession(urlToken);
    } else {
      setSessionStatus('disconnected');
    }
  }, []);

  const checkSession = async (tokenToCheck: string) => {
    setSessionStatus('checking');
    try {
      const res = await fetch(`/api/pareamento/status/${tokenToCheck}`);
      if (res.ok) {
        const data = await res.json();
        if (data.code) setCode(data.code);
        setSessionStatus('connected');
      } else {
        setSessionStatus('disconnected');
      }
    } catch {
      setSessionStatus('disconnected');
    }
  };

  const handleConnectWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSessionStatus('checking');
    try {
      const res = await fetch(`/api/pareamento/status/${code.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setCode(data.code);
        setSessionStatus('connected');
        showSuccess('Smart TV conectada com sucesso!');
      } else {
        setSessionStatus('disconnected');
        showError('Código da TV não encontrado. Verifique o código exibido na tela da TV.');
      }
    } catch {
      setSessionStatus('disconnected');
      showError('Falha ao conectar à Smart TV.');
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setErrorToast(null);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorToast(msg);
    setSuccessToast(null);
    setTimeout(() => setErrorToast(null), 5000);
  };

  // Puxar informações automáticas a partir do link ou nome
  const handleAutoFetchMetadata = async (customUrl?: string) => {
    const urlToFetch = (customUrl || streamUrl || sourcePageUrl).trim();
    if (!urlToFetch && !title.trim()) {
      showError('Cole o link do vídeo/filme ou digite o nome para puxar informações.');
      return;
    }

    setIsFetchingInfo(true);
    setErrorToast(null);

    try {
      const res = await fetch('/api/fetch-movie-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlToFetch || undefined,
          query: title.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível encontrar dados para este link.');
      }

      const meta = data.metadata;
      if (meta.title) setTitle(meta.title);
      if (meta.synopsis) setSynopsis(meta.synopsis);
      if (meta.category) setCategory(meta.category as MovieCategory);
      if (meta.year) setYear(meta.year.toString());
      if (meta.duration) setDuration(meta.duration);
      if (meta.streamUrl && !streamUrl) setStreamUrl(meta.streamUrl);
      if (meta.sourcePageUrl && !sourcePageUrl) setSourcePageUrl(meta.sourcePageUrl);

      showSuccess(`Dados de "${meta.title || 'Filme'}" identificados com sucesso!`);
    } catch (err: any) {
      showError(err.message || 'Falha ao buscar dados automáticos do filme.');
    } finally {
      setIsFetchingInfo(false);
    }
  };

  // Testa renovação do link e token ao vivo antes de enviar
  const handleTestToken = async () => {
    if (!sourcePageUrl.trim()) {
      showError('Informe o link da página do botão de download para testar');
      return;
    }

    setIsTestingToken(true);
    setTokenTestResult(null);

    try {
      const res = await fetch('/api/renovar-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePageUrl: sourcePageUrl.trim(),
          currentStreamUrl: streamUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      setTokenTestResult(data);

      if (data.success) {
        showSuccess('Token decodificado com sucesso!');
        if (data.newStreamUrl) {
          setStreamUrl(data.newStreamUrl);
        }
      } else {
        showError(data.error || 'Não foi possível extrair o token desta URL');
      }
    } catch (err: any) {
      showError(err.message || 'Erro de comunicação ao testar token');
    } finally {
      setIsTestingToken(false);
    }
  };

  // Preenche formulário com exemplo
  const loadGladiatorExample = () => {
    setTitle('Gladiador II (2024)');
    setStreamUrl(
      'https://xn--l---------------------------_________________________-2w85c.null-null.shop/tos-alisg-avt-0068/proxy?container=videos&refresh=31536000&url=https://neosoro.gq/V/RCFServer4/ondemand/MSOCGNHA.mp4?sv=24&cc=y&secure_uri=true&nu3zAQc9HC3GbwJq=1789858783-1aVawtjNUaVr1Fmgr5piXHcGJHExiHUZzfGFwHV9ypk%3D'
    );
    setSourcePageUrl(
      'https://redecanais.af/player3/download.api?download=cm1tYllyR3lQenh6ZlJ0KzZtRmIzeGowdU9KTVBBN0JCei9jUkRiVnllNDUwMG9CckFRK3o3TlpadENjSjZ1a2FDWnlFSzRUVkZjRExtTFdKdTAwQTJNbkR2LzVObkc2Z0d2TURFUnM0Q2VvcjlHWitHYzk0bkhZdURlU05sVnAzSGh5MnN5NXE3K1RGaUYzSlJwbkwrM0dZVFF3ZnlxbVRLdCtNblByU2hYSGx2OERNKzJXdTExVjlaVXh6N0JlOERoTlhTTm5jS2h4REZqdE55UGZiNE5lUldsaTd4ZEpMSldYS3lGVnkralFmMWFZYXFzS1FhenhpMHF4Rk9VQlBHcjkrRmh1bDByeFdBVmlQelg0cmNaeXVJbVJuWXlzeElQYldvS0ljNnRkdFllNi9vcitwNmVNOFRrRWdhWXBVTkFtSTRsQURxbzliVzdpcHdvL1pzTlJlZC9WMmRTL2g2Qm03Z2tXMkp0R0lnSm5tcXJ1b0lGeTFKaU9RR0IxRWM2YXJ5ekFLdjRkSU1CbmpSK1U5cUJIMFphckZRPT0=#'
    );
    setCategory('Ação');
    setYear('2024');
    setDuration('2h 28m');
    setSynopsis(
      'Anos após testemunhar a morte do reverenciado herói Maximus pelas mãos de seu tio, Lucius deve entrar no Coliseu após sua casa ser conquistada pelos imperadores tirânicos que agora lideram Roma.'
    );
    showSuccess('Exemplo preenchido! Clique em "Enviar para a Smart TV".');
  };

  // Envio de filme único para a Smart TV
  const handleSendSingleMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !streamUrl.trim()) {
      showError('Preencha ao menos o Título e o Link do Vídeo');
      return;
    }

    if (!token && !code) {
      showError('Informe o código da TV para conectar');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pareamento/adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          code,
          movie: {
            title: title.trim(),
            streamUrl: streamUrl.trim(),
            sourcePageUrl: sourcePageUrl.trim() || undefined,
            category,
            year: year ? parseInt(year, 10) : new Date().getFullYear(),
            duration: duration.trim(),
            synopsis: synopsis.trim(),
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        showSuccess(`Filme "${title}" enviado com sucesso para a TV!`);
        setTitle('');
        setStreamUrl('');
        setSourcePageUrl('');
        setSynopsis('');
        setTokenTestResult(null);
      } else {
        showError(data.error || 'Erro ao enviar filme para a TV');
      }
    } catch (err: any) {
      showError(err.message || 'Falha na conexão com a TV');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Envio em Lote (múltiplos filmes)
  const handleSendBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) {
      showError('Cole as linhas de filmes no formato especificado');
      return;
    }

    const lines = batchText.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.length === 0) {
      showError('Nenhuma linha válida encontrada');
      return;
    }

    setIsSubmitting(true);
    let countSuccess = 0;

    for (const line of lines) {
      const parts = line.split(';').map((p) => p.trim());
      if (parts.length < 2) continue;

      const mTitle = parts[0];
      const mStream = parts[1];
      const mSource = parts[2] || undefined;
      const mCategory = parts[3] || 'Ação';
      const mYear = parts[4] ? parseInt(parts[4], 10) : new Date().getFullYear();
      const mSynopsis = parts[5] || '';

      try {
        const res = await fetch('/api/pareamento/adicionar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            code,
            movie: {
              title: mTitle,
              streamUrl: mStream,
              sourcePageUrl: mSource,
              category: mCategory,
              year: mYear,
              synopsis: mSynopsis,
            },
          }),
        });
        if (res.ok) countSuccess++;
      } catch {}
    }

    setIsSubmitting(false);
    if (countSuccess > 0) {
      showSuccess(`${countSuccess} filme(s) enviados para a Smart TV!`);
      setBatchText('');
    } else {
      showError('Falha ao enviar lote de filmes');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900 flex flex-col items-center p-4 sm:p-6 font-['Outfit',sans-serif]">
      {/* Notificações Flutuantes */}
      {successToast && (
        <div className="fixed top-4 inset-x-4 max-w-md mx-auto z-50 p-4 bg-emerald-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <span className="text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-4 inset-x-4 max-w-md mx-auto z-50 p-4 bg-[#E50914] text-white rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <span className="text-sm font-semibold">{errorToast}</span>
        </div>
      )}

      {/* Cabeçalho Limpo em Branco, Vermelho e Preto */}
      <header className="w-full max-w-xl flex items-center justify-between py-4 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E50914] flex items-center justify-center font-black text-white shadow-md shadow-red-600/30">
            NP
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-neutral-950 uppercase">NetPlay TV Connect</h1>
            <span className="text-xs text-neutral-500 font-medium">Adicionar Filmes na Smart TV pelo Celular</span>
          </div>
        </div>

        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="text-xs px-3.5 py-1.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Tv className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Ver TV</span>
          </button>
        )}
      </header>

      {/* Caixa de Status da Conexão com a Smart TV */}
      <div className="w-full max-w-xl my-4">
        {sessionStatus === 'connected' ? (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <span className="text-xs font-black text-emerald-800 uppercase tracking-wider block">
                  Conectado à Smart TV
                </span>
                <span className="text-sm font-mono text-neutral-900 font-black">
                  Código da Sessão: {code || token.slice(0, 10)}
                </span>
              </div>
            </div>
            <Tv className="w-6 h-6 text-emerald-600" />
          </div>
        ) : (
          <div className="p-5 bg-white border-2 border-neutral-200 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-wider mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Smart TV não conectada</span>
            </div>
            <p className="text-xs text-neutral-600 mb-3 leading-relaxed">
              Digite o código PIN de 6 dígitos exibido na tela da sua Smart TV para parear:
            </p>
            <form onSubmit={handleConnectWithCode} className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 742-198"
                className="flex-1 bg-neutral-50 border-2 border-neutral-300 rounded-xl px-4 py-2.5 text-neutral-900 font-mono text-center text-lg uppercase tracking-widest focus:outline-none focus:bg-white focus:border-[#E50914] font-bold"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#E50914] hover:bg-[#b80710] text-white font-black rounded-xl text-sm transition-colors flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer"
              >
                <Tv className="w-4 h-4" />
                <span>Conectar</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="w-full max-w-xl flex border-b-2 border-neutral-200 mb-5">
        <button
          onClick={() => setTab('single')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 -mb-0.5 transition-colors cursor-pointer ${
            tab === 'single'
              ? 'border-[#E50914] text-[#E50914]'
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Filme Individual</span>
        </button>

        <button
          onClick={() => setTab('batch')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 -mb-0.5 transition-colors cursor-pointer ${
            tab === 'batch'
              ? 'border-[#E50914] text-[#E50914]'
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Em Lote (CSV)</span>
        </button>

        <button
          onClick={() => setTab('help')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 -mb-0.5 transition-colors cursor-pointer ${
            tab === 'help'
              ? 'border-[#E50914] text-[#E50914]'
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Como Usar</span>
        </button>
      </div>

      {/* Conteúdo da Aba: Filme Individual */}
      {tab === 'single' && (
        <form onSubmit={handleSendSingleMovie} className="w-full max-w-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-neutral-700 uppercase tracking-wider">
              Dados do Filme
            </span>
            <button
              type="button"
              onClick={loadGladiatorExample}
              className="text-xs font-bold text-[#E50914] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Testar com Exemplo (Gladiador II)</span>
            </button>
          </div>

          {/* Painel Inteligente de Puxar Informações do Filme */}
          <div className="p-3.5 bg-white border-2 border-neutral-200 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-neutral-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
                Puxar Informações do Link
              </span>
              <span className="text-[10px] text-neutral-500 font-bold bg-neutral-100 px-2 py-0.5 rounded">
                Automático
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Cole o link do vídeo ou página abaixo e clique para identificar título, ano, sinopse e categoria automaticamente.
            </p>
            <button
              type="button"
              disabled={isFetchingInfo}
              onClick={() => handleAutoFetchMetadata()}
              className="w-full py-2.5 px-3 rounded-xl bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
            >
              {isFetchingInfo ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E50914]" />
                  <span>Identificando Filme...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Buscar Informações do Link</span>
                </>
              )}
            </button>
          </div>

          {/* Campo: Link do Vídeo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-900">
                Link do Vídeo (.mp4 ou HLS) *
              </label>
              {streamUrl && !title && (
                <button
                  type="button"
                  onClick={() => handleAutoFetchMetadata(streamUrl)}
                  className="text-[10px] font-bold text-[#E50914] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Identificar dados deste link
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="url"
                required
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                onBlur={() => {
                  if (streamUrl && !title) {
                    handleAutoFetchMetadata(streamUrl);
                  }
                }}
                placeholder="https://.../video.mp4"
                className="w-full bg-white border-2 border-neutral-300 rounded-xl pl-9 pr-3.5 py-2.5 text-neutral-900 text-xs font-mono focus:outline-none focus:border-[#E50914] shadow-xs"
              />
              <LinkIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Campo: Nome do Filme */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-900 mb-1.5">
              Nome / Título do Filme *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Gladiador II"
              className="w-full bg-white border-2 border-neutral-300 rounded-xl px-3.5 py-2.5 text-neutral-900 text-sm font-bold focus:outline-none focus:border-[#E50914] shadow-xs"
            />
          </div>

          {/* Campo: Auto-Renovação */}
          <div className="p-3.5 bg-white border-2 border-neutral-200 rounded-2xl space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-neutral-900 flex items-center gap-1.5 uppercase tracking-wider">
                <LinkIcon className="w-3.5 h-3.5 text-[#E50914]" />
                <span>Página do Botão de Download (Opcional)</span>
              </label>
              <button
                type="button"
                onClick={handleTestToken}
                disabled={isTestingToken || !sourcePageUrl.trim()}
                className="text-[11px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 text-neutral-800 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer border border-neutral-300"
              >
                {isTestingToken ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-[#E50914]" />
                ) : (
                  <Sparkles className="w-3 h-3 text-[#E50914]" />
                )}
                <span>Testar Token</span>
              </button>
            </div>

            <input
              type="url"
              value={sourcePageUrl}
              onChange={(e) => setSourcePageUrl(e.target.value)}
              placeholder="https://redecanais.af/player3/download.api?download=..."
              className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl px-3.5 py-2 text-neutral-900 font-mono text-xs focus:outline-none focus:bg-white focus:border-[#E50914]"
            />
            <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
              💡 O servidor renovará tokens temporários automaticamente através desta página se o link expirar.
            </p>

            {/* Resultado do Teste de Token */}
            {tokenTestResult && (
              <div
                className={`p-2.5 rounded-xl text-xs mt-2 ${
                  tokenTestResult.success
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                    : 'bg-red-50 border border-red-300 text-red-800'
                }`}
              >
                {tokenTestResult.success ? (
                  <div>
                    <div className="font-bold flex items-center gap-1 mb-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Token Renovado com Sucesso!</span>
                    </div>
                    {tokenTestResult.expiresAt && (
                      <span className="text-[11px] text-neutral-600 block">
                        Válido até: {new Date(tokenTestResult.expiresAt).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span>{tokenTestResult.error || 'Falha ao renovar token'}</span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-900 mb-1.5">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MovieCategory)}
                className="w-full bg-white border-2 border-neutral-300 rounded-xl px-3 py-2 text-neutral-900 text-sm font-bold focus:outline-none focus:border-[#E50914] shadow-xs cursor-pointer"
              >
                {CATEGORIES.filter((c) => c !== 'TODOS').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-900 mb-1.5">Ano de Lançamento</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                className="w-full bg-white border-2 border-neutral-300 rounded-xl px-3 py-2 text-neutral-900 text-sm font-bold focus:outline-none focus:border-[#E50914] shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-900 mb-1.5">Duração (opcional)</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex: 2h 28m"
              className="w-full bg-white border-2 border-neutral-300 rounded-xl px-3.5 py-2 text-neutral-900 text-sm font-bold focus:outline-none focus:border-[#E50914] shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-900 mb-1.5">Sinopse (opcional)</label>
            <textarea
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Breve história do filme..."
              className="w-full bg-white border-2 border-neutral-300 rounded-xl p-3 text-neutral-900 text-sm focus:outline-none focus:border-[#E50914] resize-none shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#E50914] hover:bg-[#b80710] disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span>Enviar para a Smart TV</span>
          </button>
        </form>
      )}

      {/* Conteúdo da Aba: Importação em Lote */}
      {tab === 'batch' && (
        <form onSubmit={handleSendBatch} className="w-full max-w-xl space-y-4">
          <div className="bg-white border-2 border-neutral-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-neutral-900">
                Lista de filmes (CSV / Ponto e vírgula):
              </label>
              <button
                type="button"
                onClick={() =>
                  setBatchText(
                    `Gladiador II;https://neosoro.gq/V/RCFServer4/ondemand/MSOCGNHA.mp4?sv=24&nu3zAQc9HC3GbwJq=...;https://redecanais.af/player3/download.api?download=cm1tYllyR3lQenh6ZlJ0KzZtRmIzeGowdU9KTVBBN0JCei9jUkRiVnllNDUwMG9CckFRK3o3TlpadENjSjZ1a2FDWnlFSzRUVkZjRExtTFdKdTAwQTJNbkR2LzVObkc2Z0d2TURFUnM0Q2VvcjlHWitHYzk0bkhZdURlU05sVnAzSGh5MnN5NXE3K1RGaUYzSlJwbkwrM0dZVFF3ZnlxbVRLdCtNblByU2hYSGx2OERNKzJXdTExVjlaVXh6N0JlOERoTlhTTm5jS2h4REZqdE55UGZiNE5lUldsaTd4ZEpMSldYS3lGVnkralFmMWFZYXFzS1FhenhpMHF4Rk9VQlBHcjkrRmh1bDByeFdBVmlQelg0cmNaeXVJbVJuWXlzeElQYldvS0ljNnRkdFllNi9vcitwNmVNOFRrRWdhWXBVTkFtSTRsQURxbzliVzdpcHdvL1pzTlJlZC9WMmRTL2g2Qm03Z2tXMkp0R0lnSm5tcXJ1b0lGeTFKaU9RR0IxRWM2YXJ5ekFLdjRkSU1CbmpSK1U5cUJIMFphckZRPT0=#;Ação;2024;Anos após testemunhar a morte do herói Maximus, Lucius deve entrar no Coliseu.`
                  )
                }
                className="text-xs font-bold text-[#E50914] hover:underline cursor-pointer"
              >
                Colar Exemplo
              </button>
            </div>

            <textarea
              rows={8}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Título;URL_Vídeo;URL_Download_API;Categoria;Ano;Sinopse"
              className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl p-3.5 text-neutral-900 font-mono text-xs focus:outline-none focus:bg-white focus:border-[#E50914]"
            />
            <p className="text-[11px] text-neutral-500 mt-2 font-medium">
              Formato por linha: <code>Título;Link_MP4;Link_Download_API;Categoria;Ano;Sinopse</code>
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#E50914] hover:bg-[#b80710] disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Layers className="w-5 h-5" />
            )}
            <span>Enviar Todos para a TV</span>
          </button>
        </form>
      )}

      {/* Conteúdo da Aba: Instruções */}
      {tab === 'help' && (
        <div className="w-full max-w-xl space-y-4 text-sm text-neutral-700">
          <div className="p-5 bg-white border-2 border-neutral-200 rounded-2xl shadow-xs">
            <h3 className="text-base font-black text-neutral-950 mb-2 flex items-center gap-2 font-['Outfit']">
              <Sparkles className="w-4 h-4 text-[#E50914]" />
              <span>Como Funciona a Renovação Automática</span>
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed mb-3">
              Muitos servidores de streaming colocam tokens temporários nos links de vídeo. O NetPlay decodifica a página do botão de download em tempo real e renova o token automaticamente.
            </p>
          </div>

          <div className="p-5 bg-white border-2 border-neutral-200 rounded-2xl space-y-3 shadow-xs">
            <h3 className="text-base font-black text-neutral-950 flex items-center gap-2 font-['Outfit']">
              <LinkIcon className="w-4 h-4 text-[#E50914]" />
              <span>Como Pegar o Link do Filme</span>
            </h3>
            <ol className="text-xs space-y-2 list-decimal list-inside text-neutral-600 leading-relaxed font-medium">
              <li>Abra a página do filme no seu celular ou computador.</li>
              <li>Copie o link da barra de navegação ou o link do botão de download/vídeo.</li>
              <li>Cole no campo <strong>Link do Vídeo</strong> e clique em <strong>Buscar Informações do Link</strong>!</li>
              <li>O sistema preenche o título, categoria e sinopse sozinho. Clique em <strong>Enviar para a Smart TV</strong>!</li>
            </ol>
          </div>
        </div>
      )}

      <footer className="mt-8 text-center text-xs text-neutral-500 pb-6 font-bold">
        NETPLAY CINEMA • Pareamento Inteligente Smart TV & Celular
      </footer>
    </div>
  );
};
