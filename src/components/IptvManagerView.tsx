import React, { useState, useMemo } from 'react';
import {
  List,
  Layers,
  Trash2,
  Play,
  Star,
  Edit3,
  Search,
  Plus,
  Tv,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Folder,
  Radio,
  Sparkles,
  Film,
  Clapperboard,
  Eye
} from 'lucide-react';
import { IptvChannel, IptvPlaylistBundle } from '../types/iptv';
import { loadAllPlaylistBundles } from '../utils/iptvStorage';

export interface DeleteTargetInfo {
  type: 'single' | 'batch' | 'playlist' | 'all';
  channelId?: string;
  channelName?: string;
  channelIds?: string[];
  playlistName?: string;
  count: number;
}

interface IptvManagerViewProps {
  channels: IptvChannel[];
  onPlayChannel: (channel: IptvChannel) => void;
  onRequestDelete: (target: DeleteTargetInfo) => void;
  onOpenAddModal: () => void;
  onToggleFavorite: (channelId: string) => void;
  onEditChannel: (channel: IptvChannel) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onExploreBundle?: (bundle: IptvPlaylistBundle) => void;
}

export const IptvManagerView: React.FC<IptvManagerViewProps> = ({
  channels,
  onPlayChannel,
  onRequestDelete,
  onOpenAddModal,
  onToggleFavorite,
  onEditChannel,
  searchQuery,
  setSearchQuery,
  onExploreBundle,
}) => {
  const [managerTab, setManagerTab] = useState<'playlists' | 'allChannels'>('playlists');
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>({});
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  // Carrega pacotes de listas importadas (.M3U)
  const playlistBundles = useMemo(() => {
    return loadAllPlaylistBundles();
  }, [channels]);

  // Agrupamento por Lista / Origem (playlistName ou canal avulso)
  const groupedPlaylists = useMemo(() => {
    const map = new Map<string, IptvChannel[]>();

    channels.forEach((ch) => {
      const listName = ch.playlistName?.trim() || ch.playlistId || 'Canais Avulsos / Unitários';
      if (!map.has(listName)) {
        map.set(listName, []);
      }
      map.get(listName)!.push(ch);
    });

    return Array.from(map.entries()).map(([name, listChannels]) => ({
      name,
      channels: listChannels,
      count: listChannels.length,
    }));
  }, [channels]);

  // Canais filtrados pela busca global (busca em nome, grupo e lista de origem)
  const queryFilteredChannels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.group && c.group.toLowerCase().includes(q)) ||
        (c.playlistName && c.playlistName.toLowerCase().includes(q)) ||
        (c.streamUrl && c.streamUrl.toLowerCase().includes(q))
    );
  }, [channels, searchQuery]);

  // Alterna expansão de uma lista
  const toggleExpandPlaylist = (name: string) => {
    setExpandedPlaylists((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Alterna seleção de um canal
  const toggleSelectChannel = (id: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Selecionar todos os canais de uma lista específica
  const selectAllInList = (listChannels: IptvChannel[]) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      listChannels.forEach((c) => next.add(c.id));
      return next;
    });
  };

  // Desmarcar todos os canais de uma lista específica
  const deselectAllInList = (listChannels: IptvChannel[]) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      listChannels.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  // Selecionar todos visíveis globalmente
  const selectAllGlobal = () => {
    setSelectedChannelIds(new Set(queryFilteredChannels.map((c) => c.id)));
  };

  // Desmarcar todos globalmente
  const deselectAllGlobal = () => {
    setSelectedChannelIds(new Set());
  };

  // Disparar exclusão em lote dos canais selecionados
  const handleDeleteSelected = (filterListChannels?: IptvChannel[]) => {
    const allSelected: string[] = Array.from(selectedChannelIds);
    let idsToDelete: string[] = [];
    if (filterListChannels) {
      const listIds = new Set(filterListChannels.map((c) => c.id));
      idsToDelete = allSelected.filter((id) => listIds.has(id));
    } else {
      idsToDelete = allSelected;
    }

    if (idsToDelete.length === 0) return;

    onRequestDelete({
      type: 'batch',
      channelIds: idsToDelete,
      count: idsToDelete.length,
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 md:px-12 py-6">
      {/* 1. Barra de Estatísticas & Ações Rápidas */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-6 mb-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-red-50 text-[#E50914] rounded-xl border border-red-200">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">
                Total de Canais
              </p>
              <p className="text-xl font-black text-neutral-900">{channels.length}</p>
            </div>
          </div>

          <div className="h-8 w-px bg-neutral-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">
                Listas & Grupos
              </p>
              <p className="text-xl font-black text-neutral-900">{groupedPlaylists.length}</p>
            </div>
          </div>

          <div className="h-8 w-px bg-neutral-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">
                Favoritos
              </p>
              <p className="text-xl font-black text-neutral-900">
                {channels.filter((c) => c.isFavorite).length}
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação Global */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="bg-[#E50914] hover:bg-red-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Adicionar Lista / Canal</span>
          </button>

          {channels.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onRequestDelete({
                  type: 'all',
                  count: channels.length,
                })
              }
              className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-300 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpar Todos os Canais</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Barra de Navegação de Abas do Gerenciador + Busca Global */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center bg-neutral-200/80 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setManagerTab('playlists')}
            className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              managerTab === 'playlists'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Folder className="w-4 h-4 text-[#E50914]" />
            <span>Lista de Todas as Listas ({groupedPlaylists.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setManagerTab('allChannels')}
            className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              managerTab === 'allChannels'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Tv className="w-4 h-4 text-[#E50914]" />
            <span>Todos os Canais ({channels.length})</span>
          </button>
        </div>

        {/* Busca Unificada e Rápida de Canais */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar qualquer canal (ex: Globo, SBT, ESPN, HBO)..."
            className="w-full bg-white border border-neutral-300 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-[#E50914] focus:ring-2 focus:ring-red-500/20 shadow-xs"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-[10px] font-bold text-neutral-400 hover:text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* 3. ABA 1: LISTA DE TODAS AS LISTAS E CANAIS DE CADA LISTA */}
      {managerTab === 'playlists' && (
        <div className="space-y-6">
          {/* Seção de Pacotes de Listas .M3U Importadas */}
          {playlistBundles.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#E50914]" />
                  <h3 className="font-black text-neutral-900 text-sm sm:text-base uppercase tracking-tight">
                    Listas M3U Importadas ({playlistBundles.length})
                  </h3>
                </div>
                <span className="text-xs font-bold text-neutral-500">
                  Canais, Filmes e Séries
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {playlistBundles.map((bundle) => (
                  <div
                    key={bundle.id}
                    className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50 hover:bg-neutral-100/60 transition flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-black text-neutral-900 text-sm truncate">
                          {bundle.name}
                        </h4>
                        <span className="text-[10px] font-black text-white bg-neutral-900 px-2 py-0.5 rounded uppercase">
                          {bundle.totalCount} itens
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
                        <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Radio className="w-3 h-3 text-[#E50914]" />
                          <span>{bundle.channelCount} canais</span>
                        </span>
                        {bundle.movieCount > 0 && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Film className="w-3 h-3 text-blue-600" />
                            <span>{bundle.movieCount} filmes</span>
                          </span>
                        )}
                        {bundle.seriesCount > 0 && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clapperboard className="w-3 h-3 text-purple-600" />
                            <span>{bundle.seriesCount} séries</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
                      {onExploreBundle && (
                        <button
                          type="button"
                          onClick={() => onExploreBundle(bundle)}
                          className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs py-2 px-3 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#E50914]" />
                          <span>Explorar Lista</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onRequestDelete({
                            type: 'playlist',
                            playlistName: bundle.name,
                            channelId: bundle.id,
                            count: bundle.totalCount,
                          })
                        }
                        className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-300 font-black text-xs py-2 px-3 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                        title="Deletar permanentemente esta lista e todos os seus itens"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedPlaylists.length === 0 && playlistBundles.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center">
              <Tv className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <h3 className="font-black text-neutral-800 text-base mb-1">Nenhuma lista cadastrada</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
                Importe uma lista M3U/M3U8 ou cadastre canais avulsos para gerenciá-los aqui.
              </p>
              <button
                type="button"
                onClick={onOpenAddModal}
                className="bg-[#E50914] text-white font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer"
              >
                + Importar Lista M3U
              </button>
            </div>
          ) : (
            groupedPlaylists.map((pl) => {
              // Canais da lista filtrados pela pesquisa
              const q = searchQuery.toLowerCase().trim();
              const channelsInThisList = q
                ? pl.channels.filter(
                    (c) =>
                      c.name.toLowerCase().includes(q) ||
                      (c.group && c.group.toLowerCase().includes(q))
                  )
                : pl.channels;

              // Se a busca estiver ativa e a lista não tiver resultados, esconde ou avisa
              if (q && channelsInThisList.length === 0) {
                return null;
              }

              // Auto-expande se tiver pesquisa ativa
              const isExpanded = q ? true : !!expandedPlaylists[pl.name];

              // Quantidade de selecionados desta lista
              const selectedInThisList = pl.channels.filter((c) =>
                selectedChannelIds.has(c.id)
              );

              return (
                <div
                  key={pl.name}
                  className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs transition hover:border-neutral-300"
                >
                  {/* Cabeçalho da Lista / Card */}
                  <div
                    onClick={() => toggleExpandPlaylist(pl.name)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-neutral-50/50 hover:bg-neutral-100/60 border-b border-neutral-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-neutral-900 text-white rounded-xl">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#E50914]" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-neutral-950 text-sm sm:text-base">
                            {pl.name}
                          </h3>
                          <span className="text-[10px] font-black text-[#E50914] bg-red-50 border border-red-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {pl.channels.length} {pl.channels.length === 1 ? 'canal' : 'canais'}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {selectedInThisList.length > 0 ? (
                            <span className="text-red-600 font-bold">
                              {selectedInThisList.length} canais selecionados para exclusão
                            </span>
                          ) : (
                            'Clique para expandir e gerenciar canais individualmente'
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Ações da Lista Completa */}
                    <div
                      className="flex items-center gap-2 self-end sm:self-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onRequestDelete({
                            type: 'playlist',
                            playlistName: pl.name,
                            count: pl.channels.length,
                          })
                        }
                        className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-300 font-black text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                        title="Excluir a lista inteira e todos os canais pertencentes a ela"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Deletar Lista Completa</span>
                      </button>
                    </div>
                  </div>

                  {/* Detalhes / Canais dentro desta Lista quando Expandido */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5">
                      {/* Barra de Seleção em Massa desta Lista */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-100 p-2.5 rounded-xl mb-4 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => selectAllInList(channelsInThisList)}
                            className="font-bold text-neutral-700 hover:text-neutral-950 bg-white border border-neutral-300 px-2.5 py-1 rounded cursor-pointer"
                          >
                            Selecionar Todos ({channelsInThisList.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => deselectAllInList(channelsInThisList)}
                            className="font-bold text-neutral-700 hover:text-neutral-950 bg-white border border-neutral-300 px-2.5 py-1 rounded cursor-pointer"
                          >
                            Desmarcar
                          </button>
                          {selectedInThisList.length > 0 && (
                            <span className="font-extrabold text-[#E50914] ml-2">
                              {selectedInThisList.length} selecionados
                            </span>
                          )}
                        </div>

                        {selectedInThisList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSelected(pl.channels)}
                            className="bg-red-600 hover:bg-red-700 text-white font-black px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>
                              Excluir {selectedInThisList.length} Canais Selecionados desta Lista
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Tabela de Canais da Lista */}
                      <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                        {channelsInThisList.map((ch) => {
                          const isSelected = selectedChannelIds.has(ch.id);
                          return (
                            <div
                              key={ch.id}
                              className={`p-3 sm:px-4 flex items-center justify-between gap-3 transition ${
                                isSelected ? 'bg-red-50/70' : 'bg-white hover:bg-neutral-50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectChannel(ch.id)}
                                  className="w-4 h-4 accent-[#E50914] cursor-pointer shrink-0 rounded"
                                />

                                {/* Logo / Thumbnail */}
                                <div className="w-10 h-7 rounded bg-neutral-900 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                  {ch.logoUrl ? (
                                    <img
                                      src={ch.logoUrl}
                                      alt={ch.name}
                                      className="max-h-full max-w-full object-contain"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Tv className="w-3.5 h-3.5 text-neutral-400" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs font-black text-neutral-900 truncate">
                                    {ch.name}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                                    <span className="font-semibold">{ch.group}</span>
                                    <span>•</span>
                                    <span className="font-bold text-neutral-700 bg-neutral-100 px-1 py-0.2 rounded">
                                      {ch.quality || 'HD'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Ações por Canal */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onPlayChannel(ch)}
                                  title="Assistir Canal"
                                  className="p-1.5 text-neutral-700 hover:text-white bg-neutral-100 hover:bg-[#E50914] focus:bg-[#E50914] focus:text-white focus:ring-2 focus:ring-black rounded-lg transition cursor-pointer outline-none"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onToggleFavorite(ch.id)}
                                  title="Favoritar Canal"
                                  className="p-1.5 text-neutral-400 hover:text-amber-500 bg-neutral-100 hover:bg-neutral-200 focus:ring-2 focus:ring-amber-500 rounded-lg transition cursor-pointer outline-none"
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      ch.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditChannel(ch)}
                                  title="Editar Canal"
                                  className="p-1.5 text-neutral-600 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 focus:ring-2 focus:ring-neutral-900 rounded-lg transition cursor-pointer outline-none"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRequestDelete({
                                      type: 'single',
                                      channelId: ch.id,
                                      channelName: ch.name,
                                      count: 1,
                                    })
                                  }
                                  title="Excluir Canal (aviso no sistema)"
                                  className="p-1.5 text-red-600 hover:text-white bg-red-50 hover:bg-red-600 focus:bg-red-600 focus:text-white focus:ring-2 focus:ring-black rounded-lg transition cursor-pointer outline-none"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. ABA 2: TODOS OS CANAIS (LISTA GERAL DE TODOS OS CANAIS) */}
      {managerTab === 'allChannels' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          {/* Barra de Seleção em Massa Global */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-100 p-3 rounded-xl mb-4 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={selectAllGlobal}
                className="font-bold text-neutral-700 hover:text-neutral-950 bg-white border border-neutral-300 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Selecionar Todos ({queryFilteredChannels.length})
              </button>
              <button
                type="button"
                onClick={deselectAllGlobal}
                className="font-bold text-neutral-700 hover:text-neutral-950 bg-white border border-neutral-300 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Desmarcar Todos
              </button>
              {selectedChannelIds.size > 0 && (
                <span className="font-black text-[#E50914] ml-2">
                  {selectedChannelIds.size} selecionados no total
                </span>
              )}
            </div>

            {selectedChannelIds.size > 0 && (
              <button
                type="button"
                onClick={() => handleDeleteSelected()}
                className="bg-red-600 hover:bg-red-700 text-white font-black px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Canais Selecionados ({selectedChannelIds.size})</span>
              </button>
            )}
          </div>

          {/* Lista de Canais */}
          {queryFilteredChannels.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs">
              Nenhum canal corresponde aos critérios de pesquisa "{searchQuery}".
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
              {queryFilteredChannels.map((ch) => {
                const isSelected = selectedChannelIds.has(ch.id);
                return (
                  <div
                    key={ch.id}
                    className={`p-3 sm:px-4 flex items-center justify-between gap-3 transition ${
                      isSelected ? 'bg-red-50/70' : 'bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectChannel(ch.id)}
                        className="w-4 h-4 accent-[#E50914] cursor-pointer shrink-0 rounded"
                      />

                      {/* Logo / Thumbnail */}
                      <div className="w-10 h-7 rounded bg-neutral-900 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                        {ch.logoUrl ? (
                          <img
                            src={ch.logoUrl}
                            alt={ch.name}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-black text-neutral-900 truncate">{ch.name}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 flex-wrap">
                          <span className="font-semibold text-neutral-700">{ch.group}</span>
                          <span>•</span>
                          <span className="bg-neutral-100 text-neutral-600 px-1 py-0.2 rounded font-medium truncate max-w-[150px]">
                            {ch.playlistName || 'Canais Avulsos'}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-neutral-800 bg-neutral-200/80 px-1 py-0.2 rounded">
                            {ch.quality || 'HD'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações por Canal */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPlayChannel(ch)}
                        title="Assistir Canal"
                        className="p-1.5 text-neutral-700 hover:text-white bg-neutral-100 hover:bg-[#E50914] focus:bg-[#E50914] focus:text-white focus:ring-2 focus:ring-black rounded-lg transition cursor-pointer outline-none"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(ch.id)}
                        title="Favoritar Canal"
                        className="p-1.5 text-neutral-400 hover:text-amber-500 bg-neutral-100 hover:bg-neutral-200 focus:ring-2 focus:ring-amber-500 rounded-lg transition cursor-pointer outline-none"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            ch.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditChannel(ch)}
                        title="Editar Canal"
                        className="p-1.5 text-neutral-600 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 focus:ring-2 focus:ring-neutral-900 rounded-lg transition cursor-pointer outline-none"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRequestDelete({
                            type: 'single',
                            channelId: ch.id,
                            channelName: ch.name,
                            count: 1,
                          })
                        }
                        title="Excluir Canal (aviso no sistema)"
                        className="p-1.5 text-red-600 hover:text-white bg-red-50 hover:bg-red-600 focus:bg-red-600 focus:text-white focus:ring-2 focus:ring-black rounded-lg transition cursor-pointer outline-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
