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
  Radio
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
} from '../utils/moviesCatalogStorage';
import { NativeMoviePlayer } from './NativeMoviePlayer';
import { AddMovieModal } from './AddMovieModal';
import { BatchImportModal } from './BatchImportModal';
import { DeviceGuideModal } from './DeviceGuideModal';
import { MovieDetailModal } from './MovieDetailModal';
import { LinkDiagnosticsModal } from './LinkDiagnosticsModal';
import { IptvChannel, IptvPlaylistBundle } from '../types/iptv';
import {
  loadIptvChannels,
  saveIptvChannels,
  addIptvChannel,
  batchAddIptvChannels,
  updateIptvChannel,
  deleteIptvChannel,
  deleteIptvChannelsBatch,
  deleteIptvPlaylist,
  clearAllIptvChannels,
  toggleFavoriteIptvChannel,
  loadAllPlaylistBundles,
} from '../utils/iptvStorage';
import { IptvView } from './IptvView';
import { IptvPlayer } from './IptvPlayer';
import { AddIptvChannelModal } from './AddIptvChannelModal';

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
  const [currentTab, setCurrentTab] = useState<'movies' | 'iptv'>('movies');
  const [iptvChannels, setIptvChannels] = useState<IptvChannel[]>(() => loadIptvChannels());
  const [activePlayingIptvChannel, setActivePlayingIptvChannel] = useState<IptvChannel | null>(null);
  const [activePlayingPlaylistChannels, setActivePlayingPlaylistChannels] = useState<IptvChannel[] | null>(null);
  const [isAddIptvModalOpen, setIsAddIptvModalOpen] = useState<boolean>(false);
  const [editingIptvChannel, setEditingIptvChannel] = useState<IptvChannel | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<IptvChannel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MovieCategory>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePlayingMovie, setActivePlayingMovie] = useState<MovieItem | null>(null);
  const [selectedDetailMovie, setSelectedDetailMovie] = useState<MovieItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState<boolean>(false);
  const [editingMovie, setEditingMovie] = useState<MovieItem | null>(null);

  // Paginação inteligente: limite inicial de 10 filmes com botão "Ver Mais"
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Navegação Universal por Controle Remoto (D-PAD) com 5 Zonas Físicas Ordenadas
  // header -> hero -> categories -> grid -> loadMore
  const [activeZone, setActiveZone] = useState<'header' | 'hero' | 'categories' | 'grid' | 'loadMore'>('grid');
  // 0: Filmes, 1: Canais Ao Vivo, 2: Gerenciar Listas, 3: Busca, 4: Guia, 5: Lote/M3U, 6: Links, 7: Adicionar
  const [headerIndex, setHeaderIndex] = useState<number>(0);
  const [heroActionIndex, setHeroActionIndex] = useState<0 | 1>(0); // 0: Assistir Agora, 1: Editar/Favoritar
  const [categoryIndex, setCategoryIndex] = useState<number>(0);
  const [focusedMovieIndex, setFocusedMovieIndex] = useState<number>(0);
  const [cardActionIndex, setCardActionIndex] = useState<number>(0); // 0: Assistir, 1: Editar/Favoritar, 2: Excluir/Editar, 3: Excluir

  // Estado da barra IPTV: Linha 1 (toolbar/icones/categorias) e Linha 2 (busca)
  const [iptvBarSubZone, setIptvBarSubZone] = useState<'toolbar' | 'search'>('toolbar');
  const [iptvToolbarIndex, setIptvToolbarIndex] = useState<number>(0);
  const [currentIptvSubTab, setCurrentIptvSubTab] = useState<'live' | 'manager'>('live');

  // Grupos dinâmicos dos canais IPTV
  const iptvDynamicGroups = useMemo(() => {
    const set = new Set<string>();
    iptvChannels.forEach((c) => {
      if (c.group) set.add(c.group);
    });
    const sorted = Array.from(set).sort();
    return ['TODOS', 'FAVORITOS', ...sorted];
  }, [iptvChannels]);

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

  // Inicia a reprodução de um filme, contabilizando contagem e atualizando o destaque
  const handlePlayMovie = useCallback((movie: MovieItem | null) => {
    if (!movie) return;
    recordMoviePlay(movie.id);
    setStatsVersion((v) => v + 1);
    setActivePlayingMovie(movie);
  }, []);

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
    setCardActionIndex(0);
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
    const prefix = currentTab === 'iptv' ? 'iptv-card-' : 'movie-card-';
    const c0 = document.getElementById(`${prefix}0`);
    const c1 = document.getElementById(`${prefix}1`);
    if (!c0 || !c1) return 1;

    const r0 = c0.getBoundingClientRect();
    const r1 = c1.getBoundingClientRect();

    // Se o card 1 estiver na mesma linha horizontal que o card 0 (tolerância de 20px)
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
  }, [currentTab]);

  const handleDeleteIptvChannel = useCallback((channelId: string) => {
    const updated = deleteIptvChannel(channelId);
    setIptvChannels(updated);
    if (activePlayingIptvChannel?.id === channelId) {
      setActivePlayingIptvChannel(null);
    }
  }, [activePlayingIptvChannel]);

  const handleBatchDeleteIptvChannels = useCallback((channelIds: string[]) => {
    const updated = deleteIptvChannelsBatch(channelIds);
    setIptvChannels(updated);
    if (activePlayingIptvChannel && channelIds.includes(activePlayingIptvChannel.id)) {
      setActivePlayingIptvChannel(null);
    }
  }, [activePlayingIptvChannel]);

  const handleDeleteIptvPlaylist = useCallback((playlistName: string) => {
    const updated = deleteIptvPlaylist(playlistName);
    setIptvChannels(updated);
    if (activePlayingIptvChannel && activePlayingIptvChannel.playlistName === playlistName) {
      setActivePlayingIptvChannel(null);
    }
  }, [activePlayingIptvChannel]);

  const handleClearAllIptvChannels = useCallback(() => {
    const updated = clearAllIptvChannels();
    setIptvChannels(updated);
    setActivePlayingIptvChannel(null);
  }, []);

  const handleToggleFavoriteIptvChannel = useCallback((channelId: string) => {
    const updated = toggleFavoriteIptvChannel(channelId);
    setIptvChannels(updated);
  }, []);

  // Navegação Universal por Controle Remoto Android TV (D-PAD 100% Funcional e Preciso)
  const navigateTv = useCallback(
    (action: 'RIGHT' | 'LEFT' | 'UP' | 'DOWN' | 'ENTER' | 'BACK' | 'MENU' | 'DELETE') => {
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

      // 2. Se o Modal de Confirmação de Exclusão estiver aberto (Filmes ou IPTV)
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
          }
          setMovieToDelete(null);
          return;
        }
        return;
      }

      if (channelToDelete) {
        if (action === 'BACK') {
          setChannelToDelete(null);
          return;
        }
        if (action === 'LEFT' || action === 'RIGHT') {
          setDeleteConfirmFocus((prev) => (prev === 'cancel' ? 'confirm' : 'cancel'));
          return;
        }
        if (action === 'ENTER') {
          if (deleteConfirmFocus === 'confirm') {
            handleDeleteIptvChannel(channelToDelete.id);
          }
          setChannelToDelete(null);
          return;
        }
        return;
      }

      // 3. Se qualquer outro modal estiver aberto (Cadastro, Lote, Guia, Diagnóstico, IPTV)
      if (
        isAddModalOpen ||
        isBatchModalOpen ||
        isGuideModalOpen ||
        isDiagnosticsModalOpen ||
        editingMovie ||
        isAddIptvModalOpen ||
        editingIptvChannel
      ) {
        if (action === 'BACK') {
          setIsAddModalOpen(false);
          setIsBatchModalOpen(false);
          setIsGuideModalOpen(false);
          setIsDiagnosticsModalOpen(false);
          setEditingMovie(null);
          setIsAddIptvModalOpen(false);
          setEditingIptvChannel(null);
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

      // 5. Atalhos Rápidos no Controle Remoto: MENU (Editar) e DELETE (Excluir)
      if (action === 'MENU') {
        if (currentTab === 'iptv') {
          const ch = iptvChannels[focusedMovieIndex];
          if (ch) {
            setEditingIptvChannel(ch);
            setIsAddIptvModalOpen(true);
            return;
          }
        } else if (activeZone === 'grid' && filteredMovies[focusedMovieIndex]) {
          setEditingMovie(filteredMovies[focusedMovieIndex]);
          setIsAddModalOpen(true);
          return;
        }
      }
      if (action === 'DELETE') {
        if (currentTab === 'iptv') {
          const ch = iptvChannels[focusedMovieIndex];
          if (ch) {
            setChannelToDelete(ch);
            setDeleteConfirmFocus('cancel');
            return;
          }
        } else if (activeZone === 'grid' && filteredMovies[focusedMovieIndex]) {
          setMovieToDelete(filteredMovies[focusedMovieIndex]);
          setDeleteConfirmFocus('cancel');
          return;
        }
      }

      // 6. NAVEGAÇÃO ENTRE AS 4 ZONAS ORDENADAS:
      // HEADER (topo) <-> HERO (destaque) <-> CATEGORIAS <-> GRADE DE FILMES/CANAIS (base)

      // A) ZONA: HEADER
      // 0: Filmes, 1: Canais Ao Vivo, 2: Gerenciar Listas, 3: Busca, 4: Guia, 5: Lote/M3U, 6: Links, 7: Adicionar
      if (activeZone === 'header') {
        switch (action) {
          case 'LEFT':
            setHeaderIndex((prev) => {
              const next = Math.max(0, prev - 1);
              if (next === 0) {
                setCurrentTab('movies');
              } else if (next === 1) {
                setCurrentTab('iptv');
                setCurrentIptvSubTab('live');
              } else if (next === 2) {
                setCurrentTab('iptv');
                setCurrentIptvSubTab('manager');
              }
              return next;
            });
            break;
          case 'RIGHT':
            setHeaderIndex((prev) => {
              const next = Math.min(7, prev + 1);
              if (next === 0) {
                setCurrentTab('movies');
              } else if (next === 1) {
                setCurrentTab('iptv');
                setCurrentIptvSubTab('live');
              } else if (next === 2) {
                setCurrentTab('iptv');
                setCurrentIptvSubTab('manager');
              }
              return next;
            });
            break;
          case 'DOWN':
            if (currentTab === 'movies') {
              if (heroMovie) {
                setActiveZone('hero');
                setHeroActionIndex(0);
              } else {
                setActiveZone('categories');
              }
            } else if (currentIptvSubTab === 'live') {
              if (iptvChannels.length > 0 && !searchQuery) {
                setActiveZone('hero');
                setHeroActionIndex(0);
              } else {
                setActiveZone('categories');
                setIptvBarSubZone('toolbar');
                setIptvToolbarIndex(0);
              }
            } else {
              // currentIptvSubTab === 'manager'
              setActiveZone('grid');
            }
            break;
          case 'ENTER':
            if (headerIndex === 0) {
              setCurrentTab('movies');
              setActiveZone('header');
            } else if (headerIndex === 1) {
              setCurrentTab('iptv');
              setCurrentIptvSubTab('live');
              setActiveZone('header');
            } else if (headerIndex === 2) {
              setCurrentTab('iptv');
              setCurrentIptvSubTab('manager');
              setActiveZone('header');
            } else if (headerIndex === 3) {
              searchInputRef.current?.focus();
            } else if (headerIndex === 4) {
              setIsGuideModalOpen(true);
            } else if (headerIndex === 5) {
              if (currentTab === 'iptv') {
                setEditingIptvChannel(null);
                setIsAddIptvModalOpen(true);
              } else {
                setIsBatchModalOpen(true);
              }
            } else if (headerIndex === 6) {
              setIsDiagnosticsModalOpen(true);
            } else if (headerIndex === 7) {
              if (currentTab === 'iptv') {
                setEditingIptvChannel(null);
                setIsAddIptvModalOpen(true);
              } else {
                setEditingMovie(null);
                setIsAddModalOpen(true);
              }
            }
            break;
        }
        return;
      }

      // B) ZONA: HERO BANNER (Destaque principal)
      if (activeZone === 'hero') {
        switch (action) {
          case 'UP':
            setActiveZone('header');
            break;
          case 'DOWN':
            setActiveZone('categories');
            if (currentTab === 'iptv') {
              setIptvBarSubZone('toolbar');
              setIptvToolbarIndex(0);
            }
            break;
          case 'LEFT':
            setHeroActionIndex(0);
            break;
          case 'RIGHT':
            if (currentTab !== 'iptv') {
              setHeroActionIndex(1);
            }
            break;
          case 'ENTER':
            if (currentTab === 'iptv') {
              const heroBtn = document.getElementById('iptv-hero-play-btn');
              if (heroBtn) {
                heroBtn.click();
              } else if (iptvChannels.length > 0) {
                const heroCh =
                  iptvChannels.find((c) => c.isFavorite && c.logoUrl) || iptvChannels[0];
                setActivePlayingIptvChannel(heroCh);
              }
            } else if (heroMovie) {
              if (heroActionIndex === 0) {
                handlePlayMovie(heroMovie);
              } else {
                setEditingMovie(heroMovie);
                setIsAddModalOpen(true);
              }
            }
            break;
        }
        return;
      }

      // C) ZONA: CATEGORIAS / BARRA IPTV
      if (activeZone === 'categories') {
        if (currentTab === 'iptv') {
          const maxToolbarIdx = iptvDynamicGroups.length; // 0..groups-1 = Categorias, groups = Botão + IPTV

          switch (action) {
            case 'LEFT':
              setIptvToolbarIndex((prev) => Math.max(0, prev - 1));
              break;
            case 'RIGHT':
              setIptvToolbarIndex((prev) => Math.min(maxToolbarIdx, prev + 1));
              break;
            case 'UP':
              if (iptvChannels.length > 0 && !searchQuery) {
                setActiveZone('hero');
                setHeroActionIndex(0);
              } else {
                setActiveZone('header');
                setHeaderIndex(1);
              }
              break;
            case 'DOWN':
              setActiveZone('grid');
              setFocusedMovieIndex(0);
              setCardActionIndex(0);
              break;
            case 'ENTER':
              if (iptvToolbarIndex < iptvDynamicGroups.length) {
                const catBtn = document.getElementById(`iptv-cat-${iptvToolbarIndex}`);
                catBtn?.click();
                setActiveZone('grid');
                setFocusedMovieIndex(0);
                setCardActionIndex(0);
              } else {
                setEditingIptvChannel(null);
                setIsAddIptvModalOpen(true);
              }
              break;
          }
          return;
        }

        switch (action) {
          case 'LEFT': {
            const next = Math.max(0, categoryIndex - 1);
            setCategoryIndex(next);
            setSelectedCategory(CATEGORIES[next]);
            break;
          }
          case 'RIGHT': {
            const next = Math.min(CATEGORIES.length - 1, categoryIndex + 1);
            setCategoryIndex(next);
            setSelectedCategory(CATEGORIES[next]);
            break;
          }
          case 'UP':
            if (heroMovie && !searchQuery) {
              setActiveZone('hero');
              setHeroActionIndex(0);
            } else {
              setActiveZone('header');
              setHeaderIndex(0);
            }
            break;
          case 'DOWN':
            setActiveZone('grid');
            setFocusedMovieIndex(0);
            setCardActionIndex(0);
            break;
          case 'ENTER':
            setSelectedCategory(CATEGORIES[categoryIndex]);
            setActiveZone('grid');
            setFocusedMovieIndex(0);
            setCardActionIndex(0);
            break;
        }
        return;
      }

      // D) ZONA: GRADE DE FILMES OU CANAIS (GRID)
      if (activeZone === 'grid') {
        if (currentTab === 'iptv' && currentIptvSubTab === 'manager') {
          if (action === 'UP') {
            setActiveZone('header');
            setHeaderIndex(2);
            return;
          }
        }

        const total = currentTab === 'iptv' ? iptvChannels.length : visibleMovies.length;
        if (total === 0) {
          if (action === 'UP') {
            setActiveZone('categories');
            if (currentTab === 'iptv') setIptvToolbarIndex(0);
          }
          return;
        }

        const cols = getGridColumns();

        switch (action) {
          case 'UP': {
            // Se estiver na primeira linha física de cards, sobe para as Categorias
            if (focusedMovieIndex < cols) {
              setActiveZone('categories');
              if (currentTab === 'iptv') {
                setIptvToolbarIndex(0);
              } else {
                setCategoryIndex(0);
              }
            } else {
              // Sobe geometricamente na mesma coluna vertical exata
              setFocusedMovieIndex((prev) => Math.max(0, prev - cols));
              setCardActionIndex(0);
            }
            break;
          }

          case 'DOWN': {
            // Desce geometricamente na mesma coluna vertical exata
            if (focusedMovieIndex + cols < total) {
              setFocusedMovieIndex((prev) => prev + cols);
              setCardActionIndex(0);
            } else if (currentTab === 'movies' && total < filteredMovies.length) {
              // Se há mais filmes para carregar via paginação, desce para o botão "Ver Mais"
              setActiveZone('loadMore');
            } else if (focusedMovieIndex < total - 1) {
              // Se não couber uma linha inteira mas ainda houver itens abaixo
              setFocusedMovieIndex(total - 1);
              setCardActionIndex(0);
            }
            break;
          }

          case 'LEFT': {
            if (currentTab === 'iptv') {
              // IPTV: Excluir(3: 🗑️) -> Editar(2: ✏️) -> Favoritar(1: ⭐) -> Assistir(0) -> Card Anterior
              if (cardActionIndex > 0) {
                setCardActionIndex((prev) => prev - 1);
              } else if (focusedMovieIndex > 0) {
                setFocusedMovieIndex((prev) => prev - 1);
                setCardActionIndex(0);
              }
            } else {
              // Filmes: Excluir(2: 🗑️) -> Editar(1: ✏️) -> Assistir(0) -> Card Anterior
              if (cardActionIndex === 2) {
                setCardActionIndex(1);
              } else if (cardActionIndex === 1) {
                setCardActionIndex(0);
              } else {
                if (focusedMovieIndex > 0) {
                  setFocusedMovieIndex((prev) => prev - 1);
                  setCardActionIndex(0);
                }
              }
            }
            break;
          }

          case 'RIGHT': {
            if (currentTab === 'iptv') {
              // IPTV: Assistir(0) -> Favoritar(1: ⭐) -> Editar(2: ✏️) -> Excluir(3: 🗑️) -> Próximo Card
              if (cardActionIndex < 3) {
                setCardActionIndex((prev) => prev + 1);
              } else if (focusedMovieIndex < total - 1) {
                setFocusedMovieIndex((prev) => prev + 1);
                setCardActionIndex(0);
              }
            } else {
              // Filmes: Assistir(0) -> Editar(1: ✏️) -> Excluir(2: 🗑️) -> Próximo Card
              if (cardActionIndex === 0) {
                setCardActionIndex(1);
              } else if (cardActionIndex === 1) {
                setCardActionIndex(2);
              } else {
                if (focusedMovieIndex < total - 1) {
                  setFocusedMovieIndex((prev) => prev + 1);
                  setCardActionIndex(0);
                }
              }
            }
            break;
          }

          case 'ENTER': {
            if (currentTab === 'iptv') {
              const cardEl = document.getElementById(`iptv-card-${focusedMovieIndex}`);
              if (cardEl) {
                if (cardActionIndex === 0) {
                  cardEl.click();
                } else {
                  const actionButtons = cardEl.querySelectorAll('button');
                  if (actionButtons && actionButtons.length >= cardActionIndex) {
                    actionButtons[cardActionIndex - 1]?.click();
                  } else {
                    cardEl.click();
                  }
                }
              } else {
                const currentCh = iptvChannels[focusedMovieIndex];
                if (currentCh) setActivePlayingIptvChannel(currentCh);
              }
            } else {
              const currentMovie = visibleMovies[focusedMovieIndex];
              if (!currentMovie) return;

              if (cardActionIndex === 0) {
                setSelectedDetailMovie(currentMovie);
              } else if (cardActionIndex === 1) {
                setEditingMovie(currentMovie);
                setIsAddModalOpen(true);
              } else if (cardActionIndex === 2) {
                setMovieToDelete(currentMovie);
                setDeleteConfirmFocus('cancel');
              }
            }
            break;
          }
        }
        return;
      }

      // E) ZONA: BOTÃO VER MAIS FILMES OU CANAIS
      if (activeZone === 'loadMore') {
        switch (action) {
          case 'UP':
            setActiveZone('grid');
            setFocusedMovieIndex(currentTab === 'iptv' ? Math.max(0, focusedMovieIndex) : visibleMovies.length - 1);
            setCardActionIndex(0);
            break;
          case 'ENTER':
            if (currentTab === 'iptv') {
              const loadBtn = document.getElementById('iptv-load-more-btn');
              loadBtn?.click();
            } else {
              setVisibleCount((prev) => prev + 10);
            }
            setActiveZone('grid');
            break;
        }
        return;
      }
    },
    [
      activePlayingMovie,
      selectedDetailMovie,
      movieToDelete,
      channelToDelete,
      iptvChannels,
      handleDeleteIptvChannel,
      handleToggleFavoriteIptvChannel,
      deleteConfirmFocus,
      isAddModalOpen,
      isBatchModalOpen,
      isGuideModalOpen,
      isDiagnosticsModalOpen,
      editingMovie,
      currentTab,
      isAddIptvModalOpen,
      editingIptvChannel,
      searchQuery,
      selectedCategory,
      activeZone,
      headerIndex,
      heroActionIndex,
      categoryIndex,
      focusedMovieIndex,
      cardActionIndex,
      filteredMovies,
      visibleMovies,
      movies,
      heroMovie,
      getGridColumns,
      triggerExitApp,
    ]
  );

  // Registro de ouvintes: ponte nativa Java + eventos padrão de teclado
  // Garante desbloqueio TOTAL para deletar palavras em campos de input e textarea
  useEffect(() => {
    (window as any).onTvRemoteKey = (action: string) => {
      // Se houver foco em campo de texto no momento, não consome as teclas de digitação
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        if (action === 'BACK' && activeEl.blur) {
          activeEl.blur();
        }
        return;
      }
      navigateTv(action as any);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Se o usuário estiver digitando em qualquer input ou textarea:
      // NUNCA bloqueia Backspace, Delete, setas ou letras!
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          target.blur();
          setActiveZone('grid');
        }
        // Permite total fluidez para digitação e exclusão de caracteres
        return;
      }

      const key = e.key;
      const code = e.keyCode || e.which;

      if (key === 'ArrowRight' || key === 'Right' || code === 39 || code === 22) {
        e.preventDefault();
        navigateTv('RIGHT');
      } else if (key === 'ArrowLeft' || key === 'Left' || code === 37 || code === 21) {
        e.preventDefault();
        navigateTv('LEFT');
      } else if (key === 'ArrowDown' || key === 'Down' || code === 40 || code === 20) {
        e.preventDefault();
        navigateTv('DOWN');
      } else if (key === 'ArrowUp' || key === 'Up' || code === 38 || code === 19) {
        e.preventDefault();
        navigateTv('UP');
      } else if (key === 'Enter' || key === 'Select' || key === 'Ok' || code === 13 || code === 23) {
        e.preventDefault();
        navigateTv('ENTER');
      } else if (key === 'Escape' || code === 27 || code === 4) {
        e.preventDefault();
        navigateTv('BACK');
      } else if (key === 'ContextMenu' || code === 93) {
        e.preventDefault();
        navigateTv('MENU');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      delete (window as any).onTvRemoteKey;
    };
  }, [navigateTv]);

  const handleAddMovie = (newMovie: MovieItem) => {
    const updated = [newMovie, ...movies];
    setMovies(updated);
    saveMoviesCatalog(updated);
  };

  const handleBatchAddMovies = (newMovies: MovieItem[]) => {
    const updated = [...newMovies, ...movies];
    setMovies(updated);
    saveMoviesCatalog(updated);
  };

  const handleUpdateMovie = (updatedMovie: MovieItem) => {
    const updated = movies.map((m) => (m.id === updatedMovie.id ? updatedMovie : m));
    setMovies(updated);
    saveMoviesCatalog(updated);
  };

  const handleDeleteMovie = (movie: MovieItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMovieToDelete(movie);
    setDeleteConfirmFocus('cancel');
  };

  const handleEditMovie = (movie: MovieItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMovie(movie);
    setIsAddModalOpen(true);
  };

  const handleAddIptvChannel = (newChannel: IptvChannel, saveAlsoInMovies?: boolean) => {
    const updated = addIptvChannel(newChannel);
    setIptvChannels(updated);

    if (saveAlsoInMovies) {
      const newMovie: MovieItem = {
        id: `movie_iptv_${newChannel.id}`,
        title: newChannel.name,
        streamUrl: newChannel.streamUrl,
        category: 'Ação',
        duration: 'Ao Vivo',
        year: new Date().getFullYear(),
        synopsis: `Transmissão IPTV ao vivo (${newChannel.group}) integrada ao NetPlay Cinema.`,
        backdropColor: NETFLIX_PALETTES[0].bg,
        accentColor: NETFLIX_PALETTES[0].accent,
        createdAt: Date.now(),
      };
      handleAddMovie(newMovie);
    }
  };

  const handleBatchAddIptvChannels = (newChannels: IptvChannel[], saveAlsoInMovies?: boolean) => {
    const updated = batchAddIptvChannels(newChannels);
    setIptvChannels(updated);

    if (saveAlsoInMovies) {
      const movieChannels = newChannels.filter((c) =>
        c.group.toLowerCase().includes('filme') ||
        c.group.toLowerCase().includes('cinema') ||
        c.group.toLowerCase().includes('serie')
      );
      const toAdd = movieChannels.length > 0 ? movieChannels : newChannels.slice(0, 15);
      const newMovies: MovieItem[] = toAdd.map((c) => ({
        id: `movie_batch_iptv_${c.id}`,
        title: c.name,
        streamUrl: c.streamUrl,
        category: 'Ficção & Fantasia',
        duration: 'Ao Vivo',
        year: new Date().getFullYear(),
        synopsis: `Canal ${c.name} (${c.group}) importado da lista IPTV para o NetPlay Cinema.`,
        backdropColor: NETFLIX_PALETTES[Math.floor(Math.random() * NETFLIX_PALETTES.length)].bg,
        accentColor: '#E50914',
        createdAt: Date.now(),
      }));
      if (newMovies.length > 0) {
        handleBatchAddMovies(newMovies);
      }
    }
  };

  const handleAddPlaylistBundle = (bundle: IptvPlaylistBundle, saveAlsoInMovies?: boolean) => {
    if (saveAlsoInMovies && bundle.movies.length > 0) {
      const newMovies: MovieItem[] = bundle.movies.slice(0, 30).map((m) => ({
        id: `movie_bundle_${m.id}`,
        title: m.name,
        streamUrl: m.streamUrl,
        category: 'Ficção & Fantasia',
        duration: 'VOD',
        year: new Date().getFullYear(),
        synopsis: `Filme ${m.name} importado da lista ${bundle.name}.`,
        backdropColor: NETFLIX_PALETTES[Math.floor(Math.random() * NETFLIX_PALETTES.length)].bg,
        accentColor: '#E50914',
        createdAt: Date.now(),
      }));
      handleBatchAddMovies(newMovies);
    }
    setIptvChannels((prev) => [...prev]);
  };

  const handleUpdateIptvChannel = (updatedChannel: IptvChannel) => {
    const updated = updateIptvChannel(updatedChannel);
    setIptvChannels(updated);
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesBarRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      categoriesBarRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] text-neutral-900 flex flex-col font-sans overflow-x-hidden overflow-y-auto">
      {/* 1. Header Fixo com Fundo Branco Limpo e Alto Contraste */}
      {/* Mobile: Logo em cima, e abaixo da logo os controles: buscar, guia, upload lote, adicionar */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-neutral-200 px-3 sm:px-6 md:px-12 py-2 sm:py-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-3 transition-all shadow-xs">
        <div className="flex items-center justify-between md:justify-start gap-3 md:gap-8 w-full md:w-auto">
          {/* Logo NetPlay em Vermelho Vibrante de Alto Contraste */}
          <div
            onClick={() => {
              setSelectedCategory('TODOS');
              setSearchQuery('');
              setActiveZone('grid');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <span className="text-2xl sm:text-2xl md:text-3xl font-black tracking-tighter text-[#E50914] font-['Outfit'] drop-shadow-xs group-hover:scale-105 transition-transform">
              NETPLAY
            </span>
            <span className="text-[10px] font-black text-white bg-neutral-900 px-2 py-0.5 rounded tracking-widest uppercase shadow-xs">
              {currentTab === 'iptv' ? 'IPTV' : 'CINEMA'}
            </span>
          </div>

          {/* Abas Principais no Cabeçalho Superior: Filmes (0), Canais Ao Vivo (1) e Gerenciar Listas (2) */}
          <div className="flex items-center bg-neutral-100 p-1 rounded-full border border-neutral-300 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => {
                setCurrentTab('movies');
                setActiveZone('header');
                setHeaderIndex(0);
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                currentTab === 'movies'
                  ? 'bg-[#E50914] text-white shadow-xs'
                  : 'text-neutral-700 hover:text-neutral-950'
              } ${
                activeZone === 'header' && headerIndex === 0
                  ? 'ring-4 ring-neutral-950 scale-105 shadow-md'
                  : ''
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Filmes</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentTab('iptv');
                setCurrentIptvSubTab('live');
                setActiveZone('header');
                setHeaderIndex(1);
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                currentTab === 'iptv' && currentIptvSubTab === 'live'
                  ? 'bg-[#E50914] text-white shadow-xs'
                  : 'text-neutral-700 hover:text-neutral-950'
              } ${
                activeZone === 'header' && headerIndex === 1
                  ? 'ring-4 ring-neutral-950 scale-105 shadow-md'
                  : ''
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Canais Ao Vivo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentTab('iptv');
                setCurrentIptvSubTab('manager');
                setActiveZone('header');
                setHeaderIndex(2);
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                currentTab === 'iptv' && currentIptvSubTab === 'manager'
                  ? 'bg-[#E50914] text-white shadow-xs'
                  : 'text-neutral-700 hover:text-neutral-950'
              } ${
                activeZone === 'header' && headerIndex === 2
                  ? 'ring-4 ring-neutral-950 scale-105 shadow-md'
                  : ''
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Gerenciar Listas</span>
            </button>
          </div>
        </div>

        {/* Linha de Ações: Buscar (3), Guia (4), Subir Lote (5), Links (6) e Cadastrar (7) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Busca com campo branco contrastante (Header Index 3) */}
          <div className="relative flex-1 min-w-[95px] sm:w-44 md:w-56 md:flex-initial">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className={`bg-neutral-100 border-2 rounded-full pl-7 sm:pl-8 pr-2.5 sm:pr-3 py-1.5 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:bg-white w-full transition-all ${
                activeZone === 'header' && headerIndex === 3
                  ? 'border-[#E50914] ring-3 ring-red-500/40 bg-white font-semibold'
                  : 'border-neutral-300 focus:border-[#E50914]'
              }`}
            />
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2 sm:left-2.5 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Botão Guia TV & Celular (Header Index 4) */}
          <button
            type="button"
            onClick={() => setIsGuideModalOpen(true)}
            title="Guia de uso para Celular e Android TV"
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-bold text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 border transition cursor-pointer shrink-0 active:scale-95 ${
              activeZone === 'header' && headerIndex === 4
                ? 'bg-neutral-900 text-white border-neutral-900 ring-4 ring-red-500/50 scale-105 shadow-md'
                : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-300 shadow-xs'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Guia</span>
          </button>

          {/* Botão Subir Lote (Planilha / Arquivos ou Lista M3U) (Header Index 5) */}
          <button
            type="button"
            onClick={() => {
              if (currentTab === 'iptv') {
                setEditingIptvChannel(null);
                setIsAddIptvModalOpen(true);
              } else {
                setIsBatchModalOpen(true);
              }
            }}
            title={
              currentTab === 'iptv'
                ? 'Importar Lista IPTV .M3U / .M3U8'
                : 'Importar múltiplos filmes via arquivo ou planilha'
            }
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-extrabold text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 border-2 transition cursor-pointer shrink-0 active:scale-95 shadow-xs ${
              activeZone === 'header' && headerIndex === 5
                ? 'bg-neutral-900 text-white border-neutral-900 ring-4 ring-red-500/50 scale-105 shadow-md'
                : 'bg-white hover:bg-neutral-100 text-neutral-900 border-neutral-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#E50914]" />
            <span>{currentTab === 'iptv' ? 'Lista M3U' : 'Lote'}</span>
          </button>

          {/* Botão Diagnóstico de Links & Domínio (Header Index 6) */}
          <button
            type="button"
            onClick={() => setIsDiagnosticsModalOpen(true)}
            title="Painel de Diagnóstico de Links, Renovação de Tokens e Troca de Domínio"
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-extrabold text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 border-2 transition cursor-pointer shrink-0 active:scale-95 shadow-xs ${
              activeZone === 'header' && headerIndex === 6
                ? 'bg-neutral-900 text-white border-neutral-900 ring-4 ring-red-500/50 scale-105 shadow-md'
                : 'bg-white hover:bg-neutral-100 text-neutral-900 border-neutral-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Links</span>
          </button>

          {/* Botão + Cadastrar Filme MP4 ou Canal IPTV (Header Index 7) */}
          <button
            type="button"
            onClick={() => {
              if (currentTab === 'iptv') {
                setEditingIptvChannel(null);
                setIsAddIptvModalOpen(true);
              } else {
                setEditingMovie(null);
                setIsAddModalOpen(true);
              }
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-full font-black text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-md ${
              activeZone === 'header' && headerIndex === 7
                ? 'bg-[#E50914] text-white ring-4 ring-black scale-105 shadow-red-500/40'
                : 'bg-[#E50914] hover:bg-[#b80710] text-white shadow-red-500/20'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{currentTab === 'iptv' ? 'Adicionar Canal' : 'Adicionar Filme'}</span>
          </button>
        </div>
      </header>

      {currentTab === 'iptv' ? (
        <IptvView
          channels={iptvChannels}
          onPlayChannel={(channel, playlistChannels) => {
            setActivePlayingIptvChannel(channel);
            setActivePlayingPlaylistChannels(playlistChannels || null);
          }}
          onOpenAddModal={() => {
            setEditingIptvChannel(null);
            setIsAddIptvModalOpen(true);
          }}
          onEditChannel={(channel) => {
            setEditingIptvChannel(channel);
            setIsAddIptvModalOpen(true);
          }}
          onDeleteChannel={handleDeleteIptvChannel}
          onDeleteBatch={handleBatchDeleteIptvChannels}
          onDeletePlaylist={handleDeleteIptvPlaylist}
          onClearAll={handleClearAllIptvChannels}
          onToggleFavorite={handleToggleFavoriteIptvChannel}
          activeTvZone={activeZone}
          focusedChannelIndex={focusedMovieIndex}
          channelActionIndex={cardActionIndex}
          currentSearchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          iptvBarSubZone={iptvBarSubZone}
          iptvToolbarIndex={iptvToolbarIndex}
          subTab={currentIptvSubTab}
          onSelectSubTab={setCurrentIptvSubTab}
        />
      ) : (
        <>
          {/* 2. Banner Hero Principal em Preto Netflix com Sombras Ricas */}
      {heroMovie && (
        <section
          id="hero-banner-section"
          className={`relative w-full min-h-[340px] md:min-h-[420px] bg-gradient-to-r from-black via-[#141414] to-[#1c0808] text-white border-b-2 border-neutral-800 shadow-2xl flex items-center overflow-hidden transition-all ${
            activeZone === 'hero' ? 'ring-4 ring-inset ring-[#E50914]' : ''
          }`}
        >
          {/* Efeito de Luz Netflix Vermelha */}
          <div className="absolute -top-20 right-0 w-[500px] h-[500px] bg-[#E50914]/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

          {/* Conteúdo do Filme em Destaque */}
          <div className="relative z-20 max-w-7xl mx-auto px-6 md:px-12 py-10 w-full flex flex-col justify-center">
            <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
              {isHeroMostWatched ? (
                <span className="bg-[#E50914] text-white text-[11px] font-black px-3 py-1 rounded tracking-wider uppercase shadow-[0_0_15px_rgba(229,9,20,0.8)] flex items-center gap-1.5 animate-pulse">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>MAIS ASSISTIDO</span>
                </span>
              ) : (
                <span className="bg-[#E50914] text-white text-[11px] font-black px-3 py-1 rounded tracking-wider uppercase shadow-[0_0_12px_rgba(229,9,20,0.6)]">
                  EM DESTAQUE
                </span>
              )}
              {heroMovie.category && (
                <span className="text-xs text-neutral-300 font-extrabold uppercase tracking-wider bg-neutral-900 border border-neutral-700 px-2.5 py-1 rounded">
                  {heroMovie.category}
                </span>
              )}
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded tracking-wider uppercase">
                MP4
              </span>
              {heroMovie.year && (
                <span className="text-xs text-neutral-400 font-bold">• {heroMovie.year}</span>
              )}
              {heroMovie.duration && (
                <span className="text-xs text-neutral-400 font-bold">• {heroMovie.duration}</span>
              )}
            </div>

            {/* Título Monumental de Alto Contraste */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase max-w-3xl mb-3 font-['Outfit'] drop-shadow-lg">
              {heroMovie.title}
            </h1>

            <p className="text-xs md:text-sm text-neutral-300 font-normal max-w-2xl line-clamp-3 mb-6 leading-relaxed">
              {heroMovie.synopsis || 'Disponível em alta definição MP4 com áudio e controles nativos.'}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {/* Botão Assistir do Hero */}
              <button
                type="button"
                onClick={() => handlePlayMovie(heroMovie)}
                className={`px-7 py-3 rounded-xl font-black text-sm flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer ${
                  activeZone === 'hero' && heroActionIndex === 0
                    ? 'bg-[#E50914] text-white ring-4 ring-white scale-105 shadow-[0_0_25px_rgba(229,9,20,0.8)]'
                    : 'bg-[#E50914] hover:bg-[#b80710] text-white shadow-lg shadow-red-950/60'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Assistir Agora</span>
              </button>

              {/* Botão Editar Link do Hero */}
              <button
                type="button"
                onClick={(e) => handleEditMovie(heroMovie, e)}
                className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 border transition cursor-pointer active:scale-95 ${
                  activeZone === 'hero' && heroActionIndex === 1
                    ? 'bg-white text-neutral-950 border-white ring-4 ring-[#E50914] scale-105 shadow-xl'
                    : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                }`}
              >
                <Edit3 className="w-4 h-4 text-[#E50914]" />
                <span>Editar Link / Filme</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Filtro de Categorias (Fundo Branco, Rolagem Suave no Mobile e TV) */}
      <div className="relative border-b border-neutral-200 bg-white px-3 sm:px-6 md:px-12 py-3 flex items-center shadow-xs">
        <button
          type="button"
          onClick={() => scrollCategories('left')}
          className="hidden md:flex p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 mr-2 shrink-0 cursor-pointer border border-neutral-300 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={categoriesBarRef}
          className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-1 touch-pan-x select-none w-full scrollbar-none flex-nowrap"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <span className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider mr-1 sm:mr-2 shrink-0">
            Gêneros:
          </span>
          {CATEGORIES.map((cat, idx) => {
            const isCatActive = selectedCategory === cat;
            const isCatFocused = activeZone === 'categories' && categoryIndex === idx;

            return (
              <button
                key={cat}
                id={`cat-btn-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setCategoryIndex(idx);
                  setActiveZone('grid');
                  setFocusedMovieIndex(0);
                  setCardActionIndex(0);
                }}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
                  isCatFocused
                    ? 'bg-[#E50914] text-white ring-4 ring-neutral-950 font-black scale-105 shadow-md'
                    : isCatActive
                    ? 'bg-[#E50914] text-white shadow-xs font-black'
                    : 'bg-neutral-100 text-neutral-800 hover:text-neutral-950 hover:bg-neutral-200 border border-neutral-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollCategories('right')}
          className="hidden md:flex p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 ml-2 shrink-0 cursor-pointer border border-neutral-300 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Grade de Filmes: 2 Colunas no Mobile, 4+ Colunas no Desktop/Smart TV */}
      <main className="flex-1 px-3 sm:px-6 md:px-12 py-6 sm:py-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#E50914]" />
            <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight uppercase text-neutral-950 font-['Outfit']">
              {selectedCategory === 'TODOS'
                ? 'Catálogo de Filmes'
                : selectedCategory}{' '}
              ({filteredMovies.length})
            </h2>
          </div>
        </div>

        {filteredMovies.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border-2 border-neutral-200 p-8 shadow-xs">
            <Film className="w-14 h-14 text-neutral-400 mb-3" />
            <p className="text-base font-black text-neutral-900 mb-1">
              Nenhum filme encontrado
            </p>
            <p className="text-xs text-neutral-600 mb-5 max-w-md font-medium leading-relaxed">
              Cadastre novos filmes colando o link MP4 ou suba uma lista por lote para expandir seu catálogo.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingMovie(null);
                setIsAddModalOpen(true);
              }}
              className="px-6 py-2.5 rounded-full bg-[#E50914] hover:bg-[#b80710] text-white font-black text-xs transition active:scale-95 shadow-md shadow-red-500/20 cursor-pointer"
            >
              Cadastrar Filme Agora
            </button>
          </div>
        ) : (
          <>
            <div
              ref={gridContainerRef}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3.5 md:gap-4"
            >
              {visibleMovies.map((movie, index) => {
                const isCardFocused = activeZone === 'grid' && focusedMovieIndex === index;
                const watchProgress = getSavedWatchProgress(movie.id);
                const hasProgress = watchProgress.time > 4;
                const progressPercent =
                  watchProgress.duration && watchProgress.duration > 0
                    ? Math.min(100, Math.max(5, (watchProgress.time / watchProgress.duration) * 100))
                    : 35;

                return (
                  <div
                    key={movie.id}
                    id={`movie-card-${index}`}
                    tabIndex={0}
                    onClick={() => {
                      setActiveZone('grid');
                      setFocusedMovieIndex(index);
                      setCardActionIndex(0);
                      // Não abre o vídeo direto: abre a tela escura estilo Netflix com todos os detalhes!
                      setSelectedDetailMovie(movie);
                    }}
                    className={`group relative flex flex-col min-h-[145px] sm:min-h-[160px] md:min-h-[175px] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 md:p-4 justify-between overflow-hidden bg-[#141414] text-white border transition-all duration-200 cursor-pointer shadow-[0_8px_20px_rgba(0,0,0,0.45)] hover:shadow-[0_18px_35px_rgba(0,0,0,0.75),0_0_20px_rgba(229,9,20,0.35)] ${
                      isCardFocused
                        ? 'border-[#E50914] ring-3 sm:ring-4 ring-[#E50914] scale-[1.03] z-30 shadow-[0_15px_40px_rgba(229,9,20,0.55),0_0_25px_rgba(0,0,0,1)] outline-none bg-neutral-900'
                        : 'border-neutral-800/90 hover:border-[#E50914]/80'
                    }`}
                  >
                    {/* Gradiente sutil interno de cinema */}
                    <div className="absolute inset-0 bg-gradient-to-b from-neutral-800/20 via-transparent to-black/90 pointer-events-none" />

                    {/* Topo do Card: Categoria e Metadados */}
                    <div className="flex items-center justify-between z-10 gap-1">
                      <div className="flex items-center gap-1 overflow-hidden">
                        <span className="px-1.5 sm:px-2 py-0.5 rounded bg-neutral-900/95 border border-neutral-700/80 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-200 truncate max-w-[65px] sm:max-w-none shadow-xs">
                          {movie.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-neutral-400 shrink-0">
                        {movie.year && <span>{movie.year}</span>}
                        {movie.duration && <span className="hidden sm:inline">• {movie.duration}</span>}
                      </div>
                    </div>

                    {/* Centro do Card: Nome do Filme com Destaque Tipográfico e Linha Vermelha (Sem sinopse para otimizar espaço) */}
                    <div className="my-auto z-10 py-1.5 sm:py-2">
                      <div className="w-5 sm:w-6 h-0.5 sm:h-1 bg-[#E50914] mb-1 sm:mb-1.5 rounded-full shadow-[0_0_8px_#E50914]" />
                      <h3 className="text-xs sm:text-sm md:text-[15px] font-black text-white leading-tight uppercase font-['Outfit'] group-hover:text-[#E50914] transition-colors line-clamp-2 drop-shadow-md">
                        {movie.title}
                      </h3>

                      {/* Aviso de Retomada com Ícone de Relógio se houver progresso */}
                      {hasProgress && (
                        <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-bold text-[#E50914] mt-1 tracking-wide truncate">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#E50914] shrink-0" />
                          <span>{formatWatchTime(watchProgress.time)}</span>
                        </div>
                      )}
                    </div>

                    {/* Base do Card: Barra de Ações Rápidas */}
                    <div className="z-20 pt-1.5 sm:pt-2 border-t border-neutral-800/90 flex items-center justify-between gap-1 sm:gap-1.5">
                      {/* Botão Ver / Detalhes */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDetailMovie(movie);
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer ${
                          isCardFocused && cardActionIndex === 0
                            ? 'bg-[#E50914] text-white ring-2 ring-white scale-102 shadow-[0_0_12px_rgba(229,9,20,0.8)]'
                            : 'bg-[#E50914] hover:bg-[#b80710] text-white shadow-md shadow-red-950/50'
                        }`}
                      >
                        <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                        <span>Ver</span>
                      </button>

                      {/* Botão Editar: SOMENTE ÍCONE DA CANETA */}
                      <button
                        type="button"
                        onClick={(e) => handleEditMovie(movie, e)}
                        title="Editar link ou filme"
                        className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer border ${
                          isCardFocused && cardActionIndex === 1
                            ? 'bg-white text-neutral-950 border-white ring-2 ring-[#E50914] scale-110 shadow-lg'
                            : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 border-neutral-700/80 hover:text-white'
                        }`}
                      >
                        <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>

                      {/* Botão Excluir: SOMENTE ÍCONE DA LIXEIRA */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMovie(movie, e)}
                        title="Excluir filme"
                        className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer border ${
                          isCardFocused && cardActionIndex === 2
                            ? 'bg-red-600 text-white border-red-600 ring-2 ring-white scale-110 shadow-lg'
                            : 'bg-neutral-800/90 hover:bg-red-950/60 text-neutral-400 hover:text-red-500 border-neutral-700/80 hover:border-red-600'
                        }`}
                      >
                        <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>

                    {/* Barra de Progresso Vermelha Estilo Netflix na Base do Card */}
                    {hasProgress && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800 z-20">
                        <div
                          className="h-full bg-[#E50914] shadow-[0_0_8px_#E50914]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Paginação: Botão Ver Mais Filmes (limite inicial de 10) */}
            {filteredMovies.length > visibleCount && (
              <div className="mt-8 flex flex-col items-center justify-center gap-2.5 pb-6">
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider">
                  Exibindo {visibleMovies.length} de {filteredMovies.length} filmes
                </p>
                <button
                  id="load-more-btn"
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 border ${
                    activeZone === 'loadMore'
                      ? 'bg-[#E50914] text-white border-[#E50914] ring-4 ring-neutral-950 scale-105 shadow-xl'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-700'
                  }`}
                >
                  <ChevronDown className="w-4 h-4 text-[#E50914]" />
                  <span>Ver Mais Filmes (+{Math.min(10, filteredMovies.length - visibleCount)})</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )}

      {/* 5. Tela Escura de Detalhes Estilo Netflix (Sinopse, Assistir, Editar, Excluir) */}
      <MovieDetailModal
        movie={selectedDetailMovie}
        isOpen={!!selectedDetailMovie}
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

      {/* 6. Player de Vídeo Nativo MP4 Cinema */}
      {activePlayingMovie && (
        <NativeMoviePlayer
          movie={activePlayingMovie}
          onClose={() => {
            const current = activePlayingMovie;
            setActivePlayingMovie(null);
            setStatsVersion((v) => v + 1);
            setSelectedDetailMovie(current);
          }}
          onRefreshToken={(updated) => handleUpdateMovie(updated)}
          onDeleteMovie={(m) => {
            const updated = movies.filter((x) => x.id !== m.id);
            setMovies(updated);
            saveMoviesCatalog(updated);
            setSelectedDetailMovie(null);
          }}
        />
      )}

      {/* 6.1 Player IPTV HLS (.m3u8) com Menu de Canais e OSD */}
      {activePlayingIptvChannel && (
        <IptvPlayer
          channel={activePlayingIptvChannel}
          allChannels={activePlayingPlaylistChannels || iptvChannels}
          onClose={() => {
            setActivePlayingIptvChannel(null);
            setActivePlayingPlaylistChannels(null);
          }}
          onSelectChannel={(channel) => setActivePlayingIptvChannel(channel)}
          onToggleFavorite={handleToggleFavoriteIptvChannel}
          onDeleteChannel={handleDeleteIptvChannel}
        />
      )}

      {/* 6. Modal de Confirmação de Exclusão em Fundo Branco e Alto Contraste */}
      {movieToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-neutral-950 uppercase tracking-wide mb-2 font-['Outfit']">
              Remover Filme do Catálogo?
            </h3>
            <p className="text-xs text-neutral-600 mb-3 font-medium">
              Você pode selecionar a opção desejada usando as setas do controle:
            </p>
            <p className="text-base font-black text-[#E50914] uppercase mb-6 px-4 py-2 bg-neutral-100 rounded-lg inline-block border border-neutral-300">
              {movieToDelete.title}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setMovieToDelete(null)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                  deleteConfirmFocus === 'cancel'
                    ? 'bg-neutral-900 text-white ring-4 ring-red-500 shadow-xl scale-105'
                    : 'bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <span>Cancelar (Voltar)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const updated = movies.filter((m) => m.id !== movieToDelete.id);
                  setMovies(updated);
                  saveMoviesCatalog(updated);
                  setMovieToDelete(null);
                }}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                  deleteConfirmFocus === 'confirm'
                    ? 'bg-red-600 text-white ring-4 ring-neutral-950 shadow-xl scale-105'
                    : 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6.2 Modal de Confirmação de Exclusão de Canal IPTV (Card de aviso no sistema idêntico ao modo filmes) */}
      {channelToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center animate-fade-in text-neutral-900">
            <div className="w-14 h-14 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-neutral-950 uppercase tracking-wide mb-2 font-['Outfit']">
              Remover Canal do IPTV?
            </h3>
            <p className="text-xs text-neutral-600 mb-3 font-medium">
              Você pode selecionar a opção desejada usando as setas do controle:
            </p>
            <p className="text-base font-black text-[#E50914] uppercase mb-6 px-4 py-2 bg-neutral-100 rounded-lg inline-block border border-neutral-300 max-w-full truncate">
              {channelToDelete.name}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                  deleteConfirmFocus === 'cancel'
                    ? 'bg-neutral-900 text-white ring-4 ring-red-500 shadow-xl scale-105'
                    : 'bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <span>Cancelar (Voltar)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleDeleteIptvChannel(channelToDelete.id);
                  setChannelToDelete(null);
                }}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                  deleteConfirmFocus === 'confirm'
                    ? 'bg-red-600 text-white ring-4 ring-neutral-950 shadow-xl scale-105'
                    : 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Notificação Toast de Duplo Clique no Botão Voltar para Sair */}
      {backPressToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border-2 border-[#E50914] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-none">
          <div className="w-3 h-3 rounded-full bg-[#E50914] animate-ping" />
          <span className="text-xs font-black tracking-wide uppercase">
            Pressione Voltar novamente para sair do NETPLAY
          </span>
        </div>
      )}

      {/* 8. Modal de Cadastro & Edição de Filmes */}
      <AddMovieModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingMovie(null);
        }}
        onAddMovie={handleAddMovie}
        editingMovie={editingMovie}
        onUpdateMovie={handleUpdateMovie}
      />

      {/* 8.1 Modal de Cadastro e Importação IPTV (Unitário ou Lista M3U) */}
      <AddIptvChannelModal
        isOpen={isAddIptvModalOpen}
        onClose={() => {
          setIsAddIptvModalOpen(false);
          setEditingIptvChannel(null);
        }}
        onAddChannel={handleAddIptvChannel}
        onBatchAddChannels={handleBatchAddIptvChannels}
        onAddPlaylistBundle={handleAddPlaylistBundle}
        editingChannel={editingIptvChannel}
      />

      {/* 9. Modal de Subir Lote de Filmes (Pendrive / Planilha) */}
      <BatchImportModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onImportBatch={handleBatchAddMovies}
        existingMovies={movies}
      />

      {/* 10. Modal com Guia Prático de Uso para Celular e TV Android */}
      <DeviceGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* 11. Modal de Diagnóstico de Links, Troca de Domínio e Renovação de Tokens */}
      <LinkDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        movies={movies}
        onUpdateMovies={(updated) => {
          setMovies(updated);
          saveMoviesCatalog(updated);
        }}
      />
    </div>
  );
};
