import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Tv,
  Play,
  Star,
  Search,
  Plus,
  List,
  Edit3,
  Trash2,
  Radio,
  ChevronLeft,
  ChevronRight,
  Folder,
  Layers,
  Sparkles,
  X,
  AlertTriangle,
  ChevronDown,
  Film,
  Clapperboard
} from 'lucide-react';
import { IptvChannel, IptvFilterTab, IptvPlaylistBundle, IptvPlaylistItem } from '../types/iptv';
import { IptvManagerView, DeleteTargetInfo } from './IptvManagerView';
import { PlaylistExplorerModal } from './PlaylistExplorerModal';
import { loadAllPlaylistBundles, searchAcrossIptv } from '../utils/iptvStorage';

interface IptvViewProps {
  channels: IptvChannel[];
  onPlayChannel: (channel: IptvChannel, playlistChannels?: IptvChannel[]) => void;
  onOpenAddModal: () => void;
  onEditChannel: (channel: IptvChannel) => void;
  onDeleteChannel: (channelId: string) => void;
  onDeleteBatch?: (channelIds: string[]) => void;
  onDeletePlaylist?: (playlistIdentifier: string) => void;
  onClearAll?: () => void;
  onToggleFavorite: (channelId: string) => void;
  onQuickTestLink?: () => void;
  // Sincronização com o estado global do controle remoto da TV
  activeTvZone?: 'header' | 'hero' | 'categories' | 'grid' | 'loadMore' | 'manager';
  focusedChannelIndex?: number;
  channelActionIndex?: number; // 0: Play/Abrir, 1: Favoritar/Info, 2: Editar, 3: Excluir
  currentSearchQuery?: string;
  onSearchChange?: (q: string) => void;
  iptvBarSubZone?: 'toolbar' | 'search';
  iptvToolbarIndex?: number;
  subTab?: 'live' | 'manager';
  onSelectSubTab?: (tab: 'live' | 'manager') => void;
}

export const IptvView: React.FC<IptvViewProps> = ({
  channels,
  onPlayChannel,
  onOpenAddModal,
  onEditChannel,
  onDeleteChannel,
  onDeleteBatch,
  onDeletePlaylist,
  onClearAll,
  onToggleFavorite,
  onQuickTestLink,
  activeTvZone = 'grid',
  focusedChannelIndex = 0,
  channelActionIndex = 0,
  currentSearchQuery = '',
  onSearchChange,
  iptvBarSubZone = 'toolbar',
  iptvToolbarIndex = 0,
  subTab = 'live',
  onSelectSubTab,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'live' | 'manager'>('live');
  const currentSubTab = subTab || internalSubTab;
  const setCurrentSubTab = (t: 'live' | 'manager') => {
    setInternalSubTab(t);
    onSelectSubTab?.(t);
  };
  const [selectedGroup, setSelectedGroup] = useState<IptvFilterTab>('TODOS');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetInfo | null>(null);
  const [deleteConfirmFocus, setDeleteConfirmFocus] = useState<'cancel' | 'confirm'>('cancel');

  // Paginação inteligente: 30 itens por página conforme pedido do usuário
  const [visibleCount, setVisibleCount] = useState<number>(30);

  // Modal para explorar lista importada em etapas (Canais / Filmes / Séries)
  const [selectedBundle, setSelectedBundle] = useState<IptvPlaylistBundle | null>(null);

  const categoriesBarRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSearch = onSearchChange ? currentSearchQuery : localSearch;
  const setEffectiveSearch = onSearchChange ? onSearchChange : setLocalSearch;

  // Carrega pacotes de listas importadas
  const playlistBundles = useMemo(() => {
    return loadAllPlaylistBundles();
  }, [channels]);

  // Grupos dinâmicos dos canais unitários
  const dynamicGroups = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.group) set.add(c.group);
    });
    const sorted = Array.from(set).sort();
    return ['TODOS', 'FAVORITOS', ...sorted];
  }, [channels]);

  // Reseta paginação ao alterar busca ou categoria
  useEffect(() => {
    setVisibleCount(30);
  }, [selectedGroup, effectiveSearch]);

  // Resultados da busca universal (procura em canais unitários E em todas as listas de canais/filmes/séries)
  const searchResults = useMemo(() => {
    const q = effectiveSearch.trim();
    if (!q) return null;
    return searchAcrossIptv(q, channels, 150);
  }, [effectiveSearch, channels, playlistBundles]);

  // Itens normais do catálogo (quando não está pesquisando)
  // Mostra cards das Listas M3U + canais unitários
  const catalogUnitChannels = useMemo(() => {
    return channels.filter((c) => {
      if (selectedGroup === 'FAVORITOS') return !!c.isFavorite;
      if (selectedGroup !== 'TODOS') return c.group.toLowerCase() === selectedGroup.toLowerCase();
      return true;
    });
  }, [channels, selectedGroup]);

  // Lista combinada de cards do catálogo:
  // Se estiver em TODOS, exibe primeiro as Listas Importadas e depois os canais unitários
  const combinedCatalogCards = useMemo(() => {
    if (selectedGroup === 'TODOS' && playlistBundles.length > 0) {
      const listCards = playlistBundles.map((b) => ({
        isPlaylistBundle: true as const,
        bundle: b,
        id: b.id,
      }));
      const channelCards = catalogUnitChannels.map((c) => ({
        isPlaylistBundle: false as const,
        channel: c,
        id: c.id,
      }));
      return [...listCards, ...channelCards];
    }
    return catalogUnitChannels.map((c) => ({
      isPlaylistBundle: false as const,
      channel: c,
      id: c.id,
    }));
  }, [selectedGroup, playlistBundles, catalogUnitChannels]);

  // Itens visíveis respeitando o limite inicial de 30
  const visibleCatalogCards = useMemo(() => {
    return combinedCatalogCards.slice(0, visibleCount);
  }, [combinedCatalogCards, visibleCount]);

  // Canal em Destaque no Banner Hero (prioriza favorito com logo ou primeiro canal ativo)
  const heroChannel = useMemo(() => {
    if (channels.length === 0) return null;
    const favWithLogo = channels.find((c) => c.isFavorite && c.logoUrl);
    if (favWithLogo) return favWithLogo;
    const anyFav = channels.find((c) => c.isFavorite);
    if (anyFav) return anyFav;
    return channels[0];
  }, [channels]);

  const scrollGroups = (direction: 'left' | 'right') => {
    if (categoriesBarRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      categoriesBarRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Executa exclusão confirmada
  const handleExecuteDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'single' && deleteTarget.channelId) {
      onDeleteChannel(deleteTarget.channelId);
    } else if (deleteTarget.type === 'batch' && deleteTarget.channelIds) {
      if (onDeleteBatch) {
        onDeleteBatch(deleteTarget.channelIds);
      } else {
        deleteTarget.channelIds.forEach((id) => onDeleteChannel(id));
      }
    } else if (deleteTarget.type === 'playlist' && deleteTarget.playlistName) {
      if (onDeletePlaylist) {
        onDeletePlaylist(deleteTarget.playlistName);
      } else {
        onDeleteChannel(deleteTarget.playlistName);
      }
    } else if (deleteTarget.type === 'all') {
      if (onClearAll) {
        onClearAll();
      } else {
        const allIds = channels.map((c) => c.id);
        if (onDeleteBatch) onDeleteBatch(allIds);
        else allIds.forEach((id) => onDeleteChannel(id));
      }
    }

    setDeleteTarget(null);
  };

  const isToolbarZone = activeTvZone === 'categories' && iptvBarSubZone === 'toolbar';
  const isLiveIconFocused = isToolbarZone && iptvToolbarIndex === 0;
  const isManagerIconFocused = isToolbarZone && iptvToolbarIndex === 1;
  const isCatFocused = (idx: number) => isToolbarZone && currentSubTab === 'live' && iptvToolbarIndex === 2 + idx;
  const isAddBtnFocused =
    isToolbarZone &&
    iptvToolbarIndex === (currentSubTab === 'live' ? 2 + dynamicGroups.length : 2);
  const isSearchInputFocused = activeTvZone === 'categories' && iptvBarSubZone === 'search';

  useEffect(() => {
    if (isSearchInputFocused && searchInputRef.current) {
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSearchInputFocused]);

  useEffect(() => {
    if (isToolbarZone && iptvToolbarIndex >= 2 && currentSubTab === 'live') {
      const idx = iptvToolbarIndex - 2;
      const catBtn = document.getElementById(`iptv-cat-${idx}`);
      if (catBtn) {
        catBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [isToolbarZone, iptvToolbarIndex, currentSubTab]);

  return (
    <div className="w-full flex flex-col">
      {/* 1. BANNER HERO IPTV (Destaque limpo: sem tarja de favoritos e sem tarja de gerenciar listas) */}
      {currentSubTab === 'live' && heroChannel && !effectiveSearch && (
        <section
          id="iptv-hero-banner"
          className={`relative w-full min-h-[290px] md:min-h-[350px] bg-gradient-to-r from-black via-[#141414] to-[#1c0808] text-white border-b-2 border-neutral-800 shadow-2xl flex items-center overflow-hidden transition-all ${
            activeTvZone === 'hero' ? 'ring-4 ring-inset ring-[#E50914]' : ''
          }`}
        >
          {/* Luz Vermelha Estilo Cinema */}
          <div className="absolute -top-24 right-0 w-[500px] h-[500px] bg-[#E50914]/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

          {/* Conteúdo do Canal em Destaque */}
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-8 md:px-12 py-8 w-full flex flex-col justify-center">
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              <span className="bg-[#E50914] text-white text-[11px] font-black px-3 py-1 rounded tracking-wider uppercase shadow-[0_0_15px_rgba(229,9,20,0.8)] flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                <span>CANAL AO VIVO</span>
              </span>
              <span className="text-xs text-neutral-300 font-extrabold uppercase tracking-wider bg-neutral-900 border border-neutral-700 px-2.5 py-1 rounded">
                {heroChannel.group}
              </span>
              <span className="text-xs text-neutral-300 font-bold bg-neutral-800 px-2 py-1 rounded">
                {heroChannel.quality || 'FHD'}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-3">
              {heroChannel.logoUrl ? (
                <img
                  src={heroChannel.logoUrl}
                  alt={heroChannel.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain bg-black/60 rounded-xl p-1.5 border border-neutral-700 shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center">
                  <Tv className="w-8 h-8 text-[#E50914]" />
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight font-['Outfit'] drop-shadow-md">
                {heroChannel.name}
              </h1>
            </div>

            <p className="text-neutral-300 text-xs sm:text-sm max-w-2xl line-clamp-2 mb-6 font-normal">
              Transmissão de alta estabilidade via HLS (.m3u8). Reprodução rápida sem travamentos no NetPlay TV.
            </p>

            {/* Ação Hero: APENAS o botão Assistir Canal Ao Vivo (tarjas removidas conforme solicitado) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="iptv-hero-play-btn"
                onClick={() => onPlayChannel(heroChannel)}
                className={`bg-[#E50914] hover:bg-[#b80710] text-white font-black text-sm sm:text-base px-7 sm:px-9 py-2.5 sm:py-3 rounded-full flex items-center gap-2.5 transition shadow-[0_0_20px_rgba(229,9,20,0.5)] active:scale-95 cursor-pointer ${
                  activeTvZone === 'hero' ? 'ring-4 ring-white scale-105 shadow-[0_0_25px_rgba(229,9,20,0.9)]' : ''
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Assistir Canal Ao Vivo</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 2. BARRA DE CATEGORIAS DO CATÁLOGO IPTV (Busca unificada apenas no cabeçalho superior) */}
      {currentSubTab === 'live' && (
        <div className="sticky top-[58px] z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-3 sm:px-6 md:px-12 py-2.5 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            {/* Categorias Roláveis */}
            <div className="relative flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => scrollGroups('left')}
                className="p-1 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 shrink-0 cursor-pointer hidden sm:flex"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={categoriesBarRef}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-1 flex-1"
              >
                {dynamicGroups.map((grp, idx) => {
                  const isSelected = selectedGroup === grp;
                  const isCategoryFocused = activeTvZone === 'categories' && iptvToolbarIndex === idx;
                  return (
                    <button
                      key={grp}
                      id={`iptv-cat-${idx}`}
                      type="button"
                      onClick={() => setSelectedGroup(grp)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide whitespace-nowrap transition cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-[#E50914] text-white shadow-xs ring-2 ring-red-500'
                          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                      } ${
                        isCategoryFocused
                          ? 'ring-4 ring-neutral-950 scale-105 shadow-xl bg-[#E50914] text-white z-20'
                          : ''
                      }`}
                    >
                      {grp === 'FAVORITOS' ? '⭐ FAVORITOS' : grp}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollGroups('right')}
                className="p-1 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 shrink-0 cursor-pointer hidden sm:flex"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Botão + IPTV */}
            <button
              type="button"
              id="iptv-btn-add"
              onClick={onOpenAddModal}
              title="Cadastrar canal único ou importar lista M3U"
              className={`bg-[#E50914] hover:bg-[#b80710] text-white font-black text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer shrink-0 ${
                activeTvZone === 'categories' && iptvToolbarIndex === dynamicGroups.length
                  ? 'ring-4 ring-neutral-950 scale-105 shadow-xl z-20'
                  : ''
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">+ IPTV</span>
              <span className="sm:hidden">+</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. CONTEÚDO PRINCIPAL: MODO AO VIVO vs MODO GERENCIADOR */}
      {currentSubTab === 'manager' ? (
        <IptvManagerView
          channels={channels}
          onPlayChannel={onPlayChannel}
          onRequestDelete={(target) => {
            setDeleteTarget(target);
            setDeleteConfirmFocus('cancel');
          }}
          onOpenAddModal={onOpenAddModal}
          onToggleFavorite={onToggleFavorite}
          onEditChannel={onEditChannel}
          searchQuery={effectiveSearch}
          setSearchQuery={setEffectiveSearch}
          onExploreBundle={(b) => setSelectedBundle(b)}
        />
      ) : (
        /* MODO AO VIVO: Grade de Canais e Listas com Paginação de 30 em 30 */
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 md:px-12 py-6">
          {/* Cabeçalho da Seção */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#E50914] animate-pulse" />
              <h2 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight font-['Outfit']">
                {searchResults !== null
                  ? `Resultados da Pesquisa: "${effectiveSearch}"`
                  : selectedGroup === 'TODOS'
                  ? 'Catálogo IPTV (Listas & Canais)'
                  : selectedGroup === 'FAVORITOS'
                  ? 'Canais Favoritos'
                  : `Canais de ${selectedGroup}`}
              </h2>
              <span className="text-xs font-bold text-neutral-700 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded-full">
                {searchResults !== null
                  ? `${searchResults.length} encontrados`
                  : `${combinedCatalogCards.length} disponíveis`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCurrentSubTab('manager')}
              className="text-xs font-bold text-neutral-600 hover:text-[#E50914] flex items-center gap-1 cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Gerenciar Listas</span>
            </button>
          </div>

          {/* SE HOUVER BUSCA ATIVA: Mostra todos os resultados puxados de unitários E de listas */}
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center shadow-xs">
                <Search className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <h3 className="font-black text-base text-neutral-800 mb-1">
                  Nenhum resultado encontrado para "{effectiveSearch}"
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
                  Pesquisamos em todos os canais unitários e dentro de todas as listas M3U cadastradas.
                </p>
                <button
                  type="button"
                  onClick={() => setEffectiveSearch('')}
                  className="px-5 py-2 rounded-full bg-neutral-900 text-white font-bold text-xs"
                >
                  Limpar Busca
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
                {searchResults.map((item, index) => {
                  const isFocused =
                    activeTvZone === 'grid' && focusedChannelIndex === index;
                  const itemType = item.type || 'channel';

                  return (
                    <div
                      key={`search-${item.id}-${index}`}
                      id={`iptv-card-${index}`}
                      onClick={() => onPlayChannel(item as IptvChannel)}
                      className={`group relative bg-neutral-900 text-white rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-md hover:scale-[1.02] hover:shadow-xl ${
                        isFocused
                          ? 'border-[#E50914] ring-4 ring-[#E50914]/60 scale-[1.02] z-20'
                          : 'border-neutral-800 hover:border-[#E50914]'
                      }`}
                    >
                      {/* Topo com Logo */}
                      <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center p-3 overflow-hidden">
                        {/* Badge de Tipo */}
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                          <span
                            className={`text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow ${
                              itemType === 'channel'
                                ? 'bg-[#E50914]'
                                : itemType === 'movie'
                                ? 'bg-blue-600'
                                : 'bg-purple-600'
                            }`}
                          >
                            {itemType === 'channel' ? (
                              <>
                                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                AO VIVO
                              </>
                            ) : itemType === 'movie' ? (
                              'FILME'
                            ) : (
                              'SÉRIE'
                            )}
                          </span>
                        </div>

                        {item.logoUrl ? (
                          <img
                            src={item.logoUrl}
                            alt={item.name}
                            className="max-h-14 max-w-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-neutral-500 group-hover:text-[#E50914] transition">
                            {itemType === 'channel' ? (
                              <Tv className="w-8 h-8 mb-1" />
                            ) : itemType === 'movie' ? (
                              <Film className="w-8 h-8 mb-1 text-blue-500" />
                            ) : (
                              <Clapperboard className="w-8 h-8 mb-1 text-purple-500" />
                            )}
                          </div>
                        )}

                        {/* Botão Play Hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <div className="w-11 h-11 rounded-full bg-[#E50914] flex items-center justify-center text-white shadow-lg">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Informações */}
                      <div className="p-3 bg-neutral-900 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-black text-xs text-white truncate tracking-tight mb-1" title={item.name}>
                            {item.name}
                          </h3>
                          <div className="flex items-center justify-between text-[10px] text-neutral-400">
                            <span className="truncate">{item.group || 'Geral'}</span>
                            <span className="bg-neutral-800 text-neutral-300 font-bold px-1.5 py-0.5 rounded text-[9px]">
                              {item.playlistName ? `Lista: ${item.playlistName}` : item.quality || 'HD'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-end">
                          <span className="text-[10px] font-bold text-[#E50914] flex items-center gap-1">
                            <Play className="w-3 h-3 fill-current" />
                            Assistir
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* MODO NORMAL: CARDS DE LISTA M3U + CANAIS UNITÁRIOS COM LIMITE DE 30 E "VER MAIS" */
            combinedCatalogCards.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center shadow-xs">
                <Tv className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <h3 className="font-black text-base text-neutral-800 mb-1">
                  Nenhum canal nesta categoria
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-5">
                  Cadastre canais unitários ou importe uma lista M3U com separação de canais, filmes e séries.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="bg-[#E50914] text-white font-bold text-xs px-5 py-2.5 rounded-full hover:bg-red-700 transition cursor-pointer inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Novo Canal ou Lista M3U</span>
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
                  {visibleCatalogCards.map((item, index) => {
                    const isFocused =
                      activeTvZone === 'grid' && focusedChannelIndex === index;

                    // A) CARD DE LISTA M3U IMPORTADA
                    if (item.isPlaylistBundle) {
                      const bundle = item.bundle;
                      return (
                        <div
                          key={`bundle-${bundle.id}`}
                          id={`iptv-card-${index}`}
                          onClick={() => setSelectedBundle(bundle)}
                          className={`group relative bg-neutral-900 text-white rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-md hover:scale-[1.02] hover:shadow-xl ${
                            isFocused
                              ? 'border-[#E50914] ring-4 ring-[#E50914]/50 scale-[1.02] z-20'
                              : 'border-neutral-800 hover:border-[#E50914]'
                          }`}
                        >
                          {/* Banner da Lista */}
                          <div className="relative aspect-video w-full bg-gradient-to-br from-neutral-950 via-[#181818] to-neutral-900 flex flex-col items-center justify-center p-3 border-b border-neutral-800">
                            <span className="absolute top-2 left-2 bg-[#E50914] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow">
                              <Layers className="w-3 h-3" />
                              LISTA M3U
                            </span>

                            <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#E50914] mb-2 group-hover:scale-110 transition-transform">
                              <Layers className="w-6 h-6" />
                            </div>

                            <p className="text-[11px] font-black uppercase text-neutral-300 tracking-wider">
                              {bundle.totalCount} itens
                            </p>
                          </div>

                          {/* Info da Lista */}
                          <div className="p-3 bg-neutral-900 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="font-black text-xs text-white truncate tracking-tight mb-1" title={bundle.name}>
                                {bundle.name}
                              </h3>
                              <p className="text-[10px] text-neutral-400 leading-tight">
                                📺 {bundle.channels.length} canais • 🎬 {bundle.movies.length} filmes • 🍿 {bundle.series.length} séries
                              </p>
                            </div>

                            {/* Ações da Lista */}
                            <div className="mt-2.5 pt-2 border-t border-neutral-800 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBundle(bundle);
                                }}
                                className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition ${
                                  isFocused && channelActionIndex === 0
                                    ? 'bg-[#E50914] text-white ring-2 ring-white scale-105'
                                    : 'bg-neutral-800 hover:bg-[#E50914] text-white'
                                }`}
                              >
                                Abrir Lista
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget({
                                    type: 'playlist',
                                    playlistName: bundle.name,
                                    count: bundle.totalCount,
                                  });
                                  setDeleteConfirmFocus('cancel');
                                }}
                                title="Excluir Lista"
                                className={`p-1 rounded text-neutral-400 hover:text-red-400 transition ${
                                  isFocused && channelActionIndex === 1
                                    ? 'bg-red-600 text-white ring-2 ring-white scale-110'
                                    : ''
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // B) CARD DE CANAL UNITÁRIO
                    const ch = item.channel;
                    return (
                      <div
                        key={ch.id}
                        id={`iptv-card-${index}`}
                        onClick={() => onPlayChannel(ch)}
                        className={`group relative bg-neutral-900 text-white rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-md hover:scale-[1.02] hover:shadow-xl ${
                          isFocused
                            ? 'border-[#E50914] ring-4 ring-[#E50914]/50 scale-[1.02] z-20'
                            : 'border-neutral-800 hover:border-[#E50914]'
                        }`}
                      >
                        {/* Topo do Card com Logo */}
                        <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center p-3 overflow-hidden">
                          {/* Badge Ao Vivo */}
                          <div className="absolute top-2 left-2 z-10">
                            <span className="bg-[#E50914] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow">
                              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                              AO VIVO
                            </span>
                          </div>

                          {/* Botão Favorito */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(ch.id);
                            }}
                            className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition cursor-pointer backdrop-blur-xs ${
                              isFocused && channelActionIndex === 1
                                ? 'bg-amber-500 ring-2 ring-white scale-110'
                                : 'bg-black/60 hover:bg-black/90'
                            }`}
                            title="Favoritar Canal"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                ch.isFavorite
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            />
                          </button>

                          {ch.logoUrl ? (
                            <img
                              src={ch.logoUrl}
                              alt={ch.name}
                              className="max-h-14 max-w-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-neutral-500 group-hover:text-[#E50914] transition">
                              <Tv className="w-8 h-8 mb-1" />
                              <span className="text-[10px] font-black tracking-wider uppercase">IPTV</span>
                            </div>
                          )}

                          {/* Botão Play Hover */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <div
                              className={`w-11 h-11 rounded-full bg-[#E50914] flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform ${
                                isFocused && channelActionIndex === 0 ? 'ring-4 ring-white' : ''
                              }`}
                            >
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-neutral-900 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-black text-xs text-white truncate tracking-tight mb-1" title={ch.name}>
                              {ch.name}
                            </h3>
                            <div className="flex items-center justify-between text-[10px] text-neutral-400">
                              <span className="truncate">{ch.group}</span>
                              <span className="bg-neutral-800 text-neutral-300 font-bold px-1.5 py-0.5 rounded">
                                {ch.quality || 'HD'}
                              </span>
                            </div>
                          </div>

                          {/* Ações de Edição e Exclusão no Card */}
                          <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditChannel(ch);
                              }}
                              title="Editar Canal"
                              className={`p-1 rounded transition ${
                                isFocused && channelActionIndex === 2
                                  ? 'bg-neutral-700 text-white ring-2 ring-[#E50914]'
                                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({
                                  type: 'single',
                                  channelId: ch.id,
                                  channelName: ch.name,
                                  count: 1,
                                });
                                setDeleteConfirmFocus('cancel');
                              }}
                              title="Excluir Canal"
                              className={`p-1 rounded transition ${
                                isFocused && channelActionIndex === 3
                                  ? 'bg-red-600 text-white ring-2 ring-white'
                                  : 'text-neutral-400 hover:text-red-400 hover:bg-neutral-800'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Paginação: Botão Ver Mais (+30) */}
                {combinedCatalogCards.length > visibleCount && (
                  <div className="mt-8 flex flex-col items-center justify-center gap-2.5 pb-6">
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider">
                      Exibindo {visibleCatalogCards.length} de {combinedCatalogCards.length} itens do catálogo
                    </p>
                    <button
                      id="iptv-load-more-btn"
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 30)}
                      className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 border ${
                        activeTvZone === 'loadMore'
                          ? 'bg-[#E50914] text-white border-[#E50914] ring-4 ring-neutral-950 scale-105 shadow-xl'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-700'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4 text-[#E50914]" />
                      <span>Ver Mais (+{Math.min(30, combinedCatalogCards.length - visibleCount)})</span>
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </main>
      )}

      {/* 4. MODAL PARA EXPLORAR LISTA IMPORTADA EM ETAPAS (CANAIS / FILMES / SÉRIES) */}
      <PlaylistExplorerModal
        bundle={selectedBundle}
        isOpen={!!selectedBundle}
        onClose={() => setSelectedBundle(null)}
        onPlayItem={(item) => {
          // Extrai todos os canais desta lista para que a navegação do player mostre somente canais desta lista
          const bundleChannelsList: IptvChannel[] = (selectedBundle?.channels || []).map((ch, idx) => ({
            id: ch.id || `pl_${selectedBundle?.id}_${idx}`,
            name: ch.name,
            group: ch.group || selectedBundle?.name || 'Geral',
            streamUrl: ch.streamUrl,
            logoUrl: ch.logoUrl,
            quality: ch.quality || 'HD',
            isFavorite: false,
            createdAt: Date.now(),
            playlistId: selectedBundle?.id,
            playlistName: selectedBundle?.name,
          }));

          const asIptvChannel: IptvChannel = {
            id: item.id || `pl_item_${Date.now()}`,
            name: item.name,
            group: item.group || selectedBundle?.name || 'Lista M3U',
            streamUrl: item.streamUrl,
            logoUrl: item.logoUrl,
            quality: item.quality || 'HD',
            isFavorite: false,
            createdAt: Date.now(),
            playlistId: selectedBundle?.id,
            playlistName: selectedBundle?.name,
          };

          // Mantém o pacote de lista aberto em segundo plano; ao dar ESC no player, retorna para a lista!
          onPlayChannel(asIptvChannel, bundleChannelsList.length > 0 ? bundleChannelsList : undefined);
        }}
      />

      {/* 5. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center animate-fade-in text-neutral-900">
            <div className="w-14 h-14 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-black text-neutral-950 uppercase tracking-wide mb-2 font-['Outfit']">
              {deleteTarget.type === 'single'
                ? 'Remover Canal do IPTV?'
                : deleteTarget.type === 'playlist'
                ? 'Excluir Lista Completa?'
                : deleteTarget.type === 'batch'
                ? `Remover ${deleteTarget.count} Canais Selecionados?`
                : 'Excluir Todos os Canais do IPTV?'}
            </h3>

            <p className="text-xs text-neutral-600 mb-3 font-medium">
              Você pode selecionar a opção desejada usando as setas do controle ou toque:
            </p>

            <p className="text-base font-black text-[#E50914] uppercase mb-6 px-4 py-2 bg-neutral-100 rounded-lg inline-block border border-neutral-300 max-w-full truncate">
              {deleteTarget.type === 'single'
                ? deleteTarget.channelName
                : deleteTarget.type === 'playlist'
                ? deleteTarget.playlistName
                : deleteTarget.type === 'batch'
                ? `${deleteTarget.count} canais selecionados`
                : `Todos os ${deleteTarget.count} canais cadastrados`}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
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
                onClick={handleExecuteDelete}
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
    </div>
  );
};
