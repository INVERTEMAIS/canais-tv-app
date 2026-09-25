import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Tv,
  Film,
  Clapperboard,
  Search,
  Radio,
  Star,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles
} from 'lucide-react';
import { IptvPlaylistBundle, IptvPlaylistItem } from '../types/iptv';

interface PlaylistExplorerModalProps {
  bundle: IptvPlaylistBundle | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayItem: (item: IptvPlaylistItem) => void;
}

export const PlaylistExplorerModal: React.FC<PlaylistExplorerModalProps> = ({
  bundle,
  isOpen,
  onClose,
  onPlayItem,
}) => {
  const [activeCategory, setActiveCategory] = useState<'channels' | 'movies' | 'series'>('channels');
  const [selectedGroup, setSelectedGroup] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [activeZone, setActiveZone] = useState<'tabs' | 'groups' | 'search' | 'list'>('list');
  const [visibleLimit, setVisibleLimit] = useState<number>(40);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Define categoria inicial ao abrir
  useEffect(() => {
    if (bundle) {
      if (bundle.channels.length > 0) setActiveCategory('channels');
      else if (bundle.movies.length > 0) setActiveCategory('movies');
      else if (bundle.series.length > 0) setActiveCategory('series');
      setSelectedGroup('TODOS');
      setSearchQuery('');
      setFocusedIndex(0);
      setVisibleLimit(40);
      setActiveZone('list');
    }
  }, [bundle, isOpen]);

  // Lista da categoria ativa
  const currentItems: IptvPlaylistItem[] = useMemo(() => {
    if (!bundle) return [];
    if (activeCategory === 'channels') return bundle.channels;
    if (activeCategory === 'movies') return bundle.movies;
    return bundle.series;
  }, [bundle, activeCategory]);

  // Grupos únicos para a categoria ativa
  const categoryGroups = useMemo(() => {
    const s = new Set<string>();
    currentItems.forEach((item) => {
      if (item.group) s.add(item.group);
    });
    return ['TODOS', ...Array.from(s).sort()];
  }, [currentItems]);

  // Itens filtrados por grupo e busca
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return currentItems.filter((item) => {
      const matchGroup = selectedGroup === 'TODOS' || item.group === selectedGroup;
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.group && item.group.toLowerCase().includes(q));
      return matchGroup && matchSearch;
    });
  }, [currentItems, selectedGroup, searchQuery]);

  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, visibleLimit);
  }, [filteredItems, visibleLimit]);

  // Navegação por teclado / setas D-PAD
  useEffect(() => {
    if (!isOpen || !bundle) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && target.tagName === 'INPUT';

      if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 4) {
        e.preventDefault();
        if (searchQuery) {
          setSearchQuery('');
          return;
        }
        if (isInput) {
          target.blur();
          setActiveZone('list');
          return;
        }
        onClose();
        return;
      }

      if (isInput) {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          target.blur();
          setActiveZone('list');
          setFocusedIndex(0);
        }
        return;
      }

      const key = e.key;

      if (key === 'ArrowUp') {
        e.preventDefault();
        if (activeZone === 'list') {
          if (focusedIndex > 0) {
            setFocusedIndex((prev) => prev - 1);
            // Scroll item into view
            const el = document.getElementById(`plist-item-${focusedIndex - 1}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            setActiveZone('search');
            searchInputRef.current?.focus();
          }
        } else if (activeZone === 'search') {
          setActiveZone('groups');
        } else if (activeZone === 'groups') {
          setActiveZone('tabs');
        }
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        if (activeZone === 'tabs') {
          setActiveZone('groups');
        } else if (activeZone === 'groups') {
          setActiveZone('search');
          searchInputRef.current?.focus();
        } else if (activeZone === 'search') {
          setActiveZone('list');
          setFocusedIndex(0);
        } else if (activeZone === 'list') {
          if (focusedIndex < visibleItems.length - 1) {
            setFocusedIndex((prev) => prev + 1);
            const el = document.getElementById(`plist-item-${focusedIndex + 1}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else if (visibleItems.length < filteredItems.length) {
            setVisibleLimit((prev) => prev + 40);
          }
        }
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        if (activeZone === 'tabs') {
          if (activeCategory === 'series') setActiveCategory('movies');
          else if (activeCategory === 'movies') setActiveCategory('channels');
          setSelectedGroup('TODOS');
          setFocusedIndex(0);
        } else if (activeZone === 'groups') {
          const idx = categoryGroups.indexOf(selectedGroup);
          if (idx > 0) setSelectedGroup(categoryGroups[idx - 1]);
          setFocusedIndex(0);
        }
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        if (activeZone === 'tabs') {
          if (activeCategory === 'channels') setActiveCategory('movies');
          else if (activeCategory === 'movies') setActiveCategory('series');
          setSelectedGroup('TODOS');
          setFocusedIndex(0);
        } else if (activeZone === 'groups') {
          const idx = categoryGroups.indexOf(selectedGroup);
          if (idx < categoryGroups.length - 1) setSelectedGroup(categoryGroups[idx + 1]);
          setFocusedIndex(0);
        }
      } else if (key === 'Enter') {
        e.preventDefault();
        if (activeZone === 'list') {
          const item = visibleItems[focusedIndex];
          if (item) {
            onPlayItem(item);
          }
        } else if (activeZone === 'search') {
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, bundle, activeZone, focusedIndex, visibleItems, filteredItems, activeCategory, selectedGroup, categoryGroups, searchQuery, onPlayItem, onClose]);

  if (!isOpen || !bundle) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] text-white border-2 border-neutral-800 rounded-2xl w-full max-w-4xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho do Explorador da Lista */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-black p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#E50914] text-white rounded-xl shadow-[0_0_15px_rgba(229,9,20,0.6)]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white font-['Outfit'] uppercase tracking-tight">
                  {bundle.name}
                </h2>
                <span className="text-[10px] font-black uppercase bg-[#E50914] text-white px-2 py-0.5 rounded shadow">
                  Lista M3U
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Total de {bundle.totalCount} itens divididos entre canais, filmes e séries
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            title="Fechar (Voltar)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ETAPA 1: Seleção entre as 3 Categorias (Canais / Filmes / Séries) */}
        <div className="bg-neutral-950 p-2 border-b border-neutral-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('channels');
              setSelectedGroup('TODOS');
              setFocusedIndex(0);
              setActiveZone('list');
            }}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              activeCategory === 'channels'
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-950'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'
            } ${activeZone === 'tabs' && activeCategory === 'channels' ? 'ring-4 ring-white' : ''}`}
          >
            <Radio className="w-4 h-4" />
            <span>Canais Ao Vivo ({bundle.channels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('movies');
              setSelectedGroup('TODOS');
              setFocusedIndex(0);
              setActiveZone('list');
            }}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              activeCategory === 'movies'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-950'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'
            } ${activeZone === 'tabs' && activeCategory === 'movies' ? 'ring-4 ring-white' : ''}`}
          >
            <Film className="w-4 h-4" />
            <span>Filmes ({bundle.movies.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('series');
              setSelectedGroup('TODOS');
              setFocusedIndex(0);
              setActiveZone('list');
            }}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer ${
              activeCategory === 'series'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'
            } ${activeZone === 'tabs' && activeCategory === 'series' ? 'ring-4 ring-white' : ''}`}
          >
            <Clapperboard className="w-4 h-4" />
            <span>Séries ({bundle.series.length})</span>
          </button>
        </div>

        {/* Barra de Filtro de Grupo / Gênero Rolável */}
        {categoryGroups.length > 1 && (
          <div className="bg-neutral-900/90 px-4 py-2 border-b border-neutral-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-black uppercase text-neutral-400 mr-1 shrink-0">
              Grupos:
            </span>
            {categoryGroups.map((grp) => {
              const isSelected = selectedGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => {
                    setSelectedGroup(grp);
                    setFocusedIndex(0);
                    setActiveZone('list');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-white text-black font-black'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  } ${activeZone === 'groups' && isSelected ? 'ring-2 ring-[#E50914]' : ''}`}
                >
                  {grp}
                </button>
              );
            })}
          </div>
        )}

        {/* Barra de Busca Interna da Lista */}
        <div className="px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              onFocus={() => setActiveZone('search')}
              placeholder={`Pesquisar entre os ${currentItems.length} itens desta lista...`}
              className={`w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#E50914] ${
                activeZone === 'search' ? 'ring-2 ring-[#E50914]' : ''
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs font-bold text-neutral-400 shrink-0">
            {filteredItems.length} itens
          </span>
        </div>

        {/* ETAPA 2: Lista Rolável de Itens com Play Automático */}
        <div ref={listContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5">
          {filteredItems.length === 0 ? (
            <div className="py-20 text-center text-neutral-500">
              <Tv className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-neutral-300">Nenhum item encontrado</p>
              <p className="text-xs text-neutral-500">
                Tente alterar a pesquisa ou selecionar outro grupo.
              </p>
            </div>
          ) : (
            visibleItems.map((item, index) => {
              const isFocused = activeZone === 'list' && focusedIndex === index;
              return (
                <div
                  key={item.id || index}
                  id={`plist-item-${index}`}
                  onClick={() => onPlayItem(item)}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                    isFocused
                      ? 'bg-neutral-800 border-[#E50914] ring-3 ring-[#E50914]/60 scale-[1.01] shadow-lg'
                      : 'bg-neutral-900/80 border-neutral-800/80 hover:bg-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Logo ou ícone do tipo */}
                    {item.logoUrl ? (
                      <img
                        src={item.logoUrl}
                        alt={item.name}
                        className="w-10 h-10 object-contain bg-black rounded-lg p-1 border border-neutral-800 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0">
                        {activeCategory === 'channels' ? (
                          <Radio className="w-4 h-4 text-[#E50914]" />
                        ) : activeCategory === 'movies' ? (
                          <Film className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Clapperboard className="w-4 h-4 text-purple-500" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-black text-white truncate tracking-tight">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-neutral-400 font-bold truncate">
                          {item.group || 'Geral'}
                        </span>
                        <span className="text-[9px] font-extrabold bg-neutral-800 text-neutral-300 px-1.5 py-0.2 rounded">
                          {item.quality || 'FHD'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botão Play direto com reprodução automática */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayItem(item);
                    }}
                    className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 ${
                      isFocused
                        ? 'bg-[#E50914] text-white shadow-[0_0_12px_rgba(229,9,20,0.8)]'
                        : 'bg-neutral-800 hover:bg-[#E50914] text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Assistir</span>
                  </button>
                </div>
              );
            })
          )}

          {/* Carregar mais itens se houver */}
          {visibleItems.length < filteredItems.length && (
            <div className="pt-3 pb-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 40)}
                className="px-6 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase cursor-pointer"
              >
                Carregar Mais Itens (+40)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
