import React, { useState, useEffect } from 'react';
import { Tv, Settings, MonitorPlay, Maximize, Minimize, Gamepad2, Radio, ShieldCheck } from 'lucide-react';
import { AppView, RemoteKeyFeedback } from '../types';

interface TvHeaderProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  activeTabFocus: boolean;
  channelCount: number;
  lastFeedback: RemoteKeyFeedback | null;
  onToggleRemoteSimulator: () => void;
  isSimulatorOpen: boolean;
  onOpenAdBlockGuide?: () => void;
}

export const TvHeader: React.FC<TvHeaderProps> = ({
  currentView,
  onViewChange,
  activeTabFocus,
  channelCount,
  lastFeedback,
  onToggleRemoteSimulator,
  isSimulatorOpen,
  onOpenAdBlockGuide,
}) => {
  const [time, setTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="w-full bg-[#0b0f17]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between z-40 shrink-0">
      {/* Brand & Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white font-['Outfit']">
                CANAIS<span className="text-cyan-400">TV</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 tracking-wider">
                TV PLAY
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{channelCount} canais cadastrados</span>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <nav className="flex items-center gap-2 ml-6 bg-slate-900/90 p-1 rounded-xl border border-slate-800/90">
          <button
            id="tab-btn-channels"
            type="button"
            onClick={() => onViewChange('channels')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentView === 'channels'
                ? activeTabFocus
                  ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-300 shadow-lg shadow-cyan-500/40 scale-105'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MonitorPlay className="w-4 h-4" />
            <span>Ver Canais</span>
          </button>

          <button
            id="tab-btn-config"
            type="button"
            onClick={() => onViewChange('config')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentView === 'config'
                ? activeTabFocus
                  ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-300 shadow-lg shadow-cyan-500/40 scale-105'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurar Canais</span>
          </button>
        </nav>
      </div>

      {/* Right Controls: Remote signal hint, Live clock, Simulator & Fullscreen */}
      <div className="flex items-center gap-4">
        {/* Remote Feedback Signal Indicator */}
        {lastFeedback && Date.now() - lastFeedback.timestamp < 1500 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold animate-pulse">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>{lastFeedback.key}</span>
          </div>
        )}

        {/* Anti-Ads Strategy & Guide button */}
        {onOpenAdBlockGuide && (
          <button
            type="button"
            onClick={onOpenAdBlockGuide}
            title="Estratégia Anti-Anúncios & Guia Android TV (WebView)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/80 text-xs font-semibold transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Anti-Anúncios</span>
          </button>
        )}

        {/* Remote Simulator Toggle */}
        <button
          type="button"
          onClick={onToggleRemoteSimulator}
          title="Abrir controle remoto virtual na tela para testar"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            isSimulatorOpen
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Gamepad2 className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Controle Virtual</span>
        </button>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="Alternar Tela Cheia"
          className="p-2 rounded-lg bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Live Clock for TV */}
        <div className="px-3.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-cyan-400 font-mono text-base font-bold tracking-wider shadow-inner">
          {time || '--:--'}
        </div>
      </div>
    </header>
  );
};
