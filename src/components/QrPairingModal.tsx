import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, Smartphone, Wifi, CheckCircle2, Copy, Check, RefreshCw, X, Film, Sparkles } from 'lucide-react';
import { MovieItem } from '../types/movies';
import { getApiUrl, getApiBaseUrl } from '../utils/apiConfig';

interface QrPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMovieAdded: (movie: MovieItem) => void;
}

interface PairingSessionData {
  token: string;
  code: string;
  expiresAt: number;
  port: number;
  localIps: string[];
  primaryIp: string;
}

export const QrPairingModal: React.FC<QrPairingModalProps> = ({
  isOpen,
  onClose,
  onMovieAdded,
}) => {
  const [session, setSession] = useState<PairingSessionData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [connectUrl, setConnectUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [receivedMovies, setReceivedMovies] = useState<string[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [buttonFocused, setButtonFocused] = useState<boolean>(true);

  const pollIntervalRef = useRef<any>(null);

  // Inicializa a sessão de pareamento
  const initSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/pareamento/criar'), { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao gerar sessão de pareamento');
      const data: PairingSessionData = await res.json();
      setSession(data);
      try {
        localStorage.setItem('netplay_active_tv_token', data.token);
      } catch {}

      // Determina a melhor URL para o celular acessar
      let baseUrl = window.location.origin;
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';

      if (isCapacitor || !baseUrl.startsWith('http')) {
        baseUrl = getApiBaseUrl() || window.location.origin;
      } else if (isLocalHost && data.primaryIp && data.primaryIp !== 'localhost') {
        baseUrl = `http://${data.primaryIp}:${data.port || 3000}`;
      }

      const targetUrl = `${baseUrl}/conectar?token=${encodeURIComponent(data.token)}&code=${encodeURIComponent(data.code)}`;
      setConnectUrl(targetUrl);

      // Gera o QR Code com alto contraste para leitura rápida por qualquer câmera
      const qrImage = await QRCode.toDataURL(targetUrl, {
        width: 340,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrDataUrl(qrImage);
    } catch (err: any) {
      console.error('Erro ao inicializar pareamento QR:', err);
      setError(err.message || 'Erro de conexão com o servidor local');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initSession();
    } else {
      setSession(null);
      setQrDataUrl('');
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen]);

  // Polling ativo a cada 1.5s enquanto o modal estiver aberto na TV
  useEffect(() => {
    if (!isOpen || !session?.token) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/pareamento/consumir/${session.token}`), { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.movies && data.movies.length > 0) {
            data.movies.forEach((m: any) => {
              const formattedMovie: MovieItem = {
                id: m.id || `movie-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                title: m.title,
                streamUrl: m.streamUrl,
                sourcePageUrl: m.sourcePageUrl,
                category: m.category || 'Ação',
                year: m.year || new Date().getFullYear(),
                synopsis: m.synopsis || '',
                duration: m.duration || '2h 00m',
                rating: m.rating || '14',
                createdAt: m.addedAt || Date.now(),
              };
              onMovieAdded(formattedMovie);
              setReceivedMovies((prev) => [formattedMovie.title, ...prev]);
            });
          }
        }
      } catch (err) {
        // Erro silencioso de rede transitória
      }
    }, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, session, onMovieAdded]);

  // Controle Remoto: Teclas Enter / Back
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 4 || e.keyCode === 27) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyUrlToClipboard = () => {
    if (!connectUrl) return;
    navigator.clipboard.writeText(connectUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row text-white">
        
        {/* Lado Esquerdo: QR Code e Código PIN */}
        <div className="md:w-1/2 p-8 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-900 via-neutral-950 to-black border-b md:border-b-0 md:border-r border-neutral-800">
          <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-red-500 mb-4 bg-red-950/50 px-3.5 py-1.5 rounded-full border border-red-800/40">
            <Wifi className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            Rede Local Wi-Fi / Conexão Direta
          </div>

          <div className="relative p-3.5 bg-white rounded-2xl shadow-xl ring-4 ring-red-600/30">
            {isLoading ? (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center bg-white text-neutral-800">
                <RefreshCw className="w-10 h-10 animate-spin text-red-600 mb-2" />
                <span className="text-xs font-medium">Gerando QR Code...</span>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code para conectar celular à TV"
                className="w-[280px] h-[280px] object-contain rounded-lg"
              />
            ) : (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center bg-white text-neutral-800 p-4 text-center">
                <span className="text-xs text-red-600 font-semibold">{error || 'Não foi possível gerar QR Code'}</span>
                <button
                  onClick={initSession}
                  className="mt-3 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs"
                >
                  Tentar Novamente
                </button>
              </div>
            )}
          </div>

          {session?.code && (
            <div className="mt-5 text-center">
              <span className="text-xs text-neutral-400 font-medium block">Ou digite o código PIN no celular:</span>
              <div className="inline-block mt-1 px-4 py-1.5 bg-neutral-900 border border-neutral-700 rounded-xl font-mono text-2xl font-bold tracking-widest text-red-400 shadow-inner">
                {session.code}
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Instruções e Filmes Recebidos */}
        <div className="md:w-1/2 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-['Outfit'] text-white">Adicionar via Celular</h3>
                  <p className="text-xs text-neutral-400">Adicione filmes sem usar o teclado da TV</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Passos Rápidos */}
            <div className="space-y-3.5 my-6 text-sm text-neutral-300">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold flex items-center justify-center shrink-0 text-red-400 mt-0.5">
                  1
                </div>
                <div>
                  <strong className="text-white block font-medium">Abra a câmera do celular</strong>
                  <span className="text-xs text-neutral-400 leading-relaxed">
                    Aponte para o QR Code ao lado na mesma rede Wi-Fi da TV.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold flex items-center justify-center shrink-0 text-red-400 mt-0.5">
                  2
                </div>
                <div>
                  <strong className="text-white block font-medium">Cole o link do filme e download.api</strong>
                  <span className="text-xs text-neutral-400 leading-relaxed">
                    Preencha o nome, link do stream MP4 e a URL da página do botão de download para auto-renovação.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold flex items-center justify-center shrink-0 text-red-400 mt-0.5">
                  3
                </div>
                <div>
                  <strong className="text-white block font-medium">Envie com 1 toque</strong>
                  <span className="text-xs text-neutral-400 leading-relaxed">
                    O filme aparece instantaneamente nesta TV pronto para assistir!
                  </span>
                </div>
              </div>
            </div>

            {/* Link Direto para Digitar */}
            {connectUrl && (
              <div className="mt-4 p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl">
                <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block mb-1">
                  Endereço no navegador:
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-red-300 truncate select-all">{connectUrl}</span>
                  <button
                    onClick={copyUrlToClipboard}
                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors shrink-0"
                    title="Copiar Link"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Notificação de filmes recebidos nesta sessão */}
            {receivedMovies.length > 0 && (
              <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{receivedMovies.length} filme(s) adicionado(s) pelo celular:</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {receivedMovies.map((title, idx) => (
                    <div key={idx} className="text-xs text-neutral-200 flex items-center gap-1.5">
                      <Film className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botão de Fechar / Concluir para o Controle Remoto */}
          <div className="pt-6 border-t border-neutral-800/80 flex items-center justify-between mt-4">
            <span className="text-xs text-neutral-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Aguardando envio pelo celular...
            </span>

            <button
              onClick={onClose}
              id="qr-close-btn"
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                buttonFocused
                  ? 'bg-red-600 text-white ring-4 ring-red-500/50 scale-105 shadow-lg shadow-red-900/30'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Concluir (OK / Voltar)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
