import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  ArrowLeft,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Film,
  Zap,
  Loader2,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { MovieItem } from '../types/movies';
import {
  getSavedWatchTime,
  saveWatchTime,
  prepareStreamUrl,
  loadMoviesCatalog,
  saveMoviesCatalog
} from '../utils/moviesCatalogStorage';
import { renewMovieToken } from '../utils/tokenRenewalService';

interface NativeMoviePlayerProps {
  movie: MovieItem;
  onClose: () => void;
  onRefreshToken?: (movie: MovieItem) => void;
  onDeleteMovie?: (movie: MovieItem) => void;
  onMovieUpdated?: (movie: MovieItem) => void;
}

export const NativeMoviePlayer: React.FC<NativeMoviePlayerProps> = ({
  movie,
  onClose,
  onRefreshToken,
  onDeleteMovie,
  onMovieUpdated,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [activeUrl, setActiveUrl] = useState<string>(() => prepareStreamUrl(movie.streamUrl));
  const [showTokenRenewInput, setShowTokenRenewInput] = useState<boolean>(false);
  const [newTokenString, setNewTokenString] = useState<string>('');
  const [isAutoRenewing, setIsAutoRenewing] = useState<boolean>(false);
  const [renewStatusMessage, setRenewStatusMessage] = useState<string | null>(null);
  const [showSourcePagePrompt, setShowSourcePagePrompt] = useState<boolean>(false);
  const [manualSourceUrl, setManualSourceUrl] = useState<string>(() => movie.sourcePageUrl || '');
  const controlsTimeoutRef = useRef<number | null>(null);

  // Carrega última posição assistida
  useEffect(() => {
    const lastSaved = getSavedWatchTime(movie.id);
    if (videoRef.current && lastSaved > 5) {
      videoRef.current.currentTime = lastSaved;
    }
  }, [movie.id]);

  // Esconder controles automaticamente para Android TV / Cinema
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4000);
  }, [isPlaying]);

  // Suporte Integral para Controle Remoto Android TV (D-PAD e window.onTvRemoteKey)
  useEffect(() => {
    // 1. Ponte direta nativa chamada pelo MainActivity do Android
    (window as any).onTvRemoteKey = (action: string) => {
      handleUserActivity();
      switch (action) {
        case 'ENTER':
        case 'PLAY_PAUSE':
          togglePlay();
          break;
        case 'RIGHT':
          seekBy(10);
          break;
        case 'LEFT':
          seekBy(-10);
          break;
        case 'UP':
          changeVolume(0.1);
          break;
        case 'DOWN':
          changeVolume(-0.1);
          break;
        case 'BACK':
          if (isFullscreen) {
            toggleFullscreen();
          } else {
            onClose();
          }
          break;
      }
    };

    // 2. Ouvinte padrão de KeyboardEvent (web/navegador e teclas físicas)
    const handleKey = (e: KeyboardEvent) => {
      handleUserActivity();
      if (!videoRef.current) return;

      const key = e.key;
      const code = e.keyCode || e.which;

      if (
        key === ' ' ||
        key === 'Enter' ||
        key === 'Select' ||
        key === 'Ok' ||
        code === 13 ||
        code === 23
      ) {
        e.preventDefault();
        togglePlay();
      } else if (
        key === 'ArrowLeft' ||
        key === 'Left' ||
        code === 37 ||
        code === 21
      ) {
        e.preventDefault();
        seekBy(-10);
      } else if (
        key === 'ArrowRight' ||
        key === 'Right' ||
        code === 39 ||
        code === 22
      ) {
        e.preventDefault();
        seekBy(10);
      } else if (
        key === 'ArrowUp' ||
        key === 'Up' ||
        code === 38 ||
        code === 19
      ) {
        e.preventDefault();
        changeVolume(0.1);
      } else if (
        key === 'ArrowDown' ||
        key === 'Down' ||
        code === 40 ||
        code === 20
      ) {
        e.preventDefault();
        changeVolume(-0.1);
      } else if (
        key === 'Escape' ||
        key === 'Backspace' ||
        key === 'GoBack' ||
        code === 27 ||
        code === 4
      ) {
        e.preventDefault();
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          onClose();
        }
      } else if (key === 'f' || key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (key === 'm' || key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      delete (window as any).onTvRemoteKey;
    };
  }, [handleUserActivity, isFullscreen, onClose]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekBy = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds)
    );
  };

  const changeVolume = (delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, videoRef.current.volume + delta));
    videoRef.current.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    if (Math.floor(videoRef.current.currentTime) % 5 === 0) {
      saveWatchTime(movie.id, videoRef.current.currentTime);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const targetTime = parseFloat(e.target.value);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleApplyRenewedToken = () => {
    if (!newTokenString.trim()) return;
    const updated = prepareStreamUrl(movie.streamUrl, newTokenString.trim());
    setActiveUrl(updated);
    setHasError(false);
    setShowTokenRenewInput(false);
    
    if (onMovieUpdated) {
      onMovieUpdated({ ...movie, streamUrl: updated });
    }
    if (onRefreshToken) {
      onRefreshToken({ ...movie, streamUrl: updated });
    }

    if (videoRef.current) {
      const savedTime = currentTime;
      videoRef.current.src = updated;
      videoRef.current.load();
      videoRef.current.currentTime = savedTime;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleAutoRenewLink = async (customSource?: string) => {
    const targetSource = (customSource || movie.sourcePageUrl || manualSourceUrl).trim();
    if (!targetSource) {
      setShowSourcePagePrompt(true);
      return;
    }

    setIsAutoRenewing(true);
    setRenewStatusMessage('Disparando macro Automa para capturar novo link...');

    try {
      const res = await renewMovieToken({
        ...movie,
        sourcePageUrl: targetSource,
      });

      if (res.success && res.newStreamUrl) {
        setRenewStatusMessage('Link renovado com sucesso via macro Automa! Retomando filme...');
        const updatedMovie: MovieItem = {
          ...movie,
          streamUrl: res.newStreamUrl,
          sourcePageUrl: targetSource,
          tokenExpiresAt: res.expiresAt || undefined,
          lastTokenRenewedAt: Date.now(),
        };

        try {
          const catalog = loadMoviesCatalog();
          const updatedCatalog = catalog.map((m) => (m.id === movie.id ? updatedMovie : m));
          saveMoviesCatalog(updatedCatalog);
        } catch {}

        setActiveUrl(res.newStreamUrl);
        setHasError(false);
        setErrorMessage('');
        setShowSourcePagePrompt(false);
        setShowTokenRenewInput(false);

        if (onMovieUpdated) onMovieUpdated(updatedMovie);
        if (onRefreshToken) onRefreshToken(updatedMovie);

        if (videoRef.current) {
          const savedTime = currentTime || getSavedWatchTime(movie.id);
          videoRef.current.src = res.newStreamUrl;
          videoRef.current.load();
          videoRef.current.currentTime = savedTime;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setRenewStatusMessage(res.error || 'Não foi possível renovar o link automaticamente.');
      }
    } catch (err: any) {
      setRenewStatusMessage(err.message || 'Erro ao conectar ao renovador de link.');
    } finally {
      setIsAutoRenewing(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Player de Vídeo Nativo HTML5 para MP4 Direto */}
      <video
        ref={videoRef}
        src={activeUrl}
        autoPlay
        playsInline
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onLoadedData={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setIsBuffering(false);
          }
        }}
        onError={() => {
          setHasError(true);
          setErrorMessage(
            'O link do vídeo não pôde ser reproduzido. O token de sessão temporário pode ter expirado no servidor ou a conexão foi interrompida.'
          );
        }}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
      />

      {/* Spinner de Carregamento Netflix Red */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/60">
          <div className="w-16 h-16 border-4 border-neutral-800 border-t-[#E50914] rounded-full animate-spin mb-4" />
          <span className="text-white text-xs font-bold tracking-widest uppercase bg-black px-4 py-1.5 rounded-full border border-neutral-800">
            Carregando Stream...
          </span>
        </div>
      )}

      {/* Tela de Erro & Renovação Inteligente de Token Anti-Expiração */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center max-w-lg mx-auto z-40 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-black border-2 border-[#E50914] flex items-center justify-center text-[#E50914] mb-4 shadow-[0_0_20px_rgba(229,9,20,0.4)]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-white mb-2 tracking-tight">Falha na Reprodução</h3>
          <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
            {errorMessage}
          </p>

          {/* Banner de Status da Auto-Renovação */}
          {renewStatusMessage && (
            <div
              className={`w-full text-xs px-4 py-2.5 rounded-xl mb-4 flex items-center justify-center gap-2 border font-medium transition ${
                renewStatusMessage.includes('sucesso')
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                  : isAutoRenewing
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-200'
                  : 'bg-red-950/80 border-red-800 text-red-200'
              }`}
            >
              {isAutoRenewing && <Loader2 className="w-4 h-4 animate-spin text-[#E50914]" />}
              {renewStatusMessage.includes('sucesso') && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              <span>{renewStatusMessage}</span>
            </div>
          )}

          {/* Modal para Informar Link de Origem (caso o filme não possua sourcePageUrl cadastrada) */}
          {showSourcePagePrompt ? (
            <div className="w-full bg-[#111111] border border-neutral-800 p-4 rounded-2xl mb-4 text-left">
              <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
                <Globe className="w-4 h-4 text-[#E50914]" />
                <span>Link da Página do Filme (para auto-captura):</span>
              </div>
              <p className="text-[11px] text-neutral-400 mb-2">
                Cole o link da página do filme no RedeCanais. A macro do Automa vai buscar o stream atualizado automaticamente.
              </p>
              <input
                type="url"
                value={manualSourceUrl}
                onChange={(e) => setManualSourceUrl(e.target.value)}
                placeholder="https://redecanais.af/nome-do-filme..."
                className="w-full bg-black border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 mb-3 font-mono focus:border-[#E50914] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isAutoRenewing}
                  onClick={() => setShowSourcePagePrompt(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isAutoRenewing || !manualSourceUrl.trim()}
                  onClick={() => handleAutoRenewLink(manualSourceUrl)}
                  className="px-4 py-1.5 rounded-lg bg-[#E50914] hover:bg-[#b80710] text-white text-xs font-bold active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAutoRenewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Buscar & Renovar</span>
                </button>
              </div>
            </div>
          ) : showTokenRenewInput ? (
            <div className="w-full bg-[#111111] border border-neutral-800 p-4 rounded-2xl mb-4 text-left">
              <label className="block text-xs font-bold text-white mb-1.5">
                Cole o Novo Token ou Novo Link MP4 Atualizado:
              </label>
              <input
                type="text"
                value={newTokenString}
                onChange={(e) => setNewTokenString(e.target.value)}
                placeholder="Cole o novo link ou hash do token aqui..."
                className="w-full bg-black border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 mb-3 font-mono focus:border-[#E50914] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTokenRenewInput(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyRenewedToken}
                  className="px-4 py-1.5 rounded-lg bg-[#E50914] hover:bg-[#b80710] text-white text-xs font-bold active:scale-95 cursor-pointer"
                >
                  Revalidar & Continuar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 w-full">
              {/* Botão de Renovação Automática 1-Click via Macro Automa */}
              <button
                type="button"
                disabled={isAutoRenewing}
                onClick={() => handleAutoRenewLink()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white text-xs font-extrabold tracking-wide transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(229,9,20,0.5)] active:scale-95 disabled:opacity-50"
              >
                {isAutoRenewing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Renovando via Macro...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Renovar Link Automaticamente</span>
                  </>
                )}
              </button>

              {/* Tentar Recarregar */}
              <button
                type="button"
                disabled={isAutoRenewing}
                onClick={() => {
                  setHasError(false);
                  setRenewStatusMessage(null);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 border border-neutral-700 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar Recarregar</span>
              </button>

              {/* Inserir Link Manualmente */}
              <button
                type="button"
                disabled={isAutoRenewing}
                onClick={() => setShowTokenRenewInput(true)}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-black hover:bg-neutral-900 text-neutral-300 hover:text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 border border-neutral-800 active:scale-95"
              >
                <span>Inserir Manual</span>
              </button>

              {/* Voltar ao Catálogo */}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-transparent hover:bg-neutral-900 text-neutral-400 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                Voltar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Barra Superior Estilo Netflix */}
      <div
        className={`absolute top-0 left-0 right-0 p-5 md:p-8 bg-gradient-to-b from-black via-black/70 to-transparent transition-opacity duration-300 flex items-center justify-between pointer-events-auto ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            title="Voltar ao Catálogo (Esc / Voltar)"
            className="p-3 rounded-full bg-black/90 hover:bg-neutral-800 border border-neutral-700 text-white transition cursor-pointer flex items-center gap-2 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-bold hidden sm:inline">Voltar</span>
          </button>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-white drop-shadow-lg tracking-tight font-['Outfit']">
              {movie.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-300 font-semibold mt-0.5">
              {movie.year && <span>{movie.year}</span>}
              {movie.category && <span>• {movie.category}</span>}
              {movie.duration && <span>• {movie.duration}</span>}
              {movie.rating && (
                <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-[10px] text-white">
                  {movie.rating}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#E50914] bg-black border border-[#E50914] px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(229,9,20,0.3)]">
            NETPLAY CINEMA MP4
          </span>
        </div>
      </div>

      {/* Barra de Controles Inferior */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-5 md:p-8 bg-gradient-to-t from-black via-black/90 to-transparent transition-opacity duration-300 flex flex-col gap-3.5 pointer-events-auto ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber de Progresso Vermelho Netflix */}
        <div className="flex items-center gap-3.5 w-full">
          <span className="text-xs font-mono text-white font-semibold min-w-[50px]">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#E50914] hover:h-2.5 transition-all"
            />
          </div>
          <span className="text-xs font-mono text-neutral-300 min-w-[50px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Botões e Ações */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-3.5 rounded-full bg-white text-black hover:scale-105 transition cursor-pointer shadow-xl active:scale-95"
              title={isPlaying ? 'Pausar (Espaço/Enter)' : 'Reproduzir (Espaço/Enter)'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Seek Back 10s */}
            <button
              type="button"
              onClick={() => seekBy(-10)}
              className="p-2.5 rounded-xl bg-black/90 hover:bg-neutral-800 text-white border border-neutral-700 transition cursor-pointer flex items-center gap-1 text-xs font-bold active:scale-95"
              title="Voltar 10s (Seta Esquerda)"
            >
              <RotateCcw className="w-4 h-4" />
              <span>-10s</span>
            </button>

            {/* Seek Forward 10s */}
            <button
              type="button"
              onClick={() => seekBy(10)}
              className="p-2.5 rounded-xl bg-black/90 hover:bg-neutral-800 text-white border border-neutral-700 transition cursor-pointer flex items-center gap-1 text-xs font-bold active:scale-95"
              title="Avançar 10s (Seta Direita)"
            >
              <RotateCw className="w-4 h-4" />
              <span>+10s</span>
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 text-white hover:text-[#E50914] transition cursor-pointer"
                title="Mudo (M)"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-[#E50914]" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    setVolume(val);
                    setIsMuted(val === 0);
                  }
                }}
                className="w-16 md:w-24 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#E50914] hidden sm:block"
              />
            </div>
          </div>

          {/* Atalhos e Tela Cheia */}
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-neutral-400 hidden xl:inline font-mono">
              [D-PAD OK: Play] [← →: Pular] [F: Tela Cheia] [Voltar: Catálogo]
            </span>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-black/90 hover:bg-neutral-800 text-white border border-neutral-700 transition cursor-pointer active:scale-95"
              title="Alternar Tela Cheia (F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
