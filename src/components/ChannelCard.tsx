import React, { useRef, useEffect } from 'react';
import { Play, Star, Radio, Tv } from 'lucide-react';
import { Channel } from '../types';

interface ChannelCardProps {
  channel: Channel;
  index: number;
  isFocused: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  index,
  isFocused,
  onSelect,
  onToggleFavorite,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll into view smoothly when focused by TV remote
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [isFocused]);

  return (
    <div
      ref={cardRef}
      id={`channel-card-${channel.id}`}
      onClick={() => onSelect(channel)}
      className={`group relative rounded-xl p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none border ${
        isFocused
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-[#0e1f38] border-cyan-400 ring-4 ring-cyan-400/80 scale-[1.02] shadow-2xl shadow-cyan-500/25 z-20'
          : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top row: Channel number, Category, Live indicator, Favorite */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          {/* Channel number badge */}
          <span
            className={`px-2.5 py-1 rounded-lg font-mono text-xs font-black tracking-wider transition-colors ${
              isFocused
                ? 'bg-cyan-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-cyan-300 border border-slate-700/80'
            }`}
          >
            CH {String(channel.number).padStart(2, '0')}
          </span>

          {/* Category tag */}
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
            {channel.category || 'Geral'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Live indicator dot */}
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>AO VIVO</span>
          </span>

          {/* Favorite button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => onToggleFavorite(channel.id, e)}
              title={channel.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              className="p-1 rounded-lg text-slate-400 hover:text-amber-400 transition"
            >
              <Star
                className={`w-4 h-4 ${
                  channel.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Main Channel Identity */}
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Tv className={`w-4 h-4 shrink-0 ${isFocused ? 'text-cyan-400' : 'text-slate-500'}`} />
            <h3
              className={`text-base font-bold truncate tracking-tight transition-colors ${
                isFocused ? 'text-cyan-300' : 'text-white'
              }`}
            >
              {channel.name}
            </h3>
          </div>
          {channel.description && (
            <p className="text-xs text-slate-400 truncate mt-1">
              {channel.description}
            </p>
          )}
        </div>

        {/* Play Icon Action Indicator */}
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            isFocused
              ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/40 scale-105'
              : 'bg-slate-800/80 text-slate-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300'
          }`}
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* TV Remote Focus Hint */}
      {isFocused && (
        <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[11px] font-bold text-cyan-300 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-cyan-400 text-slate-950 text-[10px] font-black">
              OK
            </span>
            <span>ASSISTIR CANAL</span>
          </span>
          <span className="text-slate-400 text-[10px]">#{index + 1}</span>
        </div>
      )}
    </div>
  );
};

