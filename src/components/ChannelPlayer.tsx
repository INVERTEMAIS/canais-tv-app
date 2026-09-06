import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RotateCw, Volume2, Maximize, AlertCircle, ChevronUp, ChevronDown, Radio, ShieldCheck, ShieldAlert, Smartphone, Sparkles } from 'lucide-react';
import { Channel, AdBlockMode } from '../types';
import { AndroidAdBlockModal } from './AndroidAdBlockModal';
import { getStoredPlayerMode, savePlayerMode, getSandboxAttribute } from '../utils/playerSecurity';

interface ChannelPlayerProps {
  channel: Channel;
  channels: Channel[];
  onClose: () => void;
  onNextChannel: () => void;
  onPrevChannel: () => void;
}

export const ChannelPlayer: React.FC<ChannelPlayerProps> = ({
  channel,
  channels,
  onClose,
  onNextChannel,
  onPrevChannel,
}) => {
  const [showOsd, setShowOsd] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<'fit' | 'fill' | '16-9'>('fit');
  const [currentTime, setCurrentTime] = useState('');
  const [adBlockMode, setAdBlockMode] = useState<AdBlockMode>(() => getStoredPlayerMode());
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [shieldNotice, setShieldNotice] = useState<string | null>(
    'Modo Anti-Bloqueio Direto Ativo (100% Compatível com RedeCanais)'
  );
  const osdTimerRef = useRef<number | null>(null);

  const resetOsdTimer = useCallback(() => {
    setShowOsd(true);
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
    }
    osdTimerRef.current = window.setTimeout(() => {
      setShowOsd(false);
    }, 5500);
  }, []);

  // Intercept any malicious pop-up from reaching browser tabs while inside player
  useEffect(() => {
    const originalOpen = window.open;
    // Override window.open to suppress unwanted ad popups
    window.open = function (url?: string | URL, target?: string, features?: string) {
      console.warn('[Canais TV - Anti-Ad Shield] Pop-up bloqueado automaticamente:', url);
      setShieldNotice('Pop-up ou tentativa de anúncio bloqueada com sucesso!');
      setTimeout(() => setShieldNotice(null), 3500);
      return null;
    };

    return () => {
      window.open = originalOpen;
    };
  }, []);

  useEffect(() => {
    resetOsdTimer();
    return () => {
      if (osdTimerRef.current) {
        window.clearTimeout(osdTimerRef.current);
      }
    };
  }, [channel.id, resetOsdTimer]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Remote key controls inside Player
  useEffect(() => {
    const handlePlayerKeys = (e: KeyboardEvent) => {
      const key = e.key;
      const keyCode = e.keyCode;

      // Reset OSD on any key
      resetOsdTimer();

      // Back / Escape: Exit player
      if (key === 'Escape' || keyCode === 4 || key === 'GoBack' || key === 'Backspace') {
        e.preventDefault();
        onClose();
        return;
      }

      // Up: Previous Channel
      if (key === 'ArrowUp' || keyCode === 19 || keyCode === 38) {
        e.preventDefault();
        onPrevChannel();
        return;
      }

      // Down: Next Channel
      if (key === 'ArrowDown' || keyCode === 20 || keyCode === 40) {
        e.preventDefault();
        onNextChannel();
        return;
      }

      // Enter / OK: Toggle OSD display
      if (key === 'Enter' || keyCode === 23 || keyCode === 13) {
        e.preventDefault();
        setShowOsd((prev) => !prev);
        return;
      }

      // R: Reload channel stream
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        setIframeKey((k) => k + 1);
        return;
      }

      // S: Toggle AdBlock / Shield mode
      if (key === 's' || key === 'S') {
        e.preventDefault();
        setAdBlockMode((prev) => (prev === 'strict' ? 'standard' : 'strict'));
        return;
      }
    };

    window.addEventListener('keydown', handlePlayerKeys);
    return () => {
      window.removeEventListener('keydown', handlePlayerKeys);
    };
  }, [onClose, onNextChannel, onPrevChannel, resetOsdTimer]);

  // Handle user mouse movement to reveal OSD
  const handleMouseMove = () => {
    resetOsdTimer();
  };

  const currentIndex = channels.findIndex((c) => c.id === channel.id);

  // Sandbox attributes calculation:
  // 'direct': sem sandbox (100% livre do detector anti-adblock do RedeCanais)
  // 'standard': sandbox com permissão a popups
  // 'strict': sandbox sem permissão a popups
  const sandboxDirectives = getSandboxAttribute(adBlockMode);

  const cycleAdBlockMode = () => {
    let next: AdBlockMode = 'direct';
    if (adBlockMode === 'direct') next = 'standard';
    else if (adBlockMode === 'standard') next = 'strict';
    else next = 'direct';

    setAdBlockMode(next);
    savePlayerMode(next);
    setIframeKey((k) => k + 1);

    const msg =
      next === 'direct'
        ? 'Modo Direto: Livre do bloqueio RedeCanais (Recomendado)'
        : next === 'standard'
        ? 'Modo Tolerante (Sandbox com Popups)'
        : 'Modo Estrito (Sandbox Sem Popups)';
    setShieldNotice(msg);
    setTimeout(() => setShieldNotice(null), 3500);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none"
    >
      {/* The Channel Embed Iframe Container with Anti-Ad Sandbox */}
      <div className="relative w-full h-full flex items-center justify-center bg-black">
        <iframe
          key={`${channel.id}-${iframeKey}-${adBlockMode}`}
          name="Player"
          title={channel.name}
          src={channel.streamUrl}
          sandbox={sandboxDirectives}
          frameBorder="0"
          scrolling="no"
          allow="encrypted-media; autoplay; fullscreen; picture-in-picture; accelerometer; gyroscope"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          className={`w-full h-full border-0 ${
            aspectRatio === 'fill'
              ? 'object-fill scale-105'
              : aspectRatio === '16-9'
              ? 'aspect-video max-h-full max-w-full'
              : 'w-full h-full'
          }`}
        />
      </div>

      {/* Pop-up / Shield Feedback Banner */}
      {shieldNotice && showOsd && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-slate-900/95 border border-cyan-500/50 text-cyan-300 text-xs font-semibold flex items-center gap-2 shadow-2xl backdrop-blur-md animate-fade-in">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{shieldNotice}</span>
        </div>
      )}

      {/* TOP OSD BAR (Fades in/out) */}
      <div
        className={`absolute top-0 inset-x-0 bg-gradient-to-b from-black/95 via-black/70 to-transparent p-5 transition-all duration-300 pointer-events-auto ${
          showOsd ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
          {/* Left: Back Button & Channel Info */}
          <div className="flex items-center gap-4">
            <button
              id="player-btn-back"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-900/90 text-white hover:bg-cyan-500 hover:text-slate-950 border border-slate-700/80 font-bold flex items-center gap-2 transition shadow-lg ring-2 ring-transparent focus:ring-cyan-400 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>VOLTAR AOS CANAIS</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-cyan-400 text-slate-950 font-black text-sm font-mono tracking-wider shadow">
                CH {String(channel.number).padStart(2, '0')}
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2 font-['Outfit']">
                  {channel.name}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider animate-pulse">
                    AO VIVO
                  </span>
                </h1>
                <p className="text-xs text-slate-300 font-medium">
                  {channel.category} • Posição {currentIndex + 1} de {channels.length}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Actions, Anti-Ad Shield & Clock */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Anti-Ad Protection Toggle */}
            <button
              type="button"
              onClick={cycleAdBlockMode}
              title="Clique para alternar: Modo Direto (Sem bloqueio RedeCanais), Tolerante ou Estrito"
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer ${
                adBlockMode === 'direct'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/80 hover:bg-emerald-900/80'
                  : adBlockMode === 'standard'
                  ? 'bg-amber-950/90 text-amber-300 border-amber-500/80 hover:bg-amber-900/80'
                  : 'bg-red-950/90 text-red-300 border-red-500/80 hover:bg-red-900/80'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {adBlockMode === 'direct'
                  ? 'Anti-Bloqueio: DIRETO'
                  : adBlockMode === 'standard'
                  ? 'Modo: TOLERANTE'
                  : 'Modo: ESTRITO'}
              </span>
            </button>

            {/* Android WebView Code Guide Button */}
            <button
              type="button"
              onClick={() => setShowAndroidModal(true)}
              title="Ver código Java / Kotlin para Android TV WebView"
              className="px-3 py-2 rounded-xl bg-slate-900/90 text-xs font-bold text-cyan-300 hover:text-white hover:bg-slate-800 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Código Android TV</span>
            </button>

            {/* Quick Channel Up/Down buttons for click/touch */}
            <div className="flex items-center bg-slate-900/90 rounded-xl border border-slate-700 p-0.5">
              <button
                type="button"
                onClick={onPrevChannel}
                title="Canal Anterior (▲)"
                className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNextChannel}
                title="Próximo Canal (▼)"
                className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Reload Stream Clean */}
            <button
              type="button"
              onClick={() => setIframeKey((k) => k + 1)}
              title="Recarregar Transmissão Limpa (R)"
              className="p-2 rounded-xl bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Aspect Ratio Switch */}
            <button
              type="button"
              onClick={() => {
                setAspectRatio((prev) => (prev === 'fit' ? 'fill' : prev === 'fill' ? '16-9' : 'fit'));
              }}
              title="Ajustar Proporção da Imagem"
              className="px-3 py-2 rounded-xl bg-slate-900/90 text-xs font-bold text-slate-300 hover:text-cyan-400 border border-slate-700 transition"
            >
              {aspectRatio.toUpperCase()}
            </button>

            {/* Clock */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-cyan-400 font-mono text-sm font-bold">
              {currentTime}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM OSD HINT BAR (Fades in/out) */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-5 transition-all duration-300 pointer-events-auto ${
          showOsd ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-300">
          {/* TV Remote Command Hints */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono font-bold">
                ▲ / ▼
              </span>
              <span>Trocar de Canal</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono font-bold">
                VOLTAR / ESC
              </span>
              <span>Lista de Canais</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono font-bold">
                OK
              </span>
              <span>Ocultar / Exibir Barra</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono font-bold">
                R
              </span>
              <span>Recarregar Vídeo</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono font-bold">
                S
              </span>
              <span>Modo Anti-Popups</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-300">
              Pop-ups e redirecionamentos bloqueados pelo Sandbox do player.
            </span>
          </div>
        </div>
      </div>

      {/* Android WebView Modal Guide */}
      <AndroidAdBlockModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
      />
    </div>
  );
};

