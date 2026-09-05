import React from 'react';
import { Tv } from 'lucide-react';

interface ChannelLogoBadgeProps {
  name: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const ChannelLogoBadge: React.FC<ChannelLogoBadgeProps> = ({
  name,
  logoUrl,
  size = 'md',
}) => {
  const lower = name.toLowerCase();

  // Dimensões
  const sizeClasses = {
    sm: 'h-8 w-14 text-xs',
    md: 'h-10 w-20 text-sm',
    lg: 'h-14 w-28 text-base',
    hero: 'h-40 w-80 text-4xl',
  }[size];

  // Se o usuário cadastrou uma imagem direta (logoUrl), exibe a imagem
  if (logoUrl && logoUrl.trim()) {
    return (
      <div className={`flex items-center justify-center overflow-hidden rounded bg-black border border-neutral-800 ${sizeClasses}`}>
        <img
          src={logoUrl}
          alt={name}
          className="max-h-full max-w-full object-contain"
          onError={(e) => {
            // Em caso de erro ao carregar logo externo, exibe fallback textual
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Se for canal CAZÉ TV
  if (lower.includes('cazé') || lower.includes('caze')) {
    const numMatch = name.match(/\d+/);
    const num = numMatch ? numMatch[0] : '1';

    return (
      <div
        className={`flex items-center justify-center gap-1 bg-black text-white font-black select-none border border-neutral-800 rounded px-1.5 ${sizeClasses}`}
      >
        {/* Ícone Caricatura / Fone Cazé */}
        <div className="relative flex items-center justify-center shrink-0">
          <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 font-black text-[9px] border border-white">
            <span className="scale-75">👓</span>
          </div>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[9px] md:text-[10px] tracking-tight font-extrabold text-neutral-200">
            Cazé
          </span>
          <div className="flex items-center gap-0.5">
            <span className="text-xs md:text-sm font-black tracking-tighter text-white">TV</span>
            <span className="text-xs md:text-sm font-black text-white">{num}</span>
          </div>
        </div>
      </div>
    );
  }

  // Se for canal DAZN
  if (lower.includes('dazn')) {
    const numMatch = name.match(/\d+/);
    const num = numMatch ? numMatch[0] : '1';

    return (
      <div
        className={`flex items-center justify-center gap-1.5 bg-black text-white font-bold select-none border border-neutral-700 rounded px-2 ${sizeClasses}`}
      >
        <div className="flex flex-col text-[8px] md:text-[9px] font-black leading-none border-r border-neutral-700 pr-1 tracking-tighter">
          <span>DA</span>
          <span>ZN</span>
        </div>
        <span className="text-sm md:text-base font-black text-white">{num}</span>
      </div>
    );
  }

  // Fallback padrão: Cartão preto com nome ou ícone de TV
  return (
    <div
      className={`flex items-center justify-center gap-1 bg-[#111] text-white font-bold border border-neutral-800 rounded px-2 ${sizeClasses}`}
    >
      <Tv className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      <span className="truncate text-[10px] md:text-xs tracking-tight font-extrabold text-neutral-300">
        {name}
      </span>
    </div>
  );
};
