import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  RotateCw,
  Tv,
  List,
  ChevronRight,
  ChevronLeft,
  Star,
  Search,
  AlertTriangle,
  Radio,
  Sliders,
  X,
  Sparkles,
  Trash2
} from 'lucide-react';
import { IptvChannel } from '../types/iptv';

interface IptvPlayerProps {
  channel: IptvChannel;
  allChannels: IptvChannel[];
  onClose: () => void;
  onSelectChannel: (channel: IptvChannel) => void;
  onToggleFavorite?: (channelId: string) => void;
  onDeleteChannel?: (channelId: string) => void;
}

export const IptvPlayer: React.FC<IptvPlayerProps> = ({
  channel,
  allChannels,
  onClose,
  onSelectChannel,
  onToggleFavorite,
  onDeleteChannel,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<'fit' | 'fill' | '16-9'>('fit');
  const [showChannelDrawer, setShowChannelDrawer] = useState<boolean>(false);
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 = Auto
  const [retryCount, setRetryCount] = useState<number>(0);
  const [channelToDeleteState, setChannelToDeleteState] = useState<IptvChannel | null>(null);
  const [deleteConfirmFocus, setDeleteConfirmFocus] = useState<'cancel' | 'confirm'>('cancel');
  const [errorActionIndex, setErrorActionIndex] = useState<0 | 1 | 2>(0); // 0: Excluir, 1: Reconectar, 2: Voltar

  const controlsTimerRef = useRef<number | null>(null);
  const offlineTimeoutRef = useRef<number | null>(null);

  // Auto-esconder controles após 4 segundos
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = window.setTimeout(() => {
      if (isPlaying && !showChannelDrawer && !hasError) {
        setShowControls(false);
      }
    }, 4500);
  }, [isPlaying, showChannelDrawer, hasError]);

  // Inicialização e recarga do stream HLS com detecção rápida de canal fora do ar
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsBuffering(true);
    setHasError(false);
    setErrorMessage('');
    setErrorActionIndex(0);

    if (offlineTimeoutRef.current) {
      window.clearTimeout(offlineTimeoutRef.current);
    }

    // Detector rápido de canal fora do ar (3.5 segundos)
    offlineTimeoutRef.current = window.setTimeout(() => {
      if (video && (video.paused || !video.currentTime || video.currentTime === 0)) {
        setIsBuffering(false);
        setHasError(true);
        setErrorActionIndex(0);
        setErrorMessage(
          'Canal fora do ar ou transmissão indisponível no momento. Detectado rapidamente pelo NetPlay.'
        );
      }
    }, 3500);

    const onPlaySuccess = () => {
      if (offlineTimeoutRef.current) {
        window.clearTimeout(offlineTimeoutRef.current);
        offlineTimeoutRef.current = null;
      }
      setIsBuffering(false);
      setHasError(false);
    };

    video.addEventListener('playing', onPlaySuccess);
    video.addEventListener('timeupdate', onPlaySuccess);

    // Destrói instância prévia de Hls
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = channel.streamUrl.trim();

    // 1. Suporte a HLS.js (Chrome, Firefox, Edge, Android TV Webview)
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsBuffering(false);
        setHasError(false);
        video.play().catch(() => {
          setIsPlaying(false);
        });

        // Carrega resoluções disponíveis
        if (data.levels && data.levels.length > 0) {
          const qualities = data.levels.map((lvl) => `${lvl.height || 'HD'}p`);
          setAvailableQualities(qualities);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('Erro de rede HLS, tentando recuperar...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Erro de mídia HLS, recuperando decodificador...', data);
              hls.recoverMediaError();
              break;
            default:
              console.error('Erro fatal irrecuperável HLS:', data);
              hls.destroy();
              if (offlineTimeoutRef.current) window.clearTimeout(offlineTimeoutRef.current);
              setIsBuffering(false);
              setHasError(true);
              setErrorMessage(
                'Falha ao conectar à transmissão deste canal. O sinal está fora do ar.'
              );
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // 2. Suporte Nativo HLS (Safari iOS/macOS)
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        onPlaySuccess();
        video.play().catch(() => setIsPlaying(false));
      });
      video.addEventListener('error', () => {
        if (offlineTimeoutRef.current) window.clearTimeout(offlineTimeoutRef.current);
        setIsBuffering(false);
        setHasError(true);
        setErrorMessage('Não foi possível reproduzir o sinal deste canal.');
      });
    } else {
      // 3. Fallback genérico direto
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (offlineTimeoutRef.current) {
        window.clearTimeout(offlineTimeoutRef.current);
      }
      video.removeEventListener('playing', onPlaySuccess);
      video.removeEventListener('timeupdate', onPlaySuccess);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel.id, channel.streamUrl, retryCount]);

  // Próximo canal e Canal anterior
  const currentIndex = allChannels.findIndex((c) => c.id === channel.id);
  const handleNextChannel = () => {
    if (allChannels.length === 0) return;
    const nextIdx = (currentIndex + 1) % allChannels.length;
    onSelectChannel(allChannels[nextIdx]);
  };

  const handlePrevChannel = () => {
    if (allChannels.length === 0) return;
    const prevIdx = (currentIndex - 1 + allChannels.length) % allChannels.length;
    onSelectChannel(allChannels[prevIdx]);
  };

  // Play / Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Mute / Volume
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  // Fullscreen
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

  // Executar exclusão confirmada
  const executeDeleteChannel = () => {
    if (!channelToDeleteState) return;
    const toDeleteId = channelToDeleteState.id;
    const remainingChannels = allChannels.filter((c) => c.id !== toDeleteId);

    onDeleteChannel?.(toDeleteId);
    setChannelToDeleteState(null);

    if (remainingChannels.length > 0) {
      // Avança para o próximo canal disponível
      const nextIdx = currentIndex >= remainingChannels.length ? 0 : currentIndex;
      onSelectChannel(remainingChannels[nextIdx]);
    } else {
      onClose();
    }
  };

  // Suporte a controle remoto D-PAD / TV
  useEffect(() => {
    (window as any).onTvRemoteKey = (action: string) => {
      resetControlsTimer();

      // Se o card de confirmação de exclusão estiver aberto
      if (channelToDeleteState) {
        if (action === 'BACK') {
          setChannelToDeleteState(null);
          return;
        }
        if (action === 'LEFT' || action === 'RIGHT') {
          setDeleteConfirmFocus((prev) => (prev === 'cancel' ? 'confirm' : 'cancel'));
          return;
        }
        if (action === 'ENTER') {
          if (deleteConfirmFocus === 'confirm') {
            executeDeleteChannel();
          } else {
            setChannelToDeleteState(null);
          }
          return;
        }
        return;
      }

      // Se estiver em estado de erro / canal fora do ar
      if (hasError) {
        if (action === 'BACK') {
          onClose();
          return;
        }
        if (action === 'LEFT' || action === 'UP') {
          setErrorActionIndex((prev) => (prev > 0 ? (prev - 1) as any : 3));
          return;
        }
        if (action === 'RIGHT' || action === 'DOWN') {
          setErrorActionIndex((prev) => (prev < 3 ? (prev + 1) as any : 0));
          return;
        }
        if (action === 'ENTER') {
          if (errorActionIndex === 0) {
            setChannelToDeleteState(channel);
            setDeleteConfirmFocus('confirm');
          } else if (errorActionIndex === 1) {
            setRetryCount((c) => c + 1);
          } else if (errorActionIndex === 2) {
            handleNextChannel();
          } else if (errorActionIndex === 3) {
            onClose();
          }
          return;
        }
        return;
      }

      switch (action) {
        case 'UP':
          handlePrevChannel();
          break;
        case 'DOWN':
          handleNextChannel();
          break;
        case 'LEFT':
          setShowChannelDrawer((prev) => !prev);
          break;
        case 'RIGHT':
          toggleFullscreen();
          break;
        case 'DELETE':
          setChannelToDeleteState(channel);
          setDeleteConfirmFocus('cancel');
          break;
        case 'BACK':
          if (showChannelDrawer) {
            setShowChannelDrawer(false);
          } else {
            onClose();
          }
          break;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      resetControlsTimer();
      if (e.target instanceof HTMLInputElement) return;

      // Se o modal de exclusão estiver aberto
      if (channelToDeleteState) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          setChannelToDeleteState(null);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          setDeleteConfirmFocus((prev) => (prev === 'cancel' ? 'confirm' : 'cancel'));
        } else if (e.key === 'Enter') {
          if (deleteConfirmFocus === 'confirm') {
            executeDeleteChannel();
          } else {
            setChannelToDeleteState(null);
          }
        }
        return;
      }

      // Se estiver em estado de erro / canal fora do ar
      if (hasError) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          onClose();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setErrorActionIndex((prev) => (prev > 0 ? (prev - 1) as any : 3));
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          setErrorActionIndex((prev) => (prev < 3 ? (prev + 1) as any : 0));
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (errorActionIndex === 0) {
            setChannelToDeleteState(channel);
            setDeleteConfirmFocus('confirm');
          } else if (errorActionIndex === 1) {
            setRetryCount((c) => c + 1);
          } else if (errorActionIndex === 2) {
            handleNextChannel();
          } else if (errorActionIndex === 3) {
            onClose();
          }
          return;
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (showChannelDrawer) {
          setShowChannelDrawer(false);
        } else {
          onClose();
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        togglePlay();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevChannel();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextChannel();
      } else if (e.key === 'ArrowLeft') {
        handleVolumeChange(volume - 0.1);
      } else if (e.key === 'ArrowRight') {
        handleVolumeChange(volume + 0.1);
      } else if (e.key === 'Delete') {
        setChannelToDeleteState(channel);
        setDeleteConfirmFocus('cancel');
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'c' || e.key === 'C') {
        setShowChannelDrawer((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      delete (window as any).onTvRemoteKey;
    };
  }, [
    allChannels,
    channel,
    channelToDeleteState,
    deleteConfirmFocus,
    showChannelDrawer,
    volume,
    currentIndex,
    resetControlsTimer,
  ]);

  // Lista de canais filtrada para a gaveta lateral
  const drawerChannels = allChannels.filter((c) => {
    if (!drawerSearch.trim()) return true;
    return (
      c.name.toLowerCase().includes(drawerSearch.toLowerCase()) ||
      c.group.toLowerCase().includes(drawerSearch.toLowerCase())
    );
  });

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Elemento de Vídeo */}
      <video
        ref={videoRef}
        playsInline
        className={`w-full h-full ${
          aspectRatio === 'fill'
            ? 'object-cover'
            : aspectRatio === '16-9'
            ? 'aspect-video object-contain'
            : 'object-contain'
        }`}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
      />

      {/* Loading / Spinner */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none z-10">
          <div className="w-14 h-14 border-4 border-neutral-700 border-t-[#E50914] rounded-full animate-spin shadow-lg mb-3" />
          <p className="text-white text-xs font-bold tracking-wider uppercase bg-black/60 px-3 py-1 rounded backdrop-blur-sm">
            Conectando ao sinal IPTV...
          </p>
        </div>
      )}

      {/* Mensagem de Erro com botão Reconectar */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-20 px-6 text-center">
          <AlertTriangle className="w-14 h-14 text-[#E50914] mb-3 animate-bounce" />
          <h3 className="text-white font-black text-xl mb-1">{channel.name}</h3>
          <p className="text-neutral-300 text-sm max-w-md mb-6">{errorMessage}</p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {/* Botão 0: Excluir Canal Fora do Ar */}
            <button
              type="button"
              onClick={() => {
                setChannelToDeleteState(channel);
                setDeleteConfirmFocus('confirm');
              }}
              className={`px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wide flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition ${
                errorActionIndex === 0
                  ? 'bg-red-600 text-white ring-4 ring-white scale-105 shadow-2xl'
                  : 'bg-red-700/80 hover:bg-red-600 text-white'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Canal Fora do Ar</span>
            </button>

            {/* Botão 1: Reconectar */}
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className={`px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wide flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition ${
                errorActionIndex === 1
                  ? 'bg-[#E50914] text-white ring-4 ring-white scale-105 shadow-2xl'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
            >
              <RotateCw className="w-4 h-4" />
              <span>Tentar Reconectar</span>
            </button>

            {/* Botão 2: Próximo Canal */}
            <button
              type="button"
              onClick={handleNextChannel}
              className={`px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wide cursor-pointer transition ${
                errorActionIndex === 2
                  ? 'bg-white text-neutral-950 ring-4 ring-[#E50914] scale-105 shadow-2xl'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
            >
              <span>Próximo Canal</span>
            </button>

            {/* Botão 3: Voltar */}
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-full font-medium text-xs uppercase tracking-wide border cursor-pointer transition ${
                errorActionIndex === 3
                  ? 'bg-white text-neutral-950 border-white ring-4 ring-[#E50914] scale-105 shadow-2xl'
                  : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'
              }`}
            >
              <span>Voltar</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Bar OSD - Info do Canal e Botão Fechar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-30 flex items-center justify-between pointer-events-auto ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onClose}
            title="Voltar (Esc)"
            className="p-2 sm:p-2.5 bg-neutral-900/80 hover:bg-[#E50914] text-white rounded-full transition cursor-pointer backdrop-blur-sm border border-neutral-700 shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Logo do Canal ou Ícone */}
          {channel.logoUrl ? (
            <img
              src={channel.logoUrl}
              alt={channel.name}
              className="w-10 h-10 object-contain bg-neutral-900/90 rounded-lg p-1 border border-neutral-800 shadow"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-white font-black text-sm">
              <Tv className="w-5 h-5 text-[#E50914]" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-black text-base sm:text-lg tracking-tight drop-shadow-sm">
                {channel.name}
              </h2>
              {/* Badge Ao Vivo */}
              <span className="bg-[#E50914] text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                AO VIVO
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-semibold text-neutral-300">{channel.group}</span>
              <span>•</span>
              <span className="bg-neutral-800 text-neutral-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                {channel.quality || 'HD'}
              </span>
            </div>
          </div>
        </div>

        {/* Controles do Topo Direita */}
        <div className="flex items-center gap-2">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(channel.id)}
              className="p-2 sm:p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full transition cursor-pointer backdrop-blur-sm border border-neutral-700"
              title="Favoritar Canal"
            >
              <Star
                className={`w-4 h-4 ${
                  channel.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-neutral-400'
                }`}
              />
            </button>
          )}

          {/* Botão Excluir Canal Fora do Ar */}
          <button
            type="button"
            onClick={() => {
              setChannelToDeleteState(channel);
              setDeleteConfirmFocus('cancel');
            }}
            className="p-2 sm:p-2.5 bg-neutral-900/80 hover:bg-red-600 text-neutral-300 hover:text-white rounded-full transition cursor-pointer backdrop-blur-sm border border-neutral-700"
            title="Excluir este canal se estiver fora do ar"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Botão Abrir Gaveta Lateral de Canais */}
          <button
            type="button"
            onClick={() => setShowChannelDrawer(true)}
            title="Lista de Canais (C)"
            className="px-3 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full text-xs font-bold transition cursor-pointer backdrop-blur-sm border border-neutral-700 flex items-center gap-1.5"
          >
            <List className="w-4 h-4 text-[#E50914]" />
            <span className="hidden sm:inline">Canais</span>
          </button>
        </div>
      </div>

      {/* Bottom Bar OSD - Controles de Reprodução */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 z-30 flex flex-col gap-3 pointer-events-auto ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-3 bg-[#E50914] hover:bg-red-700 text-white rounded-full transition cursor-pointer shadow-lg active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Canal Anterior */}
            <button
              type="button"
              onClick={handlePrevChannel}
              title="Canal Anterior (↑)"
              className="p-2 sm:p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full transition cursor-pointer border border-neutral-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Próximo Canal */}
            <button
              type="button"
              onClick={handleNextChannel}
              title="Próximo Canal (↓)"
              className="p-2 sm:p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full transition cursor-pointer border border-neutral-700"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={toggleMute}
                className="text-neutral-300 hover:text-white transition cursor-pointer p-1"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-500" />
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
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-24 accent-[#E50914] cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Aspect Ratio */}
            <button
              type="button"
              onClick={() => {
                setAspectRatio((prev) => (prev === 'fit' ? '16-9' : prev === '16-9' ? 'fill' : 'fit'));
              }}
              title="Ajuste de Tela"
              className="px-2.5 py-1 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 text-xs font-bold rounded-lg border border-neutral-700 transition cursor-pointer uppercase"
            >
              {aspectRatio}
            </button>

            {/* Reconectar */}
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              title="Reconectar sinal"
              className="p-2 sm:p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-full border border-neutral-700 transition cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Tela Cheia (F)"
              className="p-2 sm:p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full border border-neutral-700 transition cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Gaveta Lateral (Drawer) de Canais com Busca Instantânea */}
      {showChannelDrawer && (
        <div className="absolute inset-y-0 right-0 w-80 sm:w-96 bg-neutral-950/95 border-l border-neutral-800 backdrop-blur-xl z-40 flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-[#E50914]" />
              <h3 className="text-white font-black text-sm tracking-wide uppercase">Canais Disponíveis</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowChannelDrawer(false)}
              className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-900 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Campo de Busca Rápida na Gaveta */}
          <div className="relative mb-3">
            <input
              type="text"
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              placeholder="Buscar canal ou categoria..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#E50914]"
              autoFocus
            />
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Lista de Canais Rolável */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {drawerChannels.map((c) => {
              const isCurrent = c.id === channel.id;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectChannel(c);
                    setShowChannelDrawer(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition ${
                    isCurrent
                      ? 'bg-[#E50914] text-white font-black shadow-md'
                      : 'bg-neutral-900/60 hover:bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.logoUrl ? (
                      <img
                        src={c.logoUrl}
                        alt=""
                        className="w-7 h-7 object-contain bg-black/40 rounded p-0.5 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 flex items-center justify-center shrink-0">
                        <Tv className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs truncate font-bold">{c.name}</p>
                      <p className={`text-[10px] truncate ${isCurrent ? 'text-red-100' : 'text-neutral-500'}`}>
                        {c.group}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.isFavorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChannelToDeleteState(c);
                        setDeleteConfirmFocus('cancel');
                      }}
                      title="Excluir este canal"
                      className="p-1 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Card de Aviso / Confirmação de Exclusão do Canal no Sistema (Padrão Idêntico ao Modo Filmes) */}
      {channelToDeleteState && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center animate-fade-in text-neutral-900">
            <div className="w-14 h-14 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-neutral-950 uppercase tracking-wide mb-2 font-['Outfit']">
              Excluir Canal Fora do Ar?
            </h3>
            <p className="text-xs text-neutral-600 mb-3 font-medium">
              Você pode selecionar a opção desejada usando as setas do controle ou toque:
            </p>
            <p className="text-base font-black text-[#E50914] uppercase mb-6 px-4 py-2 bg-neutral-100 rounded-lg inline-block border border-neutral-300 max-w-full truncate">
              {channelToDeleteState.name}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setChannelToDeleteState(null)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                  deleteConfirmFocus === 'cancel'
                    ? 'bg-neutral-900 text-white ring-4 ring-red-500 shadow-xl scale-105'
                    : 'bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <span>Cancelar (Voltar)</span>
              </button>

              <button
                type="button"
                onClick={executeDeleteChannel}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                  deleteConfirmFocus === 'confirm'
                    ? 'bg-red-600 text-white ring-4 ring-neutral-950 shadow-xl scale-105'
                    : 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
