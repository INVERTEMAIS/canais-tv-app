import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
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
  Trash2
} from 'lucide-react';
import { MovieItem } from '../types/movies';
import { getSavedWatchTime, saveWatchTime, prepareStreamUrl } from '../utils/moviesCatalogStorage';
import { renewMovieToken } from '../utils/tokenRenewalService';

interface NativeMoviePlayerProps {
  movie: MovieItem;
  onClose: () => void;
  onRefreshToken?: (movie: MovieItem) => void;
  onDeleteMovie?: (movie: MovieItem) => void;
}

export const NativeMoviePlayer: React.FC<NativeMoviePlayerProps> = ({
  movie,
  onClose,
  onRefreshToken,
  onDeleteMovie,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

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
  const [isAutoRenewing, setIsAutoRenewing] = useState<boolean>(false);
  const [autoRenewAttempted, setAutoRenewAttempted] = useState<boolean>(false);
  const [showTokenRenewInput, setShowTokenRenewInput] = useState<boolean>(false);
  const [newTokenString, setNewTokenString] = useState<string>('');
  const [resumedTimeText, setResumedTimeText] = useState<string | null>(null);
  const [errorActionIndex, setErrorActionIndex] = useState<number>(0); // 0: Excluir, 1: Auto-Renovar, 2: Recarregar, 3: Voltar
  const controlsTimeoutRef = useRef<number | null>(null);
  const offlineTimeoutRef = useRef<number | null>(null);
  const hasRestoredPositionRef = useRef<boolean>(false);

  // Auto-renovação de token de sessão via backend usando a página de origem
  const handleAutoRenewMovie = useCallback(async () => {
    if (!movie.sourcePageUrl) {
      setHasError(true);
      setErrorMessage(
        'Este filme não possui "Link de Origem" cadastrado para renovação automática. Você pode colar o novo link ou cadastrar a página de origem.'
      );
      return;
    }

    setIsAutoRenewing(true);
    setHasError(false);

    try {
      const result = await renewMovieToken(movie);
      if (result.success && result.newStreamUrl) {
        const newUrl = result.newStreamUrl;
        setActiveUrl(newUrl);
        setIsAutoRenewing(false);
        setHasError(false);

        const updatedMovie: MovieItem = {
          ...movie,
          streamUrl: newUrl,
          tokenExpiresAt: result.expiresAt || undefined,
          lastTokenRenewedAt: Date.now(),
        };

        if (onRefreshToken) {
          onRefreshToken(updatedMovie);
        }

        if (videoRef.current) {
          const lastPos = currentTime > 2 ? currentTime : getSavedWatchTime(movie.id);
          videoRef.current.src = newUrl;
          videoRef.current.load();
          if (lastPos > 0) {
            videoRef.current.currentTime = lastPos;
          }
          videoRef.current.play().catch(() => {});
        }
      } else {
        setIsAutoRenewing(false);
        setHasError(true);
        setErrorMessage(
          result.error ||
            'Não foi possível extrair um novo token da página de origem. Verifique se o domínio do site mudou no Painel de Diagnóstico.'
        );
      }
    } catch (err: any) {
      setIsAutoRenewing(false);
      setHasError(true);
      setErrorMessage(err.message || 'Falha ao conectar com o serviço de renovação de links.');
    }
  }, [movie, currentTime, onRefreshToken]);

  // Formata segundos em MM:SS ou HH:MM:SS
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Função central para retomar o filme de onde o usuário parou
  const tryRestoreWatchPosition = useCallback(() => {
    if (hasRestoredPositionRef.current || !videoRef.current) return;
    const lastSaved = getSavedWatchTime(movie.id);
    const dur = videoRef.current.duration;

    // Só restaura se parou após 4 segundos e ainda não tinha chegado aos últimos 10 segundos
    if (lastSaved > 4 && (isNaN(dur) || dur === 0 || lastSaved < dur - 10)) {
      try {
        videoRef.current.currentTime = lastSaved;
        setCurrentTime(lastSaved);
        hasRestoredPositionRef.current = true;
        setResumedTimeText(formatTime(lastSaved));
        // Some aviso após 5 segundos
        window.setTimeout(() => {
          setResumedTimeText(null);
        }, 5000);
      } catch (err) {
        console.warn('Tentativa de restaurar posição de vídeo adiada', err);
      }
    } else {
      hasRestoredPositionRef.current = true;
    }
  }, [movie.id]);

  // Salvar posição com segurança ao sair ou desmontar o componente
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.currentTime > 2) {
        saveWatchTime(movie.id, videoRef.current.currentTime, videoRef.current.duration);
      }
    };
  }, [movie.id]);

  // Suporte HLS (.m3u8) e MP4 direto
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isM3u8 = activeUrl.includes('.m3u8') || activeUrl.includes('m3u8');

    if (offlineTimeoutRef.current) {
      window.clearTimeout(offlineTimeoutRef.current);
    }

    // Detecção rápida de filme offline (4 segundos)
    offlineTimeoutRef.current = window.setTimeout(() => {
      if (video && (video.paused || !video.currentTime || video.currentTime === 0)) {
        setIsBuffering(false);
        if (movie.sourcePageUrl && !autoRenewAttempted) {
          setAutoRenewAttempted(true);
          handleAutoRenewMovie();
        } else {
          setHasError(true);
          setErrorMessage('Filme fora do ar ou link de vídeo expirado. Detectado rapidamente pelo NetPlay.');
        }
      }
    }, 4000);

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

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(activeUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onPlaySuccess();
        tryRestoreWatchPosition();
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (offlineTimeoutRef.current) window.clearTimeout(offlineTimeoutRef.current);
          if (movie.sourcePageUrl && !autoRenewAttempted) {
            setAutoRenewAttempted(true);
            handleAutoRenewMovie();
          } else {
            setIsBuffering(false);
            setHasError(true);
            setErrorMessage('Falha ao reproduzir fluxo do vídeo.');
          }
        }
      });
    } else {
      video.src = activeUrl;
      video.load();
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
  }, [activeUrl, autoRenewAttempted, handleAutoRenewMovie, movie.sourcePageUrl, tryRestoreWatchPosition]);

  const handleRestartFromBeginning = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      saveWatchTime(movie.id, 0, videoRef.current.duration);
      setResumedTimeText(null);
    }
  };

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
      // Se estiver em estado de erro / filme fora do ar
      if (hasError) {
        if (action === 'BACK') {
          onClose();
          return;
        }
        if (action === 'LEFT' || action === 'UP') {
          setErrorActionIndex((prev) => (prev > 0 ? prev - 1 : 3));
          return;
        }
        if (action === 'RIGHT' || action === 'DOWN') {
          setErrorActionIndex((prev) => (prev < 3 ? prev + 1 : 0));
          return;
        }
        if (action === 'ENTER') {
          if (errorActionIndex === 0) {
            onDeleteMovie?.(movie);
            onClose();
          } else if (errorActionIndex === 1) {
            if (movie.sourcePageUrl) {
              handleAutoRenewMovie();
            } else {
              setHasError(false);
              videoRef.current?.load();
              videoRef.current?.play().catch(() => {});
            }
          } else if (errorActionIndex === 2) {
            setHasError(false);
            videoRef.current?.load();
            videoRef.current?.play().catch(() => {});
          } else if (errorActionIndex === 3) {
            onClose();
          }
          return;
        }
        return;
      }

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
      // Se estiver digitando no campo de renovar token ou outro input, não intercepta teclas
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      handleUserActivity();

      // Se estiver em tela de erro
      if (hasError) {
        if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 27 || e.keyCode === 4) {
          onClose();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.keyCode === 37 || e.keyCode === 38) {
          e.preventDefault();
          setErrorActionIndex((prev) => (prev > 0 ? prev - 1 : 3));
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.keyCode === 39 || e.keyCode === 40) {
          e.preventDefault();
          setErrorActionIndex((prev) => (prev < 3 ? prev + 1 : 0));
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 23) {
          e.preventDefault();
          if (errorActionIndex === 0) {
            onDeleteMovie?.(movie);
            onClose();
          } else if (errorActionIndex === 1) {
            if (movie.sourcePageUrl) {
              handleAutoRenewMovie();
            } else {
              setHasError(false);
              videoRef.current?.load();
              videoRef.current?.play().catch(() => {});
            }
          } else if (errorActionIndex === 2) {
            setHasError(false);
            videoRef.current?.load();
            videoRef.current?.play().catch(() => {});
          } else if (errorActionIndex === 3) {
            onClose();
          }
          return;
        }
        return;
      }

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
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(curr);
    if (curr > 2) {
      saveWatchTime(movie.id, curr, dur);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const targetTime = parseFloat(e.target.value);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    saveWatchTime(movie.id, targetTime, videoRef.current.duration);
  };

  const handleApplyRenewedToken = () => {
    if (!newTokenString.trim()) return;
    const updated = prepareStreamUrl(movie.streamUrl, newTokenString.trim());
    setActiveUrl(updated);
    setHasError(false);
    setShowTokenRenewInput(false);
    if (videoRef.current) {
      const savedTime = currentTime;
      videoRef.current.src = updated;
      videoRef.current.load();
      videoRef.current.currentTime = savedTime;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Notificação Estilo Netflix ao Retomar de Onde Parou */}
      {resumedTimeText && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141414]/95 border-2 border-[#E50914] px-5 py-3 rounded-2xl shadow-[0_10px_35px_rgba(229,9,20,0.5)] flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E50914] animate-ping shrink-0" />
          <div className="text-left">
            <p className="text-xs font-black text-white uppercase tracking-wider font-['Outfit']">
              Continuando de onde você parou ({resumedTimeText})
            </p>
            <span className="text-[10px] text-neutral-400">Progresso restaurado automaticamente</span>
          </div>
          <button
            type="button"
            onClick={handleRestartFromBeginning}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold transition active:scale-95 border border-neutral-700 ml-2 cursor-pointer"
          >
            Começar do Início
          </button>
        </div>
      )}

      {/* Player de Vídeo Nativo HTML5 para MP4 e HLS (m3u8) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
          tryRestoreWatchPosition();
        }}
        onCanPlay={() => {
          setIsBuffering(false);
          tryRestoreWatchPosition();
        }}
        onPause={() => {
          setIsPlaying(false);
          if (videoRef.current && videoRef.current.currentTime > 2) {
            saveWatchTime(movie.id, videoRef.current.currentTime, videoRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (videoRef.current) {
            saveWatchTime(movie.id, 0, videoRef.current.duration);
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          tryRestoreWatchPosition();
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setIsBuffering(false);
            tryRestoreWatchPosition();
          }
        }}
        onError={() => {
          if (movie.sourcePageUrl && !autoRenewAttempted) {
            setAutoRenewAttempted(true);
            handleAutoRenewMovie();
          } else {
            setHasError(true);
            setErrorMessage(
              'O link do vídeo não pôde ser reproduzido. O token de sessão temporário pode ter expirado no servidor ou a conexão foi interrompida.'
            );
          }
        }}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
      />

      {/* Overlay de Auto-Renovação em Segundo Plano */}
      {isAutoRenewing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-40 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 border-2 border-[#E50914] flex items-center justify-center text-[#E50914] mb-4 shadow-[0_0_25px_rgba(229,9,20,0.6)] animate-pulse">
            <Zap className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white mb-1.5 uppercase font-['Outfit'] tracking-wide">
            Renovando Chave de Transmissão...
          </h3>
          <p className="text-xs text-neutral-300 max-w-sm mb-4 leading-relaxed">
            O link anterior expirou. O NetPlay está buscando uma chave nova diretamente na página de origem do filme.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300 bg-amber-950/60 px-3.5 py-1.5 rounded-full border border-amber-800/60">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Extraindo novo link MP4 com token de hoje...</span>
          </div>
        </div>
      )}

      {/* Spinner de Carregamento Netflix Red */}
      {isBuffering && !hasError && !isAutoRenewing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/60">
          <div className="w-16 h-16 border-4 border-neutral-800 border-t-[#E50914] rounded-full animate-spin mb-4" />
          <span className="text-white text-xs font-bold tracking-widest uppercase bg-black px-4 py-1.5 rounded-full border border-neutral-800">
            Carregando Stream...
          </span>
        </div>
      )}

      {/* Tela de Erro & Renovação Inteligente de Token Anti-Expiração */}
      {hasError && !isAutoRenewing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-6 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-black border border-[#E50914] flex items-center justify-center text-[#E50914] mb-4 shadow-[0_0_15px_rgba(229,9,20,0.4)]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-white mb-2 tracking-tight">Falha na Reprodução</h3>
          <p className="text-xs text-neutral-300 mb-6 leading-relaxed">
            {errorMessage}
          </p>

          {showTokenRenewInput ? (
            <div className="w-full bg-[#111111] border border-neutral-800 p-4 rounded-2xl mb-4 text-left">
              <label className="block text-xs font-bold text-white mb-1.5">
                Cole o Novo Token ou Novo Link MP4 Atualizado:
              </label>
              <input
                type="text"
                value={newTokenString}
                onChange={(e) => setNewTokenString(e.target.value)}
                placeholder="Cole o novo link ou hash do token aqui..."
                className="w-full bg-black border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 mb-3 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTokenRenewInput(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyRenewedToken}
                  className="px-4 py-1.5 rounded-lg bg-[#E50914] text-white text-xs font-bold active:scale-95"
                >
                  Revalidar & Continuar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Botão 0: Excluir Filme Fora do Ar */}
              <button
                type="button"
                onClick={() => {
                  onDeleteMovie?.(movie);
                  onClose();
                }}
                className={`px-5 py-2.5 rounded-xl font-black text-xs tracking-wide transition cursor-pointer flex items-center gap-2 shadow-lg active:scale-95 ${
                  errorActionIndex === 0
                    ? 'bg-red-600 text-white ring-4 ring-white scale-105 shadow-2xl'
                    : 'bg-red-700/80 hover:bg-red-600 text-white'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Filme Fora do Ar</span>
              </button>

              {movie.sourcePageUrl && (
                <button
                  type="button"
                  onClick={handleAutoRenewMovie}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer flex items-center gap-2 shadow-lg active:scale-95 ${
                    errorActionIndex === 1
                      ? 'bg-[#E50914] text-white ring-4 ring-white scale-105 shadow-2xl'
                      : 'bg-[#E50914]/90 hover:bg-[#b80710] text-white shadow-red-950/50'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>⚡ Auto-Renovar Chave</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setHasError(false);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition cursor-pointer flex items-center gap-2 border active:scale-95 ${
                  errorActionIndex === 2
                    ? 'bg-white text-neutral-950 border-white ring-4 ring-[#E50914] scale-105 shadow-2xl'
                    : 'bg-[#141414] hover:bg-neutral-800 text-white border-neutral-700'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar Recarregar</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  errorActionIndex === 3
                    ? 'bg-white text-neutral-950 border-white ring-4 ring-[#E50914] scale-105 shadow-2xl'
                    : 'bg-transparent hover:bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800'
                }`}
              >
                <span>Voltar</span>
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
