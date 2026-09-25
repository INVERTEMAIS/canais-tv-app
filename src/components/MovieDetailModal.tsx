import React, { useEffect, useState, useCallback } from 'react';
import {
  Play,
  Edit3,
  Trash2,
  X,
  Clock,
  Calendar,
  Film,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Tv
} from 'lucide-react';
import { MovieItem } from '../types/movies';
import { getSavedWatchProgress, saveWatchTime } from '../utils/moviesCatalogStorage';

interface MovieDetailModalProps {
  movie: MovieItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (movie: MovieItem) => void;
  onEdit: (movie: MovieItem) => void;
  onDelete: (movie: MovieItem) => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  movie,
  isOpen,
  onClose,
  onPlay,
  onEdit,
  onDelete,
}) => {
  // Foco do controle remoto dentro da tela escura: 0 = Assistir, 1 = Editar, 2 = Excluir, 3 = Fechar
  const [actionFocusIndex, setActionFocusIndex] = useState<number>(0);

  // Sempre que abrir um novo filme, reseta o foco para o botão Assistir
  useEffect(() => {
    if (isOpen) {
      setActionFocusIndex(0);
    }
  }, [isOpen, movie?.id]);

  // Captura teclas do controle remoto da TV e teclado
  useEffect(() => {
    if (!isOpen || !movie) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.keyCode || e.which;
      const key = e.key;

      if (key === 'Escape' || code === 27 || code === 4 || key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (key === 'ArrowLeft' || code === 37 || code === 21) {
        e.preventDefault();
        setActionFocusIndex((prev) => Math.max(0, prev - 1));
      } else if (key === 'ArrowRight' || code === 39 || code === 22) {
        e.preventDefault();
        setActionFocusIndex((prev) => Math.min(2, prev + 1));
      } else if (
        key === 'Enter' ||
        key === ' ' ||
        key === 'Select' ||
        key === 'Ok' ||
        code === 13 ||
        code === 23
      ) {
        e.preventDefault();
        if (actionFocusIndex === 0) {
          onPlay(movie);
        } else if (actionFocusIndex === 1) {
          onEdit(movie);
        } else if (actionFocusIndex === 2) {
          onDelete(movie);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, movie, actionFocusIndex, onClose, onPlay, onEdit, onDelete]);

  if (!isOpen || !movie) return null;

  const watchProgress = getSavedWatchProgress(movie.id);
  const hasProgress = watchProgress.time > 4;
  const progressPercent =
    watchProgress.duration && watchProgress.duration > 0
      ? Math.min(100, Math.max(5, (watchProgress.time / watchProgress.duration) * 100))
      : 30;

  const formatWatchTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      const remM = m % 60;
      return `${h}h ${remM < 10 ? '0' : ''}${remM}m`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleRestartFromBeginning = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveWatchTime(movie.id, 0, watchProgress.duration || 0);
    onPlay(movie);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200"
    >
      {/* Container Principal da Tela Escura Estilo Netflix */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#141414] text-white rounded-2xl sm:rounded-3xl border-2 border-neutral-800 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(229,9,20,0.3)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Efeito Luminoso de Fundo Netflix Vermelho */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#E50914]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar no Topo (X) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700/80 transition cursor-pointer active:scale-95 shadow-lg"
          title="Fechar (Voltar / ESC)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho Visual com Banner Sutil e Badges */}
        <div className="relative px-6 sm:px-8 pt-8 pb-4 border-b border-neutral-800/80 bg-gradient-to-b from-neutral-900 via-[#161616] to-[#141414]">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="bg-[#E50914] text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-md tracking-wider uppercase shadow-[0_0_10px_rgba(229,9,20,0.6)]">
              {movie.category}
            </span>
            {movie.year && (
              <span className="text-[11px] sm:text-xs text-neutral-300 font-bold bg-neutral-800/90 border border-neutral-700 px-2.5 py-0.5 rounded">
                {movie.year}
              </span>
            )}
            {movie.duration && (
              <span className="text-[11px] sm:text-xs text-neutral-400 font-medium">
                • {movie.duration}
              </span>
            )}
            <span className="text-[10px] sm:text-[11px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded ml-auto">
              FULL HD MP4
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight font-['Outfit'] drop-shadow-md pr-8 leading-tight">
            {movie.title}
          </h2>

          {/* Barra e Notificação de Progresso de Onde Parou */}
          {hasProgress && (
            <div className="mt-4 p-3 rounded-xl bg-neutral-900/90 border border-neutral-700/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#E50914] shrink-0" />
                <div>
                  <p className="text-xs font-extrabold text-white">
                    Continuar de {formatWatchTime(watchProgress.time)}
                  </p>
                  <p className="text-[10px] text-neutral-400">Progresso gravado automaticamente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestartFromBeginning}
                className="text-[10px] font-bold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg border border-neutral-600 transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reiniciar
              </button>
            </div>
          )}

          {hasProgress && (
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-[#E50914] shadow-[0_0_8px_#E50914]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Corpo: Sinopse Completa e Informações */}
        <div className="px-6 sm:px-8 py-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-1 font-['Outfit']">
              Sinopse do Filme
            </h4>
            <p className="text-neutral-200 font-normal leading-relaxed whitespace-pre-line">
              {movie.synopsis ||
                'Nenhuma sinopse cadastrada para este título. O filme pode ser reproduzido diretamente em alta definição nativa via streaming direto.'}
            </p>
          </div>

          <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="truncate max-w-xs sm:max-w-md font-mono text-neutral-500">
              Link: {movie.streamUrl.substring(0, 45)}...
            </span>
            <span className="shrink-0 text-[#E50914] font-bold">
              Áudio Nativo
            </span>
          </div>
        </div>

        {/* Rodapé com Botões de Ação Focáveis pelo Controle da TV */}
        <div className="px-5 sm:px-8 py-3.5 sm:py-4 border-t border-neutral-800 bg-[#101010] flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3">
          {/* Botão Assistir Principal */}
          <button
            type="button"
            onClick={() => onPlay(movie)}
            className={`w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 ${
              actionFocusIndex === 0
                ? 'bg-[#E50914] text-white ring-4 ring-white scale-105 shadow-[0_0_25px_rgba(229,9,20,0.9)]'
                : 'bg-[#E50914] hover:bg-[#b80710] text-white shadow-lg shadow-red-950/60'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{hasProgress ? 'Continuar Assistindo' : 'Assistir Agora'}</span>
          </button>

          {/* Botões Secundários: Editar e Excluir Centralizados no Mobile */}
          <div className="flex items-center justify-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onEdit(movie)}
              className={`flex-1 sm:flex-initial px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border ${
                actionFocusIndex === 1
                  ? 'bg-white text-neutral-950 border-white ring-4 ring-[#E50914] scale-105 shadow-xl'
                  : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
              }`}
            >
              <Edit3 className="w-4 h-4 text-[#E50914]" />
              <span>Editar</span>
            </button>

            <button
              type="button"
              onClick={() => onDelete(movie)}
              className={`flex-1 sm:flex-initial px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border ${
                actionFocusIndex === 2
                  ? 'bg-red-600 text-white border-red-600 ring-4 ring-white scale-105 shadow-xl'
                  : 'bg-neutral-800/90 hover:bg-red-950/60 text-neutral-300 hover:text-red-400 border-neutral-700 hover:border-red-600'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
