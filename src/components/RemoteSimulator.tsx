import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Menu,
  X,
  Radio,
  Gamepad2,
  Volume2,
  Tv
} from 'lucide-react';
import { tvAudio } from '../hooks/useTvRemote';

interface RemoteSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSendKey: (key: string) => void;
}

export const RemoteSimulator: React.FC<RemoteSimulatorProps> = ({
  isOpen,
  onClose,
  onSendKey,
}) => {
  if (!isOpen) return null;

  const trigger = (actionName: string, eventKey: string, keyCode: number) => {
    tvAudio.playClick();
    onSendKey(actionName);
    // Dispatch real KeyboardEvent to test global listener
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: eventKey,
        code: eventKey,
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
      })
    );
  };

  return (
    <aside aria-label="Controle Remoto Virtual" className="fixed bottom-6 right-6 z-50 bg-[#0c121d]/95 backdrop-blur-xl border border-cyan-500/40 rounded-3xl p-5 shadow-2xl shadow-cyan-950/80 w-64 select-none animate-in fade-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            Controle Android TV
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* D-PAD DIRECTIONAL CLUSTER */}
      <div className="flex flex-col items-center justify-center my-3">
        {/* UP BUTTON */}
        <button
          type="button"
          onClick={() => trigger('▲ CIMA', 'ArrowUp', 38)}
          title="Seta para Cima (ArrowUp)"
          className="w-12 h-10 rounded-t-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center transition active:scale-95 shadow"
        >
          <ChevronUp className="w-6 h-6" />
        </button>

        {/* MIDDLE ROW: LEFT, OK, RIGHT */}
        <div className="flex items-center gap-1.5 my-1.5">
          <button
            type="button"
            onClick={() => trigger('◄ ESQUERDA', 'ArrowLeft', 37)}
            title="Seta Esquerda (ArrowLeft)"
            className="w-10 h-12 rounded-l-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center transition active:scale-95 shadow"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* OK / CENTER SELECT */}
          <button
            type="button"
            onClick={() => trigger('OK', 'Enter', 13)}
            title="Botão OK / Selecionar (Enter)"
            className="w-14 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-xs font-mono flex items-center justify-center shadow-lg shadow-cyan-500/40 transition active:scale-90"
          >
            OK
          </button>

          <button
            type="button"
            onClick={() => trigger('► DIREITA', 'ArrowRight', 39)}
            title="Seta Direita (ArrowRight)"
            className="w-10 h-12 rounded-r-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center transition active:scale-95 shadow"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* DOWN BUTTON */}
        <button
          type="button"
          onClick={() => trigger('▼ BAIXO', 'ArrowDown', 40)}
          title="Seta para Baixo (ArrowDown)"
          className="w-12 h-10 rounded-b-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 border border-slate-700 flex items-center justify-center transition active:scale-95 shadow"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>

      {/* AUXILIARY BUTTONS (BACK, MENU, RELOAD) */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => trigger('VOLTAR', 'Escape', 27)}
          title="Botão Voltar do Controle (Escape / Back)"
          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border border-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
          <span>VOLTAR</span>
        </button>

        <button
          type="button"
          onClick={() => trigger('MENU', 'm', 77)}
          title="Alternar Telas (M)"
          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border border-slate-700"
        >
          <Menu className="w-3.5 h-3.5 text-cyan-400" />
          <span>MENU</span>
        </button>
      </div>

      {/* NUMERIC TV KEYS FOR CHANNEL DIRECT TUNING */}
      <div className="mt-3 pt-3 border-t border-slate-800">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
          Teclado Numérico de Canais
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => trigger(`CH ${num}`, String(num), 48 + num)}
              className="py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 font-mono text-xs font-bold border border-slate-800/80 transition"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => trigger('CH 0', '0', 48)}
            className="col-span-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 font-mono text-xs font-bold border border-slate-800/80 transition"
          >
            0
          </button>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-center text-slate-500 font-mono">
        Controle físico do Android TV ou teclado (Setas, Enter, Esc) suportados.
      </div>
    </aside>
  );
};
