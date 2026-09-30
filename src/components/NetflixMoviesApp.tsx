import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Plus,
  Search,
  Film,
  Trash2,
  Clock,
  Info,
  Edit3,
  Tv,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Flame,
  Star,
  ChevronLeft,
  FileSpreadsheet,
  HelpCircle,
  Download,
  AlertTriangle,
  X,
  Activity,
  Folder,
  QrCode,
  Smartphone,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { MovieItem, MovieCategory } from '../types/movies';
import {
  loadMoviesCatalog,
  saveMoviesCatalog,
  getSavedWatchTime,
  getSavedWatchProgress,
  NETFLIX_PALETTES,
  determineHeroMovie,
  recordMoviePlay,
  getAllMovieStats,
  unwrapStreamUrl,
  extractTokenExpiration,
} from '../utils/moviesCatalogStorage';
import { NativeMoviePlayer } from './NativeMoviePlayer';
import { AddMovieModal } from './AddMovieModal';
import { BatchImportModal } from './BatchImportModal';
import { DeviceGuideModal } from './DeviceGuideModal';
import { MovieDetailModal } from './MovieDetailModal';
import { LinkDiagnosticsModal } from './LinkDiagnosticsModal';
import { QrPairingModal } from './QrPairingModal';

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

const CATEGORIES: MovieCategory[] = [
  'TODOS',
  'Ação',
  'Ficção & Fantasia',
  'Comédia',
  'Drama',
  'Terror & Suspense',
  'Animação',
  'Documentário',
];

export const NetflixMoviesApp: React.FC = () => {
  const [movies, setMovies] = useState<MovieItem[]>(() => loadMoviesCatalog());
  const [selectedCategory, setSelectedCategory] = useState<MovieCategory>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePlayingMovie, setActivePlayingMovie] = useState<MovieItem | null>(null);
  const [selectedDetailMovie, setSelectedDetailMovie] = useState<MovieItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [editingMovie, setEditingMovie] = useState<MovieItem | null>(null);

  // Notificação toast flutuante na tela da TV
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Paginação inteligente: limite inicial de 10 filmes com botão "Ver Mais"
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Navegação Universal por Controle Remoto (D-PAD) com 5 Zonas Físicas Ordenadas
  // header -> hero -> categories -> grid -> loadMore
  const [activeZone, setActiveZone] = useState<'header' | 'hero' | 'categories' | 'grid' | 'loadMore'>('grid');
  // 0: Logo, 1: Busca, 2: QR Conectar Celular, 3: Adicionar Filme, 4: Lote, 5: Links, 6: Guia
  const [headerIndex, setHeaderIndex] = useState<number>(0);
  const [heroActionIndex, setHeroActionIndex] = useState<0 | 1>(0); // 0: Assistir Agora, 1: Mais Detalhes
  const [categoryIndex, setCategoryIndex] = useState<number>(0);
  const [focusedMovieIndex, setFocusedMovieIndex] = useState<number>(0);

  // Modal de Exclusão com confirmação acessível pelo controle remoto
  const [movieToDelete, setMovieToDelete] = useState<MovieItem | null>(null);
  const [deleteConfirmFocus, setDeleteConfirmFocus] = useState<'cancel' | 'confirm'>('cancel');

  // Notificação de duplo toque no Voltar para sair
  const [backPressToast, setBackPressToast] = useState<boolean>(false);
  const lastBackPressTimeRef = useRef<number>(0);

  const categoriesBarRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Versão de atualização das estatísticas para recalcular o destaque automaticamente
  const [statsVersion, setStatsVersion] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Inicia a reprodução de um filme, contabilizando contagem e atualizando o destaque
  const handlePlayMovie = useCallback((movie: MovieItem | null) => {
    if (!movie) return;
    recordMoviePlay(movie.id);
    setStatsVersion((v) => v + 1);
    setActivePlayingMovie(movie);
  }, []);

  // O filme em destaque hero principal (determinado automaticamente pelo mais assistido)
  const heroMovie = useMemo(() => {
    return determineHeroMovie(movies);
  }, [movies, statsVersion]);

  // Identifica se o destaque atual é por ser o mais assistido
  const isHeroMostWatched = useMemo(() => {
    if (!heroMovie) return false;
    const stats = getAllMovieStats();
    return (stats[heroMovie.id]?.playCount || 0) > 0;
  }, [heroMovie, statsVersion]);

  // Adição de novo filme (local ou recebido via QR Code do celular)
  const handleMovieAddedFromRemote = useCallback((newMovie: MovieItem) => {
    setMovies((prev) => {
      // Evita duplicatas pelo ID ou título
      const filtered = prev.filter((m) => m.id !== newMovie.id && m.title.toLowerCase() !== newMovie.title.toLowerCase());
      const updated = [newMovie, ...filtered];
      saveMoviesCatalog(updated);
      return updated;
    });
    showToast(`🎬 Novo filme adicionado: "${newMovie.title}"`);
  }, []);

  // Polling em segundo plano para Smart TV receber filmes do celular mesmo com o modal de QR fechado
  useEffect(() => {
    const checkRemoteMovies = async () => {
      try {
        const token = localStorage.getItem('netplay_active_tv_token');
        if (!token) return;
        const res = await fetch(`/api/pareamento/consumir/${token}`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.movies && data.movies.length > 0) {
            data.movies.forEach((m: any) => {
              const formatted: MovieItem = {
                id: m.id || `movie-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                title: m.title,
                streamUrl: m.streamUrl,
                sourcePageUrl: m.sourcePageUrl,
                category: m.category || 'Ação',
                year: m.year || new Date().getFullYear(),
                synopsis: m.synopsis || '',
                duration: m.duration || '2h 00m',
                rating: m.rating || '14',
                posterUrl: m.posterUrl || undefined,
                createdAt: m.addedAt || Date.now(),
              };
              handleMovieAddedFromRemote(formatted);
            });
          }
        }
      } catch {}
    };

    const interval = setInterval(checkRemoteMovies, 3000);
    return () => clearInterval(interval);
  }, [handleMovieAddedFromRemote]);

  // Lista filtrada por Categoria e Busca
  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      const matchCategory =
        selectedCategory === 'TODOS' ||
        movie.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movie.synopsis?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [movies, selectedCategory, searchQuery]);

  // Lista visível limitada a 10 filmes inicialmente
  const visibleMovies = useMemo(() => {
    return filteredMovies.slice(0, visibleCount);
  }, [filteredMovies, visibleCount]);

  // Ao alterar gênero ou pesquisa, reseta para 10 filmes e foco no início
  useEffect(() => {
    setVisibleCount(10);
    setFocusedMovieIndex(0);
  }, [selectedCategory, searchQuery]);

  // Sincroniza categoryIndex quando selectedCategory mudar
  useEffect(() => {
    const idx = CATEGORIES.indexOf(selectedCategory);
    if (idx >= 0) setCategoryIndex(idx);
  }, [selectedCategory]);

  // Rola para a categoria focada quando a zona for 'categories'
  useEffect(() => {
    if (activeZone === 'categories' && categoriesBarRef.current) {
      const btn = document.getElementById(`cat-btn-${categoryIndex}`);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [categoryIndex, activeZone]);

  // Mantém o foco visível suavemente na tela da TV
  useEffect(() => {
    if (activeZone === 'grid') {
      const el = document.getElementById(`movie-card-${focusedMovieIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    } else if (activeZone === 'loadMore') {
      const btn = document.getElementById('load-more-btn');
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (activeZone === 'hero') {
      const heroEl = document.getElementById('hero-banner-section');
      if (heroEl) {
        heroEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (activeZone === 'header') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [focusedMovieIndex, activeZone]);

  // Função central de saída do app
  const triggerExitApp = useCallback(() => {
    const anyWin = window as any;
    if (anyWin.AndroidNative && typeof anyWin.AndroidNative.exitApp === 'function') {
      anyWin.AndroidNative.exitApp();
    } else if (anyWin.Capacitor?.Plugins?.App?.exitApp) {
      anyWin.Capacitor.Plugins.App.exitApp();
    } else {
      window.close();
    }
  }, []);

  // Calcula com 100% de exatidão o número real de colunas visíveis no DOM
  const getGridColumns = useCallback((): number => {
    const prefix = 'movie-card-';
    const c0 = document.getElementById(`${prefix}0`);
    const c1 = document.getElementById(`${prefix}1`);
    if (!c0 || !c1) return 1;

    const r0 = c0.getBoundingClientRect();
    const r1 = c1.getBoundingClientRect();

    if (Math.abs(r0.top - r1.top) < 20) {
      let count = 1;
      while (true) {
        const next = document.getElementById(`${prefix}${count}`);
        if (!next) break;
        const rn = next.getBoundingClientRect();
        if (Math.abs(r0.top - rn.top) > 20) break;
        count++;
      }
      return Math.max(1, count);
    }
    return 1;
  }, []);

  // Navegação Universal por Controle Remoto Android TV (D-PAD 100% Funcional e Preciso)
  const navigateTv = useCallback(
    (action: 'RIGHT' | 'LEFT' | 'UP' | 'DOWN' | 'ENTER' | 'BACK' | 'MENU' | 'DELETE' | 'PLAY') => {
      // 0. Se a Tela Escura de Detalhes Estilo Netflix estiver aberta
      if (selectedDetailMovie) {
        if (action === 'BACK') {
          setSelectedDetailMovie(null);
        }
        return;
      }

      // 1. Se o Player de Vídeo estiver aberto: voltar retorna para a tela de detalhes do filme
      if (activePlayingMovie) {
        if (action === 'BACK') {
          const current = activePlayingMovie;
          setActivePlayingMovie(null);
          setSelectedDetailMovie(current);
        }
        return;
      }

      // 2. Se o Modal de Confirmação de Exclusão estiver aberto
      if (movieToDelete) {
        if (action === 'BACK') {
          setMovieToDelete(null);
          return;
        }
        if (action === 'LEFT' || action === 'RIGHT') {
          setDeleteConfirmFocus((prev) => (prev === 'cancel' ? 'confirm' : 'cancel'));
          return;
        }
        if (action === 'ENTER') {
          if (deleteConfirmFocus === 'confirm') {
            const updated = movies.filter((m) => m.id !== movieToDelete.id);
            setMovies(updated);
            saveMoviesCatalog(updated);
            showToast('Filme excluído do catálogo');
          }
          setMovieToDelete(null);
          return;
        }
        return;
      }

      // 3. Se qualquer outro modal estiver aberto
      if (
        isAddModalOpen ||
        isBatchModalOpen ||
        isGuideModalOpen ||
        isDiagnosticsModalOpen ||
        isQrModalOpen ||
        editingMovie
      ) {
        if (action === 'BACK') {
          setIsAddModalOpen(false);
          setIsBatchModalOpen(false);
          setIsGuideModalOpen(false);
          setIsDiagnosticsModalOpen(false);
          setIsQrModalOpen(false);
          setEditingMovie(null);
        }
        return;
      }

      // 4. Tratamento do Botão VOLTAR (BACK) na Tela Principal: Não fecha direto!
      if (action === 'BACK') {
        if (searchQuery) {
          setSearchQuery('');
          return;
        }
        if (selectedCategory !== 'TODOS') {
          setSelectedCategory('TODOS');
          setCategoryIndex(0);
          return;
        }
        if (activeZone !== 'grid') {
          setActiveZone('grid');
          return;
        }

        // Está na tela raiz: exige duplo clique em 2.5s para sair
        const now = Date.now();
        if (now - lastBackPressTimeRef.current < 2500) {
          triggerExitApp();
        } else {
          lastBackPressTimeRef.current = now;
          setBackPressToast(true);
          setTimeout(() => setBackPressToast(false), 2500);
        }
        return;
      }

      // 5. Atalhos Rápidos no Controle Remoto: PLAY, MENU (Editar) e DELETE (Excluir)
      if (action === 'PLAY') {
        if (activeZone === 'hero' && heroMovie) {
          handlePlayMovie(heroMovie);
          return;
        }
        if (activeZone === 'grid' && filteredMovies[focusedMovieIndex]) {
          handlePlayMovie(filteredMovies[focusedMovieIndex]);
          return;
        }
      }

      if (action === 'MENU') {
        if (activeZone === 'grid' && filteredMovies[focusedMovieIndex]) {
          setEditingMovie(filteredMovies[focusedMovieIndex]);
          setIsAddModalOpen(true);
          return;
        }
      }

      if (action === 'DELETE') {
        if (activeZone === 'grid' && filteredMovies[focusedMovieIndex]) {
          setMovieToDelete(filteredMovies[focusedMovieIndex]);
          setDeleteConfirmFocus('cancel');
          return;
        }
      }

      // 6. NAVEGAÇÃO ENTRE AS 4 ZONAS ORDENADAS:
      // HEADER (topo) <-> HERO (destaque) <-> CATEGORIAS <-> GRADE DE FILMES (base)

      // A) ZONA: HEADER
      // 0: Logo, 1: Busca, 2: Conectar Celular / QR Code, 3: Adicionar Filme, 4: Lote, 5: Diagnóstico, 6: Guia
      if (activeZone === 'header') {
        if (action === 'RIGHT') {
          setHeaderIndex((prev) => Math.min(6, prev + 1));
          return;
        }
        if (action === 'LEFT') {
          setHeaderIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (action === 'DOWN') {
          if (heroMovie) {
            setActiveZone('hero');
            setHeroActionIndex(0);
          } else {
            setActiveZone('categories');
          }
          return;
        }
        if (action === 'ENTER') {
          if (headerIndex === 0) {
            setSelectedCategory('TODOS');
            setSearchQuery('');
            setActiveZone('grid');
            setFocusedMovieIndex(0);
          } else if (headerIndex === 1) {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
            }
          } else if (headerIndex === 2) {
            setIsQrModalOpen(true);
          } else if (headerIndex === 3) {
            setEditingMovie(null);
            setIsAddModalOpen(true);
          } else if (headerIndex === 4) {
            setIsBatchModalOpen(true);
          } else if (headerIndex === 5) {
            setIsDiagnosticsModalOpen(true);
          } else if (headerIndex === 6) {
            setIsGuideModalOpen(true);
          }
          return;
        }
      }

      // B) ZONA: HERO (Destaque Principal)
      if (activeZone === 'hero') {
        if (action === 'UP') {
          setActiveZone('header');
          setHeaderIndex(0);
          return;
        }
        if (action === 'DOWN') {
          setActiveZone('categories');
          return;
        }
        if (action === 'LEFT') {
          setHeroActionIndex(0);
          return;
        }
        if (action === 'RIGHT') {
          setHeroActionIndex(1);
          return;
        }
        if (action === 'ENTER') {
          if (!heroMovie) return;
          if (heroActionIndex === 0) {
            handlePlayMovie(heroMovie);
          } else {
            setSelectedDetailMovie(heroMovie);
          }
          return;
        }
      }

      // C) ZONA: CATEGORIES (Carrossel Horizontal de Gêneros)
      if (activeZone === 'categories') {
        if (action === 'UP') {
          if (heroMovie) {
            setActiveZone('hero');
            setHeroActionIndex(0);
          } else {
            setActiveZone('header');
            setHeaderIndex(0);
          }
          return;
        }
        if (action === 'DOWN') {
          setActiveZone('grid');
          setFocusedMovieIndex(0);
          return;
        }
        if (action === 'RIGHT') {
          setCategoryIndex((prev) => {
            const next = Math.min(CATEGORIES.length - 1, prev + 1);
            setSelectedCategory(CATEGORIES[next]);
            return next;
          });
          return;
        }
        if (action === 'LEFT') {
          setCategoryIndex((prev) => {
            const next = Math.max(0, prev - 1);
            setSelectedCategory(CATEGORIES[next]);
            return next;
          });
          return;
        }
        if (action === 'ENTER') {
          setSelectedCategory(CATEGORIES[categoryIndex]);
          setActiveZone('grid');
          setFocusedMovieIndex(0);
          return;
        }
      }

      // D) ZONA: GRID (Grade de Filmes)
      if (activeZone === 'grid') {
        const totalItems = visibleMovies.length;
        if (totalItems === 0) {
          if (action === 'UP') {
            setActiveZone('categories');
          }
          return;
        }

        const cols = getGridColumns();

        if (action === 'LEFT') {
          if (focusedMovieIndex > 0) {
            setFocusedMovieIndex((prev) => prev - 1);
          }
          return;
        }

        if (action === 'RIGHT') {
          if (focusedMovieIndex < totalItems - 1) {
            setFocusedMovieIndex((prev) => prev + 1);
          }
          return;
        }

        if (action === 'UP') {
          if (focusedMovieIndex >= cols) {
            setFocusedMovieIndex((prev) => prev - cols);
          } else {
            setActiveZone('categories');
          }
          return;
        }

        if (action === 'DOWN') {
          if (focusedMovieIndex + cols < totalItems) {
            setFocusedMovieIndex((prev) => prev + cols);
          } else if (filteredMovies.length > visibleCount) {
            setActiveZone('loadMore');
          }
          return;
        }

        if (action === 'ENTER') {
          const currentMovie = visibleMovies[focusedMovieIndex];
          if (!currentMovie) return;
          // Abre a tela de detalhes onde o usuário pode assistir, editar ou excluir
          setSelectedDetailMovie(currentMovie);
          return;
        }
      }

      // E) ZONA: LOAD MORE ("Ver Mais Filmes")
      if (activeZone === 'loadMore') {
        if (action === 'UP') {
          setActiveZone('grid');
          setFocusedMovieIndex(visibleMovies.length - 1);
          return;
        }
        if (action === 'ENTER') {
          setVisibleCount((prev) => prev + 10);
          setActiveZone('grid');
          return;
        }
      }
    },
    [
      activeZone,
      headerIndex,
      heroActionIndex,
      categoryIndex,
      focusedMovieIndex,
      visibleMovies,
      filteredMovies,
      visibleCount,
      heroMovie,
      movies,
      selectedDetailMovie,
      activePlayingMovie,
      movieToDelete,
      deleteConfirmFocus,
      isAddModalOpen,
      isBatchModalOpen,
      isGuideModalOpen,
      isDiagnosticsModalOpen,
      isQrModalOpen,
      editingMovie,
      searchQuery,
      selectedCategory,
      getGridColumns,
      handlePlayMovie,
      triggerExitApp,
    ]
  );

  // Escuta Universal de Teclado e Controle Remoto Android TV (D-Pad, Teclado USB, Flymouse)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campo de texto
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (isInput) {
        if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 4) {
          (activeEl as HTMLElement).blur();
          e.preventDefault();
        }
        return;
      }

      const code = e.keyCode;
      const key = e.key;

      if (key === 'ArrowRight' || code === 39 || code === 22) {
        e.preventDefault();
        navigateTv('RIGHT');
      } else if (key === 'ArrowLeft' || code === 37 || code === 21) {
        e.preventDefault();
        navigateTv('LEFT');
      } else if (key === 'ArrowUp' || code === 38 || code === 19) {
        e.preventDefault();
        navigateTv('UP');
      } else if (key === 'ArrowDown' || code === 40 || code === 20) {
        e.preventDefault();
        navigateTv('DOWN');
      } else if (key === 'Enter' || code === 13 || code === 23 || code === 66) {
        e.preventDefault();
        navigateTv('ENTER');
      } else if (
        key === 'Escape' ||
        key === 'Backspace' ||
        code === 27 ||
        code === 8 ||
        code === 4 ||
        code === 111
      ) {
        e.preventDefault();
        navigateTv('BACK');
      } else if (key === 'm' || key === 'M' || code === 82 || code === 18) {
        e.preventDefault();
        navigateTv('MENU');
      } else if (key === 'Delete' || code === 46 || code === 67) {
        e.preventDefault();
        navigateTv('DELETE');
      } else if (key === ' ' || code === 179 || code === 126 || code === 32) {
        e.preventDefault();
        navigateTv('PLAY');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateTv]);

  return (
    <div className="min-h-screen bg-black text-white font-['Outfit',sans-serif] selection:bg-red-600 selection:text-white">
      {/* Toast flutuante de Notificação */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-red-600/95 text-white rounded-2xl shadow-2xl backdrop-blur-md border border-red-500/50 flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span className="text-sm font-bold tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* Toast de duplo toque para sair do App */}
      {backPressToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-neutral-900/95 text-white rounded-full shadow-2xl backdrop-blur-md border border-neutral-700 flex items-center gap-2 animate-bounce">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium">Pressione VOLTAR novamente para sair do aplicativo</span>
        </div>
      )}

      {/* HEADER SUPERIOR NETFLIX (TEMA BRANCO, VERMELHO E PRETO) */}
      <header className="sticky top-0 z-40 bg-white/95 border-b border-neutral-200 text-neutral-900 shadow-xs backdrop-blur-md px-6 sm:px-10 py-3.5 flex items-center justify-between">
        {/* Lado Esquerdo: Logo & Marca */}
        <div className="flex items-center gap-6">
          <div
            id="header-nav-0"
            onClick={() => {
              setSelectedCategory('TODOS');
              setSearchQuery('');
              setActiveZone('grid');
              setFocusedMovieIndex(0);
            }}
            className={`flex items-center gap-2 cursor-pointer transition-all duration-200 rounded-xl px-2.5 py-1 ${
              activeZone === 'header' && headerIndex === 0
                ? 'ring-4 ring-red-600 scale-105 bg-red-50 shadow-md'
                : 'hover:opacity-90'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center font-black text-white text-lg tracking-tighter shadow-md shadow-red-600/30">
              NP
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-neutral-950 font-['Outfit'] leading-none">
                NET<span className="text-red-600">PLAY</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">
                Cinema Smart TV
              </span>
            </div>
          </div>

          {/* Campo de Busca Rápida */}
          <div
            id="header-nav-1"
            className={`hidden md:flex items-center gap-2 bg-neutral-100 border border-neutral-200 rounded-full px-4 py-1.5 transition-all duration-200 ${
              activeZone === 'header' && headerIndex === 1
                ? 'ring-4 ring-red-600 border-red-500 bg-white scale-105 shadow-sm'
                : 'hover:border-neutral-300'
            }`}
          >
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar filme ou sinopse..."
              className="bg-transparent text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none w-48 lg:w-64 font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-neutral-400 hover:text-neutral-900">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lado Direito: Ações / Modais */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Botão Destaque: Conectar Celular / QR Code */}
          <button
            id="header-nav-2"
            onClick={() => setIsQrModalOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-bold text-xs transition-all duration-200 shadow-md ${
              activeZone === 'header' && headerIndex === 2
                ? 'bg-red-600 text-white ring-4 ring-red-400 scale-110 shadow-lg shadow-red-600/40'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title="Conectar Celular / QR Code na mesma rede"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar via Celular</span>
          </button>

          {/* Adicionar Filme Manual */}
          <button
            id="header-nav-3"
            onClick={() => {
              setEditingMovie(null);
              setIsAddModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              activeZone === 'header' && headerIndex === 3
                ? 'bg-black text-white ring-4 ring-red-600 scale-105'
                : 'bg-neutral-900 hover:bg-black text-white'
            }`}
            title="Adicionar Filme Manualmente"
          >
            <Plus className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden md:inline">Cadastrar</span>
          </button>

          {/* Importação em Lote */}
          <button
            id="header-nav-4"
            onClick={() => setIsBatchModalOpen(true)}
            className={`p-2 rounded-full text-neutral-700 transition-all duration-200 shadow-xs ${
              activeZone === 'header' && headerIndex === 4
                ? 'bg-neutral-100 text-neutral-950 ring-4 ring-red-600 scale-110 border-red-500'
                : 'bg-white hover:bg-neutral-100 border border-neutral-200'
            }`}
            title="Importar Lista / CSV em Lote"
          >
            <FileSpreadsheet className="w-4 h-4 text-neutral-600" />
          </button>

          {/* Diagnóstico de Links */}
          <button
            id="header-nav-5"
            onClick={() => setIsDiagnosticsModalOpen(true)}
            className={`p-2 rounded-full text-neutral-700 transition-all duration-200 shadow-xs ${
              activeZone === 'header' && headerIndex === 5
                ? 'bg-neutral-100 text-neutral-950 ring-4 ring-red-600 scale-110 border-red-500'
                : 'bg-white hover:bg-neutral-100 border border-neutral-200'
            }`}
            title="Diagnóstico de Domínios e Tokens"
          >
            <Activity className="w-4 h-4 text-neutral-600" />
          </button>

          {/* Guia do Controle */}
          <button
            id="header-nav-6"
            onClick={() => setIsGuideModalOpen(true)}
            className={`p-2 rounded-full text-neutral-700 transition-all duration-200 shadow-xs ${
              activeZone === 'header' && headerIndex === 6
                ? 'bg-neutral-100 text-neutral-950 ring-4 ring-red-600 scale-110 border-red-500'
                : 'bg-white hover:bg-neutral-100 border border-neutral-200'
            }`}
            title="Guia do Controle Remoto da TV"
          >
            <HelpCircle className="w-4 h-4 text-neutral-600" />
          </button>
        </div>
      </header>

      {/* HERO BANNER SECTION (FILME EM DESTAQUE) */}
      {heroMovie && (
        <section id="hero-banner-section" className="relative w-full h-[52vh] sm:h-[60vh] flex items-end px-6 sm:px-12 pb-12 overflow-hidden">
          {/* Fundo Cinemático com Gradiente Escuro Netflix */}
          <div
            className={`absolute inset-0 bg-gradient-to-t ${heroMovie.backdropColor || 'from-black via-neutral-950 to-neutral-900'} opacity-90`}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent"></div>

          {/* Conteúdo do Destaque */}
          <div className="relative z-10 max-w-2xl space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-red-600 font-bold text-[11px] tracking-wider text-white uppercase shadow-md">
                Destaque Cinema
              </span>
              {isHeroMostWatched && (
                <span className="flex items-center gap-1 text-xs text-amber-400 font-bold">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  Mais Assistido
                </span>
              )}
              <span className="text-xs text-neutral-400">{heroMovie.category}</span>
              {heroMovie.year && <span className="text-xs text-neutral-400">• {heroMovie.year}</span>}
              {heroMovie.duration && <span className="text-xs text-neutral-400">• {heroMovie.duration}</span>}
            </div>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md">
              {heroMovie.title}
            </h2>

            {heroMovie.synopsis && (
              <p className="text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed drop-shadow">
                {heroMovie.synopsis}
              </p>
            )}

            {/* Botões do Hero com Foco Visível para D-Pad */}
            <div className="flex items-center gap-4 pt-2">
              <button
                id="hero-action-0"
                onClick={() => handlePlayMovie(heroMovie)}
                className={`px-7 py-3 rounded-xl font-bold text-sm flex items-center gap-2.5 transition-all duration-200 ${
                  activeZone === 'hero' && heroActionIndex === 0
                    ? 'bg-red-600 text-white ring-4 ring-white scale-110 shadow-2xl shadow-red-600/50'
                    : 'bg-white text-black hover:bg-neutral-200'
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Assistir Agora</span>
              </button>

              <button
                id="hero-action-1"
                onClick={() => setSelectedDetailMovie(heroMovie)}
                className={`px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 ${
                  activeZone === 'hero' && heroActionIndex === 1
                    ? 'bg-neutral-700 text-white ring-4 ring-red-600 scale-110'
                    : 'bg-neutral-800/80 text-white hover:bg-neutral-700/80 backdrop-blur-md'
                }`}
              >
                <Info className="w-5 h-5" />
                <span>Mais Detalhes</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* CARROSSEL HORIZONTAL DE CATEGORIAS (TEMA BRANCO / VERMELHO / PRETO) */}
      <section className="px-6 sm:px-12 py-3 bg-[#F8F9FA]">
        <div
          ref={categoriesBarRef}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1"
        >
          {CATEGORIES.map((cat, idx) => {
            const isSelected = selectedCategory === cat;
            const isFocused = activeZone === 'categories' && categoryIndex === idx;

            return (
              <button
                key={cat}
                id={`cat-btn-${idx}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCategoryIndex(idx);
                  setActiveZone('grid');
                  setFocusedMovieIndex(0);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer ${
                  isFocused
                    ? 'bg-red-600 text-white ring-4 ring-red-400 scale-105 shadow-md shadow-red-600/30'
                    : isSelected
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 border border-neutral-200 shadow-xs'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* GRADE DE FILMES (GRID COM CARDS BRANCOS E ACENTOS VERMELHOS E PRETOS) */}
      <main className="px-6 sm:px-12 py-6 flex-1 bg-[#F8F9FA]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black tracking-tight text-neutral-950 flex items-center gap-2 font-['Outfit']">
            <Film className="w-5 h-5 text-red-600" />
            <span>
              {selectedCategory === 'TODOS' ? 'Todos os Filmes' : selectedCategory}
              <span className="text-xs text-neutral-500 font-normal ml-2">
                ({filteredMovies.length} disponíveis)
              </span>
            </span>
          </h3>

          <span className="text-xs text-neutral-500 hidden sm:inline font-medium">
            Navegue pelas setas do controle • OK para Detalhes / Assistir
          </span>
        </div>

        {visibleMovies.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-4 bg-white border border-neutral-200 rounded-3xl p-8 shadow-xs">
            <Film className="w-16 h-16 text-neutral-400 animate-pulse" />
            <h4 className="text-lg font-bold text-neutral-800">Nenhum filme encontrado</h4>
            <p className="text-xs text-neutral-500 max-w-md">
              {searchQuery
                ? `Nenhum resultado para "${searchQuery}". Tente outro termo ou limpe a busca.`
                : 'Nenhum filme cadastrado nesta categoria. Adicione filmes pelo celular via QR Code ou manualmente.'}
            </p>
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-red-600/30"
            >
              <QrCode className="w-4 h-4" />
              <span>Adicionar via Celular (QR Code)</span>
            </button>
          </div>
        ) : (
          <div
            ref={gridContainerRef}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6"
          >
            {visibleMovies.map((movie, idx) => {
              const isCardFocused = activeZone === 'grid' && focusedMovieIndex === idx;
              const watchProgress = getSavedWatchProgress(movie.id);
              const watchTime = watchProgress.time;
              const hasProgress = watchProgress.time > 4;
              const progressPercent =
                watchProgress.duration && watchProgress.duration > 0
                  ? Math.min(100, Math.max(5, (watchProgress.time / watchProgress.duration) * 100))
                  : 0;

              return (
                <div
                  key={movie.id}
                  id={`movie-card-${idx}`}
                  onClick={() => setSelectedDetailMovie(movie)}
                  className={`group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 bg-white border cursor-pointer ${
                    isCardFocused
                      ? 'ring-4 ring-red-600 scale-105 z-20 shadow-2xl shadow-red-500/20 border-red-500'
                      : 'border-neutral-200 hover:border-red-400 hover:shadow-xl shadow-xs'
                  }`}
                >
                  {/* Poster / Backdrop do Card */}
                  <div
                    className="relative aspect-[16/10] w-full bg-gradient-to-br from-neutral-800 to-neutral-950 flex flex-col justify-end p-3.5 overflow-hidden"
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-t ${movie.backdropColor || 'from-neutral-950 to-neutral-800'} opacity-85`}
                    ></div>
                    {movie.posterUrl && (
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                    {/* Duração / Rating no topo */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
                      {movie.category && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-neutral-200 border border-neutral-700/60">
                          {movie.category}
                        </span>
                      )}
                      {movie.year && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-neutral-300">
                          {movie.year}
                        </span>
                      )}
                    </div>

                    {/* Ícone de Play central ao focar */}
                    <div className="relative z-10 flex items-center justify-between mt-auto">
                      <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                      {watchTime > 0 && (
                        <span className="text-[10px] font-mono bg-black/80 px-2 py-0.5 rounded text-neutral-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-red-500" />
                          {formatWatchTime(watchTime)}
                        </span>
                      )}
                    </div>

                    {/* Barra de Progresso se já assistiu */}
                    {hasProgress && progressPercent > 0 && (
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-neutral-800">
                        <div
                          className="h-full bg-red-600 transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    )}
                  </div>

                  {/* Detalhes do Card em Fundo Branco Limpo */}
                  <div className="p-3.5 flex flex-col justify-between flex-1 bg-white">
                    <div>
                      <h4 className="text-sm font-black text-neutral-950 line-clamp-1 group-hover:text-red-600 transition-colors">
                        {movie.title}
                      </h4>
                      {movie.synopsis && (
                        <p className="text-[11px] text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
                          {movie.synopsis}
                        </p>
                      )}
                    </div>

                    {/* Rodapé do Card Limpo (Editar e Excluir ficam em Detalhes) */}
                    <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                      <span className="font-semibold text-[10px] uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded">
                        {movie.category}
                      </span>
                      <span className="text-[11px] font-bold text-neutral-700 flex items-center gap-0.5 group-hover:text-red-600 transition-colors">
                        <span>Detalhes</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Botão "Ver Mais Filmes" (Paginação) */}
        {filteredMovies.length > visibleCount && (
          <div className="mt-10 flex justify-center">
            <button
              id="load-more-btn"
              onClick={() => setVisibleCount((prev) => prev + 10)}
              className={`px-8 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
                activeZone === 'loadMore'
                  ? 'bg-red-600 text-white ring-4 ring-red-400 scale-110 shadow-xl shadow-red-600/30'
                  : 'bg-white text-neutral-800 hover:bg-neutral-100 border border-neutral-300 shadow-sm'
              }`}
            >
              <ChevronDown className="w-5 h-5 text-red-600" />
              <span>
                Ver Mais Filmes ({filteredMovies.length - visibleCount} restantes)
              </span>
            </button>
          </div>
        )}
      </main>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (100% NAVEGÁVEL PELO CONTROLE REMOTO) */}
      {movieToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-500 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-lg font-bold text-white">Excluir Filme do Catálogo?</h4>
              <p className="text-xs text-neutral-400">
                Tem certeza que deseja remover <strong className="text-white">"{movieToDelete.title}"</strong>?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setMovieToDelete(null)}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                  deleteConfirmFocus === 'cancel'
                    ? 'bg-neutral-800 text-white ring-4 ring-white scale-105'
                    : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                Cancelar (Voltar)
              </button>

              <button
                onClick={() => {
                  const updated = movies.filter((m) => m.id !== movieToDelete.id);
                  setMovies(updated);
                  saveMoviesCatalog(updated);
                  showToast('Filme excluído');
                  setMovieToDelete(null);
                }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                  deleteConfirmFocus === 'confirm'
                    ? 'bg-red-600 text-white ring-4 ring-white scale-105 shadow-lg shadow-red-900/50'
                    : 'bg-red-950/60 text-red-400 hover:bg-red-900/60'
                }`}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO FILME (ESTILO NETFLIX COM D-PAD) */}
      {selectedDetailMovie && (
        <MovieDetailModal
          isOpen={!!selectedDetailMovie}
          movie={selectedDetailMovie}
          onClose={() => setSelectedDetailMovie(null)}
          onPlay={(m) => {
            setSelectedDetailMovie(null);
            handlePlayMovie(m);
          }}
          onEdit={(m) => {
            setSelectedDetailMovie(null);
            setEditingMovie(m);
            setIsAddModalOpen(true);
          }}
          onDelete={(m) => {
            setSelectedDetailMovie(null);
            setMovieToDelete(m);
            setDeleteConfirmFocus('cancel');
          }}
        />
      )}

      {/* PLAYER NATIVO DE VÍDEO MP4 */}
      {activePlayingMovie && (
        <NativeMoviePlayer
          movie={activePlayingMovie}
          onClose={() => {
            const current = activePlayingMovie;
            setActivePlayingMovie(null);
            setSelectedDetailMovie(current);
          }}
          onMovieUpdated={(updated) => {
            setMovies((prev) => {
              const newList = prev.map((m) => (m.id === updated.id ? updated : m));
              saveMoviesCatalog(newList);
              return newList;
            });
            setActivePlayingMovie(updated);
          }}
        />
      )}

      {/* MODAL ADICIONAR / EDITAR FILME MANUAL */}
      {isAddModalOpen && (
        <AddMovieModal
          isOpen={isAddModalOpen}
          editingMovie={editingMovie}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingMovie(null);
          }}
          onAddMovie={(movie) => {
            setMovies((prev) => {
              const updated = [movie, ...prev];
              saveMoviesCatalog(updated);
              return updated;
            });
            showToast(`Filme "${movie.title}" cadastrado`);
            setIsAddModalOpen(false);
            setEditingMovie(null);
          }}
          onUpdateMovie={(movie) => {
            setMovies((prev) => {
              const updated = prev.map((m) => (m.id === movie.id ? movie : m));
              saveMoviesCatalog(updated);
              return updated;
            });
            showToast(`Filme "${movie.title}" atualizado`);
            setIsAddModalOpen(false);
            setEditingMovie(null);
          }}
          onSave={(movie) => {
            setMovies((prev) => {
              let updated: MovieItem[];
              if (editingMovie) {
                updated = prev.map((m) => (m.id === movie.id ? movie : m));
                showToast(`Filme "${movie.title}" atualizado`);
              } else {
                updated = [movie, ...prev];
                showToast(`Filme "${movie.title}" cadastrado`);
              }
              saveMoviesCatalog(updated);
              return updated;
            });
            setIsAddModalOpen(false);
            setEditingMovie(null);
          }}
        />
      )}

      {/* MODAL IMPORTAÇÃO EM LOTE */}
      {isBatchModalOpen && (
        <BatchImportModal
          isOpen={isBatchModalOpen}
          existingMovies={movies}
          onClose={() => setIsBatchModalOpen(false)}
          onImportBatch={(batch) => {
            setMovies((prev) => {
              const updated = [...batch, ...prev];
              saveMoviesCatalog(updated);
              return updated;
            });
            showToast(`${batch.length} filme(s) importados em lote!`);
            setIsBatchModalOpen(false);
          }}
        />
      )}

      {/* MODAL DIAGNÓSTICO DE LINKS E TOKENS */}
      {isDiagnosticsModalOpen && (
        <LinkDiagnosticsModal
          isOpen={isDiagnosticsModalOpen}
          movies={movies}
          onClose={() => setIsDiagnosticsModalOpen(false)}
          onUpdateMovies={(updatedList) => {
            setMovies(updatedList);
            saveMoviesCatalog(updatedList);
            showToast('Catálogo de filmes sincronizado');
          }}
          onMoviesUpdated={(updatedList) => {
            setMovies(updatedList);
            saveMoviesCatalog(updatedList);
            showToast('Catálogo de filmes sincronizado');
          }}
        />
      )}

      {/* MODAL GUIA DO CONTROLE REMOTO */}
      {isGuideModalOpen && (
        <DeviceGuideModal
          isOpen={isGuideModalOpen}
          onClose={() => setIsGuideModalOpen(false)}
        />
      )}

      {/* MODAL PAREAMENTO QR CODE / CONECTAR CELULAR NA REDE LOCAL */}
      {isQrModalOpen && (
        <QrPairingModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          onMovieAdded={handleMovieAddedFromRemote}
        />
      )}
    </div>
  );
};
