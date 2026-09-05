import React, { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Star, Tv, Plus } from 'lucide-react';
import { Channel } from '../types';

interface NetflixChannelRowProps {
  title: string;
  icon?: React.ReactNode;
  channels: Channel[];
  rowIndex: number;
  isRowFocused: boolean;
  focusedCardIndex: number;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  onAddChannelClick?: () => void;
  onFocusCard?: (rowIndex: number, cardIndex: number) => void;
}

export const NetflixChannelRow: React.FC<NetflixChannelRowProps> = ({
  title,
  icon,
  channels,
  rowIndex,
  isRowFocused,
  focusedCardIndex,
  onSelectChannel,
  onToggleFavorite,
  onAddChannelClick,
  onFocusCard,
}) => {
  const rowContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Smooth scroll when card within this row receives remote focus
  useEffect(() => {
    if (isRowFocused && cardRefs.current[focusedCardIndex]) {
      const cardEl = cardRefs.current[focusedCardIndex];
      if (cardEl && rowContainerRef.current) {
        const container = rowContainerRef.current;
        const cardLeft = cardEl.offsetLeft;
        const cardWidth = cardEl.offsetWidth;
        const containerWidth = container.offsetWidth;

        // Center or smoothly bring card into view
        const targetScroll = cardLeft - (containerWidth / 2) + (cardWidth / 2);
        container.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }
    }
  }, [isRowFocused, focusedCardIndex]);

  const scrollLeft = () => {
    if (rowContainerRef.current) {
      rowContainerRef.current.scrollBy({ left: -450, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (rowContainerRef.current) {
      rowContainerRef.current.scrollBy({ left: 450, behavior: 'smooth' });
    }
  };

  if (channels.length === 0 && !onAddChannelClick) {
    return null;
  }

  return (
    <div className="space-y-2 py-1 select-none group/row">
      {/* Row Header */}
      <div className="flex items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-cyan-400">{icon}</span>}
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight font-['Outfit'] flex items-center gap-2">
            <span>{title}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-cyan-300 border border-slate-700/60 font-mono">
              {channels.length}
            </span>
          </h3>
        </div>

        {/* Desktop / Pointer scroll arrows */}
        <div className="hidden md:flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={scrollLeft}
            title="Rolar para esquerda"
            className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700/60"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={scrollRight}
            title="Rolar para direita"
            className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700/60"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Swipable Netflix Row Container */}
      {/* touch-pan-x and scrollbar-none allow smooth finger swiping on touch devices */}
      <div className="relative">
        <div
          ref={rowContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-none px-6 py-3 scroll-smooth touch-pan-x snap-x snap-mandatory"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {channels.map((channel, cardIdx) => {
            const isCardFocused = isRowFocused && focusedCardIndex === cardIdx;

            return (
              <div
                key={channel.id}
                ref={(el) => { cardRefs.current[cardIdx] = el; }}
                id={`netflix-card-${rowIndex}-${cardIdx}`}
                onClick={() => onSelectChannel(channel)}
                onMouseEnter={() => onFocusCard && onFocusCard(rowIndex, cardIdx)}
                className={`snap-start shrink-0 w-[270px] sm:w-[310px] md:w-[340px] rounded-2xl p-4 transition-all duration-200 cursor-pointer relative border flex flex-col justify-between ${
                  isCardFocused
                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-[#0c2340] border-cyan-400 ring-4 ring-cyan-400/80 scale-[1.04] shadow-2xl shadow-cyan-500/30 z-30'
                    : 'bg-slate-900/85 hover:bg-slate-900 border-slate-800/90 hover:border-slate-700/80 hover:scale-[1.02]'
                }`}
              >
                {/* Card Top: Number, Category, Live, Favorite */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs font-black tracking-wider transition-colors ${
                        isCardFocused
                          ? 'bg-cyan-400 text-slate-950 font-extrabold shadow-sm'
                          : 'bg-slate-800 text-cyan-300 border border-slate-700/80'
                      }`}
                    >
                      CH {String(channel.number).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
                      {channel.category || 'Geral'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>AO VIVO</span>
                    </span>

                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => onToggleFavorite(channel.id, e)}
                        title={channel.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-400 transition"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            channel.isFavorite
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Body: Name and Info */}
                <div className="space-y-1.5 py-1">
                  <div className="flex items-center gap-2">
                    <Tv className={`w-4 h-4 shrink-0 ${isCardFocused ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <h4
                      className={`text-base font-bold truncate tracking-tight transition-colors ${
                        isCardFocused ? 'text-cyan-300' : 'text-white'
                      }`}
                    >
                      {channel.name}
                    </h4>
                  </div>
                  {channel.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {channel.description}
                    </p>
                  )}
                </div>

                {/* Card Bottom: Play & Remote Hint */}
                <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isCardFocused
                          ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/40'
                          : 'bg-cyan-500/10 text-cyan-400'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                    <span
                      className={`text-xs font-bold transition-colors ${
                        isCardFocused ? 'text-cyan-300' : 'text-slate-300'
                      }`}
                    >
                      {isCardFocused ? 'Assistir no Player' : 'Clique para Assistir'}
                    </span>
                  </div>

                  {isCardFocused && (
                    <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 text-[10px] font-black font-mono">
                      OK / ENTER
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Quick Add Channel Card at the end of the row */}
          {onAddChannelClick && (
            <div
              onClick={onAddChannelClick}
              className="snap-start shrink-0 w-[180px] sm:w-[200px] rounded-2xl p-4 border border-dashed border-slate-700/80 hover:border-cyan-400/60 bg-slate-900/40 hover:bg-slate-900/80 transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-300 group-hover:text-cyan-300">
                Cadastrar Novo Canal
              </span>
              <span className="text-[10px] text-slate-500">
                Adicione seu iframe ou URL
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
