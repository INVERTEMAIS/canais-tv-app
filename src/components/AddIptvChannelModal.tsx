import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Tv,
  List,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Film,
  Sparkles,
  Layers,
  ArrowRight,
  Globe,
  Radio,
  Clapperboard
} from 'lucide-react';
import { IptvChannel, IptvPlaylistBundle } from '../types/iptv';
import { MovieItem } from '../types/movies';
import { parseM3UPlaylist } from '../utils/iptvParser';
import { savePlaylistBundle } from '../utils/iptvStorage';
import { useModalArrowNavigation } from '../hooks/useModalArrowNavigation';

interface AddIptvChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChannel: (channel: IptvChannel, saveAlsoInMovies?: boolean) => void;
  onBatchAddChannels?: (channels: IptvChannel[], saveAlsoInMovies?: boolean) => void;
  onAddPlaylistBundle?: (bundle: IptvPlaylistBundle, saveAlsoInMovies?: boolean) => void;
  editingChannel?: IptvChannel | null;
}

const DEFAULT_GROUPS = [
  'Abertos',
  'Notícias',
  'Esportes',
  'Filmes & Séries',
  'Infantil',
  'Documentários',
  'Música',
  'Variedades',
  'Religiosos',
  'Internacionais',
];

export const AddIptvChannelModal: React.FC<AddIptvChannelModalProps> = ({
  isOpen,
  onClose,
  onAddChannel,
  onBatchAddChannels,
  onAddPlaylistBundle,
  editingChannel,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'playlist'>('single');

  // Estado para Link Unitário
  const [singleName, setSingleName] = useState(editingChannel ? editingChannel.name : '');
  const [singleUrl, setSingleUrl] = useState(editingChannel ? editingChannel.streamUrl : '');
  const [singleGroup, setSingleGroup] = useState(editingChannel ? editingChannel.group : 'Abertos');
  const [customGroup, setCustomGroup] = useState('');
  const [singleLogo, setSingleLogo] = useState(editingChannel ? editingChannel.logoUrl || '' : '');
  const [singleQuality, setSingleQuality] = useState<'4K' | 'FHD' | 'HD' | 'SD' | 'AUTO'>(
    editingChannel ? editingChannel.quality || 'AUTO' : 'AUTO'
  );
  const [saveAlsoInMovies, setSaveAlsoInMovies] = useState(false);

  // Estado para Lista M3U / M3U8
  const [playlistMode, setPlaylistMode] = useState<'url' | 'file' | 'text'>('url');
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistText, setPlaylistText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedLiveChannels, setParsedLiveChannels] = useState<IptvChannel[]>([]);
  const [parsedMovies, setParsedMovies] = useState<IptvChannel[]>([]);
  const [parsedSeries, setParsedSeries] = useState<IptvChannel[]>([]);
  const [parsedAll, setParsedAll] = useState<IptvChannel[]>([]);
  const [detectedGroups, setDetectedGroups] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importAlsoInMovies, setImportAlsoInMovies] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  useModalArrowNavigation({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    defaultFocusIndex: 0,
  });

  if (!isOpen) return null;

  // Submissão do Canal Unitário
  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim() || !singleUrl.trim()) {
      alert('Por favor, informe o Nome do Canal e o Link M3U8 de transmissão.');
      return;
    }

    const finalGroup = singleGroup === 'OUTRO' ? customGroup.trim() || 'Geral' : singleGroup;

    const channelData: IptvChannel = {
      id: editingChannel ? editingChannel.id : `ch_${Date.now()}`,
      name: singleName.trim(),
      streamUrl: singleUrl.trim(),
      group: finalGroup,
      logoUrl: singleLogo.trim() || undefined,
      quality: singleQuality,
      playlistName: editingChannel?.playlistName || 'Canais Avulsos',
      createdAt: editingChannel ? editingChannel.createdAt : Date.now(),
      isFavorite: editingChannel ? editingChannel.isFavorite : false,
      type: 'channel',
    };

    onAddChannel(channelData, saveAlsoInMovies);
    onClose();
  };

  const applyParseResult = (result: ReturnType<typeof parseM3UPlaylist>) => {
    if (result.all.length === 0) {
      setParseError('Nenhum canal, filme ou série válido foi detectado.');
      setParsedLiveChannels([]);
      setParsedMovies([]);
      setParsedSeries([]);
      setParsedAll([]);
      setDetectedGroups([]);
    } else {
      setParsedLiveChannels(result.channels);
      setParsedMovies(result.movies);
      setParsedSeries(result.series);
      setParsedAll(result.all);
      setDetectedGroups(result.groups);
      setParseError(null);
    }
  };

  // Carregar arquivo de lista .m3u / .m3u8
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const derivedTitle = file.name.replace(/\.(m3u8|m3u)$/i, '');
    if (!playlistTitle.trim()) {
      setPlaylistTitle(derivedTitle);
    }

    setIsParsing(true);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPlaylistText(text);
        const result = parseM3UPlaylist(text, undefined, derivedTitle);
        applyParseResult(result);
      }
      setIsParsing(false);
    };
    reader.onerror = () => {
      setParseError('Falha ao ler o arquivo de lista.');
      setIsParsing(false);
    };
    reader.readAsText(file);
  };

  // Analisar lista via URL com o Proxy backend para evitar bloqueio de CORS
  const handleFetchPlaylistFromUrl = async () => {
    if (!playlistUrl.trim()) {
      setParseError('Digite a URL da lista M3U ou M3U8.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParsedAll([]);

    try {
      let derivedTitle = playlistTitle.trim();
      if (!derivedTitle) {
        try {
          const parsed = new URL(playlistUrl.trim());
          derivedTitle = `Lista ${parsed.hostname}`;
          setPlaylistTitle(derivedTitle);
        } catch {
          derivedTitle = 'Lista M3U Remota';
        }
      }

      // Usa rota de proxy do backend Express
      const res = await fetch(`/api/proxy-m3u?url=${encodeURIComponent(playlistUrl.trim())}`);
      if (!res.ok) {
        throw new Error(`Erro ao baixar lista: Servidor respondeu com código ${res.status}`);
      }
      const text = await res.text();
      const result = parseM3UPlaylist(text, undefined, derivedTitle);
      applyParseResult(result);
    } catch (err: any) {
      setParseError(err.message || 'Falha ao baixar lista remota.');
    } finally {
      setIsParsing(false);
    }
  };

  // Analisar texto colado
  const handleParseText = () => {
    if (!playlistText.trim()) {
      setParseError('Cole o conteúdo da lista M3U no campo de texto.');
      return;
    }
    const derivedTitle = playlistTitle.trim() || 'Lista M3U Importada';
    const result = parseM3UPlaylist(playlistText, undefined, derivedTitle);
    applyParseResult(result);
  };

  // Finalizar importação em lote salvando como Pacote de Lista (Bundle)
  const handleFinalizeBatch = async () => {
    if (parsedAll.length === 0) return;
    const finalListName = playlistTitle.trim() || 'Lista M3U';
    const listId = `list_${Date.now()}`;

    const bundle: IptvPlaylistBundle = {
      id: listId,
      name: finalListName,
      sourceUrl: playlistUrl.trim() || undefined,
      importedAt: Date.now(),
      channelCount: parsedLiveChannels.length,
      movieCount: parsedMovies.length,
      seriesCount: parsedSeries.length,
      totalCount: parsedAll.length,
      channels: parsedLiveChannels.map((c) => ({
        ...c,
        type: 'channel' as const,
        playlistId: listId,
        playlistName: finalListName,
      })),
      movies: parsedMovies.map((c) => ({
        ...c,
        type: 'movie' as const,
        playlistId: listId,
        playlistName: finalListName,
      })),
      series: parsedSeries.map((c) => ({
        ...c,
        type: 'series' as const,
        playlistId: listId,
        playlistName: finalListName,
      })),
      groups: detectedGroups,
    };

    await savePlaylistBundle(bundle);

    if (onAddPlaylistBundle) {
      onAddPlaylistBundle(bundle, importAlsoInMovies);
    } else if (onBatchAddChannels) {
      onBatchAddChannels(parsedLiveChannels, importAlsoInMovies);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div ref={modalContainerRef} className="bg-white rounded-2xl max-w-2xl w-full border border-neutral-300 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="bg-neutral-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#E50914] rounded-lg">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-lg text-white">
                {editingChannel ? 'Editar Canal IPTV' : 'Cadastrar IPTV (Unitário ou Lista)'}
              </h2>
              <p className="text-xs text-neutral-400">
                Transmissões HLS (.m3u8), canais ao vivo e listas completas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-full hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas: Unitário vs Lista */}
        {!editingChannel && (
          <div className="flex border-b border-neutral-200 bg-neutral-100">
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`flex-1 py-3 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'single'
                  ? 'bg-white text-[#E50914] border-b-2 border-[#E50914] shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>Link Unitário (Canal Único)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('playlist')}
              className={`flex-1 py-3 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'playlist'
                  ? 'bg-white text-[#E50914] border-b-2 border-[#E50914] shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Importar Lista (.m3u / .m3u8)</span>
            </button>
          </div>
        )}

        {/* Conteúdo da Aba 1: Link Unitário */}
        {activeTab === 'single' && (
          <form onSubmit={handleSubmitSingle} className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider mb-1">
                Nome do Canal *
              </label>
              <input
                type="text"
                required
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="Ex: Globo SP HD, CNN Brasil, ESPN Ao Vivo..."
                className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:border-[#E50914] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider mb-1">
                Link de Transmissão (M3U8 / TS / Fluxo Direto) *
              </label>
              <input
                type="url"
                required
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                placeholder="https://exemplo.com/stream/playlist.m3u8"
                className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3.5 py-2 text-sm text-neutral-900 font-mono text-xs focus:outline-none focus:border-[#E50914] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider mb-1">
                  Categoria / Grupo
                </label>
                <select
                  value={singleGroup}
                  onChange={(e) => setSingleGroup(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-[#E50914]"
                >
                  {DEFAULT_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  <option value="OUTRO">+ Outra Categoria personalizada</option>
                </select>
                {singleGroup === 'OUTRO' && (
                  <input
                    type="text"
                    value={customGroup}
                    onChange={(e) => setCustomGroup(e.target.value)}
                    placeholder="Nome da Categoria personalizada"
                    className="w-full mt-2 bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-1.5 text-xs text-neutral-900"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider mb-1">
                  Qualidade do Sinal
                </label>
                <select
                  value={singleQuality}
                  onChange={(e) => setSingleQuality(e.target.value as any)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-[#E50914]"
                >
                  <option value="AUTO">Automática (HLS adaptativo)</option>
                  <option value="4K">4K Ultra HD</option>
                  <option value="FHD">Full HD 1080p</option>
                  <option value="HD">HD 720p</option>
                  <option value="SD">SD Padrão</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider mb-1">
                URL da Logomarca do Canal (Opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={singleLogo}
                  onChange={(e) => setSingleLogo(e.target.value)}
                  placeholder="https://exemplo.com/logo-canal.png"
                  className="flex-1 bg-neutral-50 border border-neutral-300 rounded-lg px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:border-[#E50914] focus:bg-white"
                />
                {singleLogo && (
                  <img
                    src={singleLogo}
                    alt="Logo Preview"
                    className="w-9 h-9 object-contain bg-neutral-100 rounded border border-neutral-300 p-0.5"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
            </div>

            {/* Opção Solicitada: Usar junto ao catálogo de Filmes ou separado */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
              <input
                type="checkbox"
                id="saveAlsoInMovies"
                checked={saveAlsoInMovies}
                onChange={(e) => setSaveAlsoInMovies(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#E50914] cursor-pointer"
              />
              <label htmlFor="saveAlsoInMovies" className="text-xs text-neutral-800 cursor-pointer">
                <span className="font-extrabold text-[#E50914] block">
                  Usar junto ao catálogo de Filmes MP4
                </span>
                Se marcado, este canal também aparecerá na aba Filmes (ideal para canais 24h de filmes, séries ou filmes que usam transmissão .m3u8).
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-[#E50914] hover:bg-red-700 text-white font-black text-xs px-6 py-2.5 rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{editingChannel ? 'Salvar Alterações' : 'Cadastrar Canal'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Conteúdo da Aba 2: Importar Lista M3U / M3U8 */}
        {activeTab === 'playlist' && (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Nome da Lista para Identificação e Gerenciamento */}
            <div>
              <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider mb-1">
                Nome da Lista (Identificação para Gerenciar e Deletar)
              </label>
              <input
                type="text"
                value={playlistTitle}
                onChange={(e) => setPlaylistTitle(e.target.value)}
                placeholder="Ex: Lista Canais Brasil, Esportes Premium, Lista TV..."
                className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:border-[#E50914] focus:bg-white"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Facilita encontrar a lista e todos os seus canais para assistir ou deletar no Gerenciador.
              </p>
            </div>

            {/* Seletor de Modo de Lista */}
            <div className="grid grid-cols-3 gap-2 bg-neutral-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPlaylistMode('url')}
                className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  playlistMode === 'url' ? 'bg-white text-[#E50914] shadow-xs' : 'text-neutral-600'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Link / URL</span>
              </button>
              <button
                type="button"
                onClick={() => setPlaylistMode('file')}
                className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  playlistMode === 'file' ? 'bg-white text-[#E50914] shadow-xs' : 'text-neutral-600'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Arquivo .m3u</span>
              </button>
              <button
                type="button"
                onClick={() => setPlaylistMode('text')}
                className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  playlistMode === 'text' ? 'bg-white text-[#E50914] shadow-xs' : 'text-neutral-600'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Colar Texto</span>
              </button>
            </div>

            {/* Modo URL */}
            {playlistMode === 'url' && (
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider">
                  URL da Lista IPTV Remota (.m3u / .m3u8)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    placeholder="https://exemplo.com/lista.m3u"
                    className="flex-1 bg-neutral-50 border border-neutral-300 rounded-lg px-3.5 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-[#E50914]"
                  />
                  <button
                    type="button"
                    disabled={isParsing || !playlistUrl.trim()}
                    onClick={handleFetchPlaylistFromUrl}
                    className="bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-bold text-xs px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {isParsing ? 'Baixando...' : 'Carregar'}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Nosso servidor intermediário no Node.js faz o download para contornar qualquer restrição de CORS da lista remota.
                </p>
              </div>
            )}

            {/* Modo Arquivo */}
            {playlistMode === 'file' && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".m3u,.m3u8,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-300 hover:border-[#E50914] bg-neutral-50 hover:bg-red-50/20 rounded-xl p-6 text-center cursor-pointer transition"
                >
                  <Upload className="w-8 h-8 text-[#E50914] mx-auto mb-2" />
                  <p className="font-extrabold text-sm text-neutral-800">
                    Clique para selecionar arquivo .M3U ou .M3U8
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Suporta arquivos exportados de qualquer provedor IPTV ou lista salva no computador/celular.
                  </p>
                </div>
              </div>
            )}

            {/* Modo Texto */}
            {playlistMode === 'text' && (
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-neutral-700 tracking-wider">
                  Cole o Conteúdo M3U / M3U8
                </label>
                <textarea
                  rows={4}
                  value={playlistText}
                  onChange={(e) => setPlaylistText(e.target.value)}
                  placeholder={`#EXTM3U\n#EXTINF:-1 tvg-logo="..." group-title="Abertos",Globo HD\nhttps://stream.exemplo.com/live.m3u8`}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 font-mono text-[11px] text-neutral-900 focus:outline-none focus:border-[#E50914]"
                />
                <button
                  type="button"
                  onClick={handleParseText}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Processar Texto
                </button>
              </div>
            )}

            {/* Erro no Parse */}
            {parseError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Resultado do Parse com Separação: Canais, Filmes e Séries */}
            {parsedAll.length > 0 && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-black text-sm text-neutral-900">
                      {parsedAll.length} itens identificados na lista!
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded">
                    {detectedGroups.length} categorias
                  </span>
                </div>

                {/* Separação Visual Solicitada pelo Usuário */}
                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="bg-white border border-neutral-300 rounded-lg p-2.5 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-[#E50914] mb-1">
                      <Radio className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase">Canais</span>
                    </div>
                    <p className="text-base font-black text-neutral-900">{parsedLiveChannels.length}</p>
                    <p className="text-[9px] text-neutral-500 font-bold">Ao Vivo</p>
                  </div>

                  <div className="bg-white border border-neutral-300 rounded-lg p-2.5 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                      <Film className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase">Filmes</span>
                    </div>
                    <p className="text-base font-black text-neutral-900">{parsedMovies.length}</p>
                    <p className="text-[9px] text-neutral-500 font-bold">VOD / Cinema</p>
                  </div>

                  <div className="bg-white border border-neutral-300 rounded-lg p-2.5 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                      <Clapperboard className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase">Séries</span>
                    </div>
                    <p className="text-base font-black text-neutral-900">{parsedSeries.length}</p>
                    <p className="text-[9px] text-neutral-500 font-bold">Episódios</p>
                  </div>
                </div>

                <div className="p-2.5 bg-neutral-100 rounded-lg text-[11px] text-neutral-600 font-medium">
                  💡 <strong>Catálogo Leve Estilo Netflix:</strong> A lista será salva como cartão agrupado no catálogo IPTV. Ao clicar nela, você poderá escolher entre <strong>Canais</strong>, <strong>Filmes</strong> ou <strong>Séries</strong> e dar play automático sem sobrecarregar o app!
                </div>

                {/* Opção: Usar junto ou separado do catálogo de filmes */}
                {parsedMovies.length > 0 && (
                  <div className="pt-2 border-t border-neutral-200">
                    <label className="flex items-start gap-2.5 text-xs text-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importAlsoInMovies}
                        onChange={(e) => setImportAlsoInMovies(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#E50914] cursor-pointer"
                      />
                      <span>
                        <strong className="text-neutral-900">
                          Sincronizar os {parsedMovies.length} filmes também com o catálogo da aba Filmes
                        </strong>
                        <br />
                        <span className="text-neutral-500">
                          Os filmes aparecerão na aba de Filmes com capas e detalhes para fácil reprodução.
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {/* Botão de Conclusão */}
                <button
                  type="button"
                  onClick={handleFinalizeBatch}
                  className="w-full bg-[#E50914] hover:bg-red-700 text-white font-black py-2.5 rounded-full flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Salvar Lista no Catálogo ({parsedAll.length} itens separados)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
