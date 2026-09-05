import React, { useState, useEffect } from 'react';
import { Tv, Film, Settings, Maximize, Minimize, Smartphone } from 'lucide-react';
import { AppView } from '../types';

interface DarkAppHeaderProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onOpenSettings: () => void;
  onOpenAndroidGuide?: () => void;
  channelCount: number;
}

export const DarkAppHeader: React.FC<DarkAppHeaderProps> = ({
  currentView,
  onViewChange,
  onOpenSettings,
  onOpenAndroidGuide,
  channelCount,
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
    <header className="w-full bg-[#000000] border-b border-[#181818] px-4 md:px-6 py-2.5 flex items-center justify-between z-40 shrink-0 select-none">
      {/* Left: Brand & Direct View Switcher */}
      <div className="flex items-center gap-4 md:gap-6">
        <div className="flex items-center gap-2">
          <span className="text-base md:text-lg font-black tracking-tight text-white uppercase font-['Outfit']">
            Canais<span className="text-neutral-400">TV</span>
          </span>
        </div>

        {/* View Switcher: Canais vs Filmes / Vídeos */}
        <nav className="flex items-center bg-[#0d0d0d] p-1 rounded-xl border border-[#222]">
          <button
            type="button"
            id="nav-btn-canais"
            onClick={() => onViewChange('channels')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentView === 'channels'
                ? 'bg-white text-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Canais Ao Vivo</span>
          </button>

          <button
            type="button"
            id="nav-btn-filmes"
            onClick={() => onViewChange('movies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentView === 'movies'
                ? 'bg-white text-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Filmes & Vídeos (On Demand)</span>
          </button>
        </nav>
      </div>

      {/* Right: Fullscreen, Live Clock & Settings Icon ONLY */}
      <div className="flex items-center gap-3">
        {/* TV Clock */}
        <div className="text-neutral-400 font-mono text-xs font-bold hidden sm:block">
          {time || '--:--'}
        </div>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="Alternar Tela Cheia"
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition cursor-pointer"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Android Guide Button */}
        {onOpenAndroidGuide && (
          <button
            type="button"
            id="btn-header-android-guide"
            onClick={onOpenAndroidGuide}
            title="Guia Android Studio & Capacitor (TV + Celular)"
            className="px-2.5 py-1.5 rounded-xl text-neutral-300 hover:text-cyan-300 hover:bg-neutral-900 border border-neutral-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline text-[11px]">App Android</span>
          </button>
        )}

        {/* ONLY Settings Icon in header as requested */}
        <button
          type="button"
          id="btn-header-settings"
          onClick={onOpenSettings}
          title="Abrir Configurações e Instruções de Navegação"
          className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition cursor-pointer"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
