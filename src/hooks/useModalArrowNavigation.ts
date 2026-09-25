import { useEffect, useRef, type RefObject } from 'react';

interface UseModalArrowNavigationOptions {
  isOpen: boolean;
  onClose?: () => void;
  containerRef?: RefObject<HTMLElement | null>;
  defaultFocusIndex?: number;
  enableArrowNavigation?: boolean;
}

/**
 * Universal hook that makes any modal, form, or dialog 100% navigable with TV remote arrow keys.
 * Automatically focuses the first interactive element upon open.
 * ArrowUp / ArrowDown moves between all focusable inputs, selects, textareas, and buttons.
 * ArrowLeft / ArrowRight moves horizontally between adjacent buttons or tabs.
 * Escape / Back button closes the modal cleanly.
 */
export function useModalArrowNavigation({
  isOpen,
  onClose,
  containerRef,
  defaultFocusIndex = 0,
  enableArrowNavigation = true,
}: UseModalArrowNavigationOptions) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || !enableArrowNavigation) return;

    const getFocusableElements = (): HTMLElement[] => {
      const container = containerRef?.current || document.body;
      const selector = [
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        'a[href]',
      ].join(', ');

      const elements: HTMLElement[] = Array.from(container.querySelectorAll(selector));
      // Filter out elements that are invisible (display: none or offsetParent === null)
      return elements.filter((el: HTMLElement) => {
        return (
          el.offsetParent !== null &&
          window.getComputedStyle(el).visibility !== 'hidden' &&
          window.getComputedStyle(el).display !== 'none'
        );
      });
    };

    // Auto-focus on open
    const timer = setTimeout(() => {
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        const target = focusables[Math.min(defaultFocusIndex, focusables.length - 1)];
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const keyCode = e.keyCode;

      // Handle Back / Escape
      if (key === 'Escape' || keyCode === 4 || key === 'GoBack' || key === 'BrowserBack') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      const focusables = getFocusableElements();
      if (focusables.length === 0) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const currentIndex = activeEl ? focusables.indexOf(activeEl) : -1;

      // Handle Vertical Movement (ArrowUp / ArrowDown)
      if (key === 'ArrowDown' || keyCode === 20 || keyCode === 40) {
        // If in textarea and user is not at last line, allow natural text movement unless Alt/Ctrl or TV Dpad
        if (activeEl?.tagName === 'TEXTAREA') {
          const ta = activeEl as HTMLTextAreaElement;
          const isAtEnd = ta.selectionEnd === ta.value.length;
          if (!isAtEnd && ta.value.includes('\n')) {
            // Still lines below, let cursor move
            return;
          }
        }

        e.preventDefault();
        e.stopPropagation();
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusables.length;
        const nextEl = focusables[nextIndex];
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (key === 'ArrowUp' || keyCode === 19 || keyCode === 38) {
        if (activeEl?.tagName === 'TEXTAREA') {
          const ta = activeEl as HTMLTextAreaElement;
          const isAtStart = ta.selectionStart === 0;
          if (!isAtStart && ta.value.includes('\n')) {
            return;
          }
        }

        e.preventDefault();
        e.stopPropagation();
        const prevIndex =
          currentIndex < 0
            ? focusables.length - 1
            : (currentIndex - 1 + focusables.length) % focusables.length;
        const prevEl = focusables[prevIndex];
        prevEl.focus();
        prevEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Handle Horizontal Movement (ArrowLeft / ArrowRight)
      // When focused on buttons, tabs, or checkboxes, left/right navigates between them
      else if (
        (key === 'ArrowLeft' || keyCode === 21 || keyCode === 37) &&
        activeEl?.tagName !== 'INPUT' &&
        activeEl?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        e.stopPropagation();
        const prevIndex =
          currentIndex < 0
            ? focusables.length - 1
            : (currentIndex - 1 + focusables.length) % focusables.length;
        const prevEl = focusables[prevIndex];
        prevEl.focus();
        prevEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (
        (key === 'ArrowRight' || keyCode === 22 || keyCode === 39) &&
        activeEl?.tagName !== 'INPUT' &&
        activeEl?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        e.stopPropagation();
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusables.length;
        const nextEl = focusables[nextIndex];
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, defaultFocusIndex, enableArrowNavigation, containerRef]);
}
