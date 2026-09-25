import React, { useState, useEffect, useRef } from 'react';
import { Play, Search, Maximize, Edit2, Trash2, Plus, Star, Tv, ShieldCheck, RotateCw, AlertTriangle } from 'lucide-react';
import { Channel, AdBlockMode } from '../types';
import { ChannelLogoBadge } from './ChannelLogoBadge';
import { sortChannelsAlphabetically } from '../utils/defaultChannels';
import { getStoredPlayerMode, savePlayerMode, getSandboxAttribute } from '../utils/playerSecurity';

interface LiveChannelsSidebarViewProps {
  channels: Channel[];
  activeChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onEditChannel?: (channel: Channel) => void;
  onDeleteChannel?: (id: string, name: string) => void;
  onAddNewChannel?: () => void;
  isTVMode?: boolean;
}

export const LiveChannelsSidebarView: React.FC<LiveChannelsSidebarViewProps> = ({
  channels,
  activeChannel,
  onSelectChannel,
  onToggleFavorite,
  onEditChannel,
  onDeleteChannel,
  onAddNewChannel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(() => {
    const sorted = sortChannelsAlphabetically(channels);
    return activeChannel || sorted[0] || null;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [playerMode, setPlayerMode] = useState<AdBlockMode>(() => getStoredPlayerMode());
  const [playerReloadKey, setPlayerReloadKey] = useState<number>(0);
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const channelListRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cyclePlayerMode = () => {
    let next: AdBlockMode = 'direct';
    if (playerMode === 'direct') next = 'standard';
    else if (playerMode === 'standard') next = 'strict';
    else next = 'direct';

    setPlayerMode(next);
    savePlayerMode(next);
    setPlayerReloadKey((k) => k + 1);

    const msg =
      next === 'direct'
        ? 'Modo Direto Ativado (Sem restrição de frame - Recomendado RedeCanais)'
        : next === 'standard'
        ? 'Modo Tolerante Ativado (Sandbox com Popups)'
        : 'Modo Estrito Ativado (Sandbox Sem Popups)';
    setModeNotice(msg);
    setTimeout(() => setModeNotice(null), 3500);
  };

  // Sempre mantém os canais ordenados por ordem alfabética (A-Z)
  const sortedChannels = sortChannelsAlphabetically(channels);

  // Atualiza canal selecionado se activeChannel mudar externamente
  useEffect(() => {
    if (activeChannel) {
      setSelectedChannel(activeChannel);
      setIsPlaying(true);
    } else if (!selectedChannel && sortedChannels.length > 0) {
      setSelectedChannel(sortedChannels[0]);
    }
  }, [activeChannel, sortedChannels]);

  // Filtra canais pela busca digitada (sem categoria)
  const filteredChannels = sortedChannels.filter((ch) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      ch.name.toLowerCase().includes(query) ||
      (ch.canalCode && ch.canalCode.toLowerCase().includes(query))
    );
  });

  // Garante foco visível ao navegar
  useEffect(() => {
    if (filteredChannels.length > 0 && focusedIndex < filteredChannels.length) {
      const el = itemRefs.current[focusedIndex];
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, filteredChannels.length]);

  const handleChannelClick = (ch: Channel, index: number) => {
    setSelectedChannel(ch);
    setFocusedIndex(index);
    setIsPlaying(true);
    onSelectChannel(ch);
  };

  const handleToggleFullscreen = () => {
    const playerContainer = document.getElementById('main-video-player-container');
    if (!playerContainer) return;

    if (!document.fullscreenElement) {
      playerContainer.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full w-full bg-[#000000] text-white overflow-hidden select-none">
      {/* LEFT COLUMN: Main Channel Screen / Player */}
      <div
        id="main-video-player-container"
        className="flex-1 flex flex-col bg-black relative min-h-[280px] justify-center items-center overflow-hidden"
      >
        {selectedChannel ? (
          isPlaying ? (
            /* Active Playing Channel with Anti-Ad Protections */
            <div className="relative w-full h-full flex flex-col justify-between bg-black">
              {/* Feedback toast de troca de modo */}
              {modeNotice && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-neutral-900/95 border border-cyan-500/80 text-cyan-300 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-fade-in">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{modeNotice}</span>
                </div>
              )}

              {/* Iframe do Canal com Suporte a Anti-Bloqueio RedeCanais */}
              <iframe
                key={`${selectedChannel.id}-${playerReloadKey}-${playerMode}`}
                name="Player"
                title={selectedChannel.name}
                src={selectedChannel.streamUrl}
                sandbox={getSandboxAttribute(playerMode)}
                frameBorder="0"
                scrolling="no"
                allow="encrypted-media *; autoplay *; fullscreen *; picture-in-picture *; accelerometer *; gyroscope *"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full flex-1 border-0 bg-black"
              />

              {/* Banner de Ajuda caso o usuário caia no detector do RedeCanais */}
              {playerMode !== 'direct' && (
                <div className="absolute bottom-2 inset-x-2 z-40 bg-amber-950/95 border border-amber-500/80 text-amber-200 px-3 py-2 rounded-xl flex items-center justify-between text-xs backdrop-blur-md shadow-2xl">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Viu <strong>"Página Bloqueada"</strong> do RedeCanais?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPlayerMode('direct');
                      savePlayerMode('direct');
                      setPlayerReloadKey((k) => k + 1);
                      setModeNotice('Modo Direto Ativado: 100% livre do bloqueio do RedeCanais');
                      setTimeout(() => setModeNotice(null), 3500);
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition cursor-pointer"
                  >
                    Liberar Player Agora
                  </button>
                </div>
              )}

              {/* Floating Overlays on hover/tap */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none transition-opacity opacity-0 hover:opacity-100 focus-within:opacity-100 z-30">
                <div className="bg-black/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-neutral-800 pointer-events-auto flex items-center gap-2.5 shadow-xl">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    {selectedChannel.name}
                  </span>
                  {selectedChannel.canalCode && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-cyan-300">
                      canal={selectedChannel.canalCode}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  {/* Seletor de Modo Anti-Bloqueio */}
                  <button
                    type="button"
                    onClick={cyclePlayerMode}
                    title="Alternar entre Modo Direto (Sem bloqueio RedeCanais), Tolerante ou Estrito"
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      playerMode === 'direct'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                        : playerMode === 'standard'
                        ? 'bg-amber-950/90 text-amber-300 border-amber-600 hover:bg-amber-900'
                        : 'bg-red-950/90 text-red-300 border-red-600 hover:bg-red-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>
                      {playerMode === 'direct'
                        ? 'Anti-Bloqueio: DIRETO'
                        : playerMode === 'standard'
                        ? 'Modo: TOLERANTE'
                        : 'Modo: ESTRITO'}
                    </span>
                  </button>

                  {/* Botão Recarregar Player */}
                  <button
                    type="button"
                    onClick={() => setPlayerReloadKey((k) => k + 1)}
                    title="Recarregar player se travar"
                    className="p-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 transition cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {onEditChannel && (
                    <button
                      type="button"
                      onClick={() => onEditChannel(selectedChannel)}
                      title="Editar este canal"
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Editar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPlaying(false)}
                    title="Exibir arte do canal"
                    className="px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-bold transition cursor-pointer"
                  >
                    Pausar
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    title="Tela Cheia Total da TV"
                    className="p-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 transition cursor-pointer"
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Standby Screen matching user's screenshot (No category badge) */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-black relative">
              <div className="relative flex flex-col items-center justify-center">
                {/* Large Channel Art */}
                <div className="mb-4">
                  <ChannelLogoBadge name={selectedChannel.name} logoUrl={selectedChannel.logoUrl} size="hero" />
                </div>

                {/* Big Triangular Play Button */}
                <button
                  type="button"
                  id="btn-play-selected-channel"
                  onClick={() => setIsPlaying(true)}
                  title={`Assistir ${selectedChannel.name} agora`}
                  className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 shadow-2xl cursor-pointer ring-4 ring-transparent focus:ring-white"
                >
                  <Play className="w-12 h-12 md:w-14 md:h-14 text-white fill-white ml-2" />
                </button>

                <div className="mt-6 flex items-center gap-3">
                  <span className="text-xl md:text-2xl font-black text-white tracking-tight">
                    {selectedChannel.name}
                  </span>
                  {selectedChannel.canalCode && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-cyan-300">
                      canal={selectedChannel.canalCode}
                    </span>
                  )}
                </div>

                {/* Seletor de Modo Anti-Bloqueio na tela inicial */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cyclePlayerMode}
                    title="Alternar modo do player antes de iniciar"
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      playerMode === 'direct'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                        : playerMode === 'standard'
                        ? 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900'
                        : 'bg-red-950 text-red-300 border-red-700 hover:bg-red-900'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>
                      {playerMode === 'direct'
                        ? 'Anti-Bloqueio: Modo Direto (Sem restrição de tela)'
                        : playerMode === 'standard'
                        ? 'Modo: Tolerante'
                        : 'Modo: Estrito'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                {onEditChannel && (
                  <button
                    type="button"
                    onClick={() => onEditChannel(selectedChannel)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Editar Canal</span>
                  </button>
                )}
                {onDeleteChannel && (
                  <button
                    type="button"
                    onClick={() => onDeleteChannel(selectedChannel.id, selectedChannel.name)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-red-950/40 border border-neutral-800 hover:border-red-800 text-xs font-semibold text-neutral-400 hover:text-red-300 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Excluir Canal</span>
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="text-center text-neutral-500 p-8 space-y-3">
            <Tv className="w-12 h-12 mx-auto text-neutral-700" />
            <p className="text-base font-semibold text-neutral-300">Nenhum canal cadastrado.</p>
            {onAddNewChannel && (
              <button
                type="button"
                onClick={onAddNewChannel}
                className="px-4 py-2 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Cadastrar Canal
              </button>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Channels Sidebar (Sorted Alphabetically, No Category, Instant Edit/Delete) */}
      <div className="w-full md:w-[350px] lg:w-[390px] flex flex-col bg-[#050505] border-t md:border-t-0 md:border-l border-[#1a1a1a] shrink-0 h-full overflow-hidden">
        {/* Search Bar + Add Channel Button */}
        <div className="w-full shrink-0 border-b border-[#1f1f1f] flex items-center bg-white">
          <div className="relative flex-1">
            <input
              type="text"
              id="input-buscar-canal"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder="Buscar Canal (A-Z)"
              className="w-full bg-white text-gray-900 placeholder:text-gray-500 font-normal px-4 py-3 text-sm focus:outline-none focus:ring-0 border-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 text-xs font-bold px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            )}
          </div>

          {onAddNewChannel && (
            <button
              type="button"
              onClick={onAddNewChannel}
              title="Salvar Novo Canal"
              className="px-3 py-3 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 border-l border-neutral-300"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Canal</span>
            </button>
          )}
        </div>

        {/* Channels Alphabetical Vertical Scrollable List */}
        <div
          ref={channelListRef}
          className="flex-1 overflow-y-auto divide-y divide-[#161616] scroll-smooth overscroll-contain"
        >
          {filteredChannels.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs">
              Nenhum canal encontrado com o termo "{searchQuery}".
            </div>
          ) : (
            filteredChannels.map((ch, idx) => {
              const isSelected = selectedChannel?.id === ch.id;
              const isFocused = focusedIndex === idx;

              return (
                <div
                  key={ch.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  onClick={() => handleChannelClick(ch, idx)}
                  className={`flex items-center justify-between py-2.5 px-3 transition-all cursor-pointer select-none group ${
                    isSelected
                      ? 'bg-[#181818] ring-1 ring-neutral-600'
                      : isFocused
                      ? 'bg-[#141414] ring-1 ring-white/50'
                      : 'bg-[#050505] hover:bg-[#121212]'
                  }`}
                >
                  {/* Column 1: Logo Badge */}
                  <div className="shrink-0 mr-3">
                    <ChannelLogoBadge name={ch.name} logoUrl={ch.logoUrl} size="md" />
                  </div>

                  {/* Column 2: Channel Name & canalCode */}
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-gray-100 group-hover:text-white font-medium text-sm md:text-base truncate">
                      {ch.name}
                    </p>
                    {ch.canalCode && (
                      <p className="text-[10px] font-mono text-cyan-400/80 truncate">
                        canal={ch.canalCode}
                      </p>
                    )}
                  </div>

                  {/* Column 3: Edit, Delete, Favorite buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Botão de Editar Canal */}
                    {onEditChannel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditChannel(ch);
                        }}
                        title={`Editar canal ${ch.name}`}
                        className="p-1.5 rounded text-neutral-500 hover:text-cyan-400 hover:bg-neutral-800 transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Botão de Excluir Canal */}
                    {onDeleteChannel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChannel(ch.id, ch.name);
                        }}
                        title={`Excluir canal ${ch.name}`}
                        className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Botão Favoritar */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(ch.id, e);
                      }}
                      title={ch.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      className={`p-1.5 rounded transition ${
                        ch.isFavorite ? 'text-amber-400' : 'text-neutral-600 hover:text-neutral-400'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${ch.isFavorite ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

