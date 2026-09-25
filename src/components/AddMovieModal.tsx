import React, { useState, useRef } from 'react';
import { X, Plus, AlertCircle, Link as LinkIcon, ShieldAlert, Globe, Zap } from 'lucide-react';
import { MovieCategory, MovieItem } from '../types/movies';
import { NETFLIX_PALETTES } from '../utils/moviesCatalogStorage';
import { useModalArrowNavigation } from '../hooks/useModalArrowNavigation';

const CATEGORIES: MovieCategory[] = [
  'Ação',
  'Ficção & Fantasia',
  'Comédia',
  'Drama',
  'Terror & Suspense',
  'Animação',
  'Documentário',
];

interface AddMovieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMovie: (movie: MovieItem) => void;
  editingMovie?: MovieItem | null;
  onUpdateMovie?: (movie: MovieItem) => void;
}

export const AddMovieModal: React.FC<AddMovieModalProps> = ({
  isOpen,
  onClose,
  onAddMovie,
  editingMovie,
  onUpdateMovie,
}) => {
  const [title, setTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [sourcePageUrl, setSourcePageUrl] = useState('');
  const [category, setCategory] = useState<MovieCategory>('Ação');
  const [duration, setDuration] = useState('1h 50m');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [synopsis, setSynopsis] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sincroniza campos quando o filme para edição mudar ou o modal abrir
  React.useEffect(() => {
    if (editingMovie) {
      setTitle(editingMovie.title || '');
      setStreamUrl(editingMovie.streamUrl || '');
      setSourcePageUrl(editingMovie.sourcePageUrl || '');
      setCategory((editingMovie.category as MovieCategory) || 'Ação');
      setDuration(editingMovie.duration || '1h 50m');
      setYear(editingMovie.year ? editingMovie.year.toString() : new Date().getFullYear().toString());
      setSynopsis(editingMovie.synopsis || '');
    } else {
      setTitle('');
      setStreamUrl('');
      setSourcePageUrl('');
      setCategory('Ação');
      setDuration('1h 50m');
      setYear(new Date().getFullYear().toString());
      setSynopsis('');
    }
    setError(null);
  }, [editingMovie, isOpen]);

  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // Navegação Universal por Setas no Modal (ArrowUp / ArrowDown / ArrowLeft / ArrowRight / ESC)
  useModalArrowNavigation({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    defaultFocusIndex: 0,
  });

  // Detector de Token de Expiração para links HTTP/MP4
  const detectedToken = React.useMemo(() => {
    if (!streamUrl) return null;
    try {
      const url = new URL(streamUrl);
      for (const [key, value] of url.searchParams.entries()) {
        if (
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('sig') ||
          key.toLowerCase().includes('auth') ||
          key.includes('nu3zAQc9') ||
          value.includes('%') ||
          value.length > 25
        ) {
          return { key, value };
        }
      }
    } catch {
      if (streamUrl.includes('nu3zAQc9HC3GbwJq=')) {
        return { key: 'nu3zAQc9HC3GbwJq', value: 'Detectado Token Temporário' };
      }
    }
    return null;
  }, [streamUrl]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Informe o nome do filme.');
      return;
    }
    if (!streamUrl.trim()) {
      setError('Cole o link direto do vídeo (.mp4).');
      return;
    }

    const randomPalette = NETFLIX_PALETTES[Math.floor(Math.random() * NETFLIX_PALETTES.length)];

    if (editingMovie && onUpdateMovie) {
      const updated: MovieItem = {
        ...editingMovie,
        title: title.trim(),
        streamUrl: streamUrl.trim(),
        sourcePageUrl: sourcePageUrl.trim() || undefined,
        category,
        duration: duration.trim() || '1h 50m',
        year: parseInt(year, 10) || new Date().getFullYear(),
        synopsis: synopsis.trim() || 'Filme cadastrado no catálogo NetPlay.',
      };
      onUpdateMovie(updated);
      onClose();
      return;
    }

    const newMovie: MovieItem = {
      id: `movie_${Date.now()}`,
      title: title.trim(),
      streamUrl: streamUrl.trim(),
      sourcePageUrl: sourcePageUrl.trim() || undefined,
      category,
      duration: duration.trim() || '1h 50m',
      year: parseInt(year, 10) || new Date().getFullYear(),
      synopsis: synopsis.trim() || 'Filme cadastrado no catálogo NetPlay.',
      tokenParamKey: detectedToken?.key,
      backdropColor: randomPalette.bg,
      accentColor: randomPalette.accent,
      createdAt: Date.now(),
    };

    onAddMovie(newMovie);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div ref={modalContainerRef} className="bg-white border-2 border-neutral-300 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header em Fundo Branco com Alto Contraste */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-6 bg-[#E50914] rounded-xs shadow-[0_0_6px_#E50914]" />
            <h2 className="text-base font-black tracking-wide text-neutral-950 uppercase font-['Outfit']">
              {editingMovie ? 'Atualizar Link / Filme' : 'Cadastrar Filme MP4'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body em Fundo Branco e Controles Claros */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-500 text-red-700 rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome do Filme */}
          <div>
            <label className="block text-neutral-900 font-extrabold mb-1.5 uppercase tracking-wider text-[11px]">
              Nome do Filme *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Gladiador II, Velozes & Furiosos..."
              className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl px-3.5 py-2.5 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-[#E50914] text-sm font-bold"
              required
            />
            <p className="text-[10px] text-neutral-500 mt-1 font-medium">
              O design cria automaticamente o card tipográfico de alto contraste com o nome do filme.
            </p>
          </div>

          {/* Link MP4 ou M3U8 do Vídeo */}
          <div>
            <label className="block text-neutral-900 font-extrabold mb-1.5 uppercase tracking-wider text-[11px]">
              Link de Transmissão (MP4 ou HLS .M3U8) *
            </label>
            <div className="relative">
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://.../video.mp4 ou https://.../playlist.m3u8"
                className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl pl-9 pr-3.5 py-2.5 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-[#E50914] font-mono text-[11px]"
                required
              />
              <LinkIcon className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            </div>

            {/* Aviso Inteligente Anti-Expiração de Token para links HTTP */}
            {detectedToken && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#E50914] mt-0.5" />
                <div>
                  <span className="font-extrabold text-[#E50914]">Token de Segurança Detectado:</span> O link contém parâmetros de autorização ({detectedToken.key}). Se o link expirar no futuro, basta abrir aqui e trocar a URL para revalidar!
                </div>
              </div>
            )}
          </div>

          {/* Página de Origem do Filme (Auto-Renovação Anti-Expiração) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-neutral-900 font-extrabold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#E50914]" />
                Página de Origem do Filme (Auto-Renovação)
              </label>
              <span className="text-[10px] text-neutral-500 font-bold bg-neutral-100 px-2 py-0.5 rounded-full">
                Opcional Recomendado
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={sourcePageUrl}
                onChange={(e) => setSourcePageUrl(e.target.value)}
                placeholder="https://redecanais.la/filme-exemplo ou /filme-exemplo"
                className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl pl-9 pr-3.5 py-2.5 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-[#E50914] font-mono text-[11px]"
              />
              <Globe className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            </div>
            <p className="text-[10px] text-neutral-500 mt-1 font-medium">
              ⚡ Se o token do .mp4 expirar no servidor, o NetPlay usará este link para buscar o novo token automaticamente em segundo plano.
            </p>
          </div>

          {/* Categoria & Ano */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-900 font-extrabold mb-1.5 uppercase tracking-wider text-[11px]">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MovieCategory)}
                className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:bg-white focus:border-[#E50914] cursor-pointer font-bold"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-neutral-900 font-extrabold mb-1.5 uppercase tracking-wider text-[11px]">
                Ano de Lançamento
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:bg-white focus:border-[#E50914] font-bold"
              />
            </div>
          </div>

          {/* Duração & Sinopse */}
          <div>
            <label className="block text-neutral-900 font-extrabold mb-1.5 uppercase tracking-wider text-[11px]">
              Duração
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex: 2h 15m"
              className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:bg-white focus:border-[#E50914] font-bold"
            />
          </div>

          <div>
            <label className="block text-neutral-900 font-extrabold mb-1.5 uppercase tracking-wider text-[11px]">
              Sinopse do Filme
            </label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={2}
              placeholder="Descreva brevemente a história do filme..."
              className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl px-3.5 py-2 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-[#E50914] font-medium"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold transition cursor-pointer border border-neutral-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-black tracking-wide transition cursor-pointer flex items-center gap-2 shadow-md shadow-red-500/30 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {editingMovie ? 'Salvar Alterações' : 'Cadastrar no Catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
