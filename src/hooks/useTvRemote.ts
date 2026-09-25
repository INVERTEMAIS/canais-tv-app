import { useEffect, useCallback, useState, useRef } from 'react';
import { RemoteKeyFeedback } from '../types';

interface TvRemoteOptions {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onBack?: () => void;
  onNumber?: (num: number) => void;
  onMenu?: () => void;
  enabled?: boolean;
}

// Subtle Web Audio click effect for TV remote feedback
class TvAudioFeedback {
  private ctx: AudioContext | null = null;

  playClick() {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.ctx) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      }
    } catch {
      // Audio might be blocked until user interaction
    }
  }

  playSelect() {
    try {
      if (this.ctx) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.09);
      }
    } catch {
      // Ignore audio error
    }
  }
}

export const tvAudio = new TvAudioFeedback();

export function useTvRemote(options: TvRemoteOptions) {
  const [lastFeedback, setLastFeedback] = useState<RemoteKeyFeedback | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const triggerFeedback = useCallback((keyName: string) => {
    setLastFeedback({ key: keyName, timestamp: Date.now() });
  }, []);

  useEffect(() => {
    if (options.enabled === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is currently typing in an input or textarea, don't hijack unless it's Escape/Back
      const target = e.target as HTMLElement | null;
      const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const key = e.key;
      const keyCode = e.keyCode;

      // Handle Back Button (Android TV Back keyCode = 4, or Escape / Backspace when not in input)
      if (key === 'Escape' || keyCode === 4 || key === 'GoBack' || key === 'BrowserBack' || (key === 'Backspace' && !isInputFocused)) {
        e.preventDefault();
        triggerFeedback('VOLTAR');
        tvAudio.playClick();
        optionsRef.current.onBack?.();
        return;
      }

      // If user is in an input or textarea, let text editing work, but allow ArrowUp / ArrowDown to move focus
      if (isInputFocused) {
        if (key === 'Enter') {
          optionsRef.current.onEnter?.();
          return;
        }
        if (key === 'ArrowDown' || keyCode === 20 || keyCode === 40) {
          e.preventDefault();
          target.blur();
          triggerFeedback('▼ BAIXO');
          tvAudio.playClick();
          optionsRef.current.onDown?.();
          return;
        }
        if (key === 'ArrowUp' || keyCode === 19 || keyCode === 38) {
          e.preventDefault();
          target.blur();
          triggerFeedback('▲ CIMA');
          tvAudio.playClick();
          optionsRef.current.onUp?.();
          return;
        }
        // Left and Right inside input move the cursor naturally
        return;
      }

      // Navigation Keys
      // Android TV DPAD_UP (19) / ArrowUp
      if (key === 'ArrowUp' || keyCode === 19 || keyCode === 38) {
        e.preventDefault();
        triggerFeedback('▲ CIMA');
        tvAudio.playClick();
        optionsRef.current.onUp?.();
      }
      // Android TV DPAD_DOWN (20) / ArrowDown
      else if (key === 'ArrowDown' || keyCode === 20 || keyCode === 40) {
        e.preventDefault();
        triggerFeedback('▼ BAIXO');
        tvAudio.playClick();
        optionsRef.current.onDown?.();
      }
      // Android TV DPAD_LEFT (21) / ArrowLeft
      else if (key === 'ArrowLeft' || keyCode === 21 || keyCode === 37) {
        e.preventDefault();
        triggerFeedback('◄ ESQUERDA');
        tvAudio.playClick();
        optionsRef.current.onLeft?.();
      }
      // Android TV DPAD_RIGHT (22) / ArrowRight
      else if (key === 'ArrowRight' || keyCode === 22 || keyCode === 39) {
        e.preventDefault();
        triggerFeedback('► DIREITA');
        tvAudio.playClick();
        optionsRef.current.onRight?.();
      }
      // Android TV DPAD_CENTER (23) / Enter / Space
      else if (key === 'Enter' || key === ' ' || keyCode === 23 || keyCode === 13) {
        e.preventDefault();
        triggerFeedback('OK / SELECIONAR');
        tvAudio.playSelect();
        optionsRef.current.onEnter?.();
      }
      // Menu key (TV Menu keyCode 82 / 'm' / 'M')
      else if (key === 'm' || key === 'M' || keyCode === 82) {
        e.preventDefault();
        triggerFeedback('MENU');
        tvAudio.playClick();
        optionsRef.current.onMenu?.();
      }
      // Number keys 0-9
      else if (/^[0-9]$/.test(key)) {
        triggerFeedback(`CANAL ${key}`);
        tvAudio.playClick();
        optionsRef.current.onNumber?.(parseInt(key, 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [options.enabled, triggerFeedback]);

  return { lastFeedback, triggerFeedback };
}
