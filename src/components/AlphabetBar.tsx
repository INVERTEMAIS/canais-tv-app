import React, { useRef, useEffect } from 'react';
import { AlphabetFilter } from '../types';

interface AlphabetBarProps {
  currentLetter: AlphabetFilter;
  onSelectLetter: (letter: AlphabetFilter) => void;
  availableLetters: Set<string>;
  isFocused: boolean;
  focusedLetterIndex: number;
}

const LETTERS: AlphabetFilter[] = [
  'TODOS',
  '#',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

export const AlphabetBar: React.FC<AlphabetBarProps> = ({
  currentLetter,
  onSelectLetter,
  availableLetters,
  isFocused,
  focusedLetterIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the focused letter into view
  useEffect(() => {
    if (isFocused && containerRef.current) {
      const activeEl = containerRef.current.children[focusedLetterIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }
  }, [isFocused, focusedLetterIndex]);

  return (
    <div className="w-full bg-[#0a0e17]/80 backdrop-blur-sm border-b border-slate-800/60 py-2.5 px-6">
      <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-400 font-medium">
        <span className="text-cyan-400 font-bold uppercase tracking-wider text-[11px]">Navegação A-Z:</span>
        <span>Selecione a letra para filtrar ou use as setas para pular</span>
      </div>

      <div
        ref={containerRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 scroll-smooth"
      >
        {LETTERS.map((letter, idx) => {
          const isSelected = currentLetter === letter;
          const isRemoteFocused = isFocused && focusedLetterIndex === idx;
          const hasChannels = letter === 'TODOS' || availableLetters.has(letter);

          return (
            <button
              key={letter}
              id={`az-btn-${letter}`}
              type="button"
              onClick={() => onSelectLetter(letter)}
              disabled={!hasChannels}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                isRemoteFocused
                  ? 'bg-cyan-400 text-slate-950 ring-4 ring-cyan-300 scale-110 shadow-lg shadow-cyan-500/50 z-20'
                  : isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                  : hasChannels
                  ? 'bg-slate-900/80 text-slate-300 border border-slate-800/80 hover:bg-slate-800 hover:text-white'
                  : 'bg-slate-950/40 text-slate-600 border border-transparent opacity-40 cursor-not-allowed'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
};
