import React, { useState, useEffect } from 'react';
import {
  Play,
  Save,
  Trash2,
  Settings,
  Film,
  Maximize,
  RotateCcw,
  Sparkles,
  ClipboardPaste,
  Tv,
  Check,
  AlertCircle
} from 'lucide-react';
import { SavedMovie } from '../types';
import {
  getStoredMovieTemplate,
  saveStoredMovieTemplate,
  loadSavedMovies,
  saveMoviesList,
  buildMovieStreamUrl,
  parseServerAndVidFromText,
  DEFAULT_MOVIE_IFRAME_TEMPLATE
} from '../utils/movieStorage';

interface MoviesOnDemandViewProps {
  onTvFocusChange?: () => void;
}

export const MoviesOnDemandView: React.FC<MoviesOnDemandViewProps> = () => {
  const [movies, setMovies] = useState<SavedMovie[]>(() => loadSavedMovies());
  const [server, setServer] = useState<string>('RCServer27');
  const [vid, setVid] = useState<string>('DY');
  const [title, setTitle] = useState<string>('Exemplo On Demand');

  const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(null);
  const [activeMovieTitle, setActiveMovieTitle] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Template config modal/collapse
  const [showTemplateConfig, setShowTemplateConfig] = useState<boolean>(false);
  const [customTemplate, setCustomTemplate] = useState<string>(() => getStoredMovieTemplate());
  const [templateSavedFeedback, setTemplateSavedFeedback] = useState<boolean>(false);

  // Direct paste helper
  const [pasteInput, setPasteInput] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load default on startup
  useEffect(() => {
    if (movies.length > 0 && !activeStreamUrl) {
      const first = movies[0];
      setServer(first.server);
      setVid(first.vid);
      setTitle(first.title);
    }
  }, [movies, activeStreamUrl]);

  const handlePlayCurrent = (overrideServer?: string, overrideVid?: string, overrideTitle?: string) => {
    const s = (overrideServer || server).trim();
    const v = (overrideVid || vid).trim();
    const t = (overrideTitle || title).trim() || `Vídeo ${s} - ${v}`;

    if (!s || !v) {
      setStatusMessage('Por favor preencha os campos Server e VID');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    const url = buildMovieStreamUrl(s, v, customTemplate);
    setActiveStreamUrl(url);
    setActiveMovieTitle(t);
    setIsPlaying(true);
  };

  const handleSaveCurrent = () => {
    const s = server.trim();
    const v = vid.trim();
    const t = title.trim() || `Vídeo ${s} - ${v}`;

    if (!s || !v) {
      setStatusMessage('Preencha Server e VID antes de salvar.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    // Verifica se já existe com mesmo server e vid
    const existingIndex = movies.findIndex((m) => m.server === s && m.vid === v);
    let updated: SavedMovie[];

    if (existingIndex >= 0) {
      updated = [...movies];
      updated[existingIndex] = {
        ...updated[existingIndex],
        title: t,
        createdAt: Date.now(),
      };
      setStatusMessage('Filme/Vídeo atualizado com sucesso!');
    } else {
      const newMovie: SavedMovie = {
        id: `movie-${Date.now()}`,
        title: t,
        server: s,
        vid: v,
        createdAt: Date.now(),
      };
      updated = [newMovie, ...movies];
      setStatusMessage('Filme/Vídeo salvo na lista!');
    }

    setMovies(updated);
    saveMoviesList(updated);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeleteMovie = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = movies.filter((m) => m.id !== id);
    setMovies(updated);
    saveMoviesList(updated);
  };

  const handleSaveTemplate = () => {
    saveStoredMovieTemplate(customTemplate);
    setTemplateSavedFeedback(true);
    setTimeout(() => setTemplateSavedFeedback(false), 2500);
  };

  const handleResetTemplate = () => {
    setCustomTemplate(DEFAULT_MOVIE_IFRAME_TEMPLATE);
    saveStoredMovieTemplate(DEFAULT_MOVIE_IFRAME_TEMPLATE);
    setTemplateSavedFeedback(true);
    setTimeout(() => setTemplateSavedFeedback(false), 2500);
  };

  const handleExtractFromPaste = (text: string) => {
    setPasteInput(text);
    const extracted = parseServerAndVidFromText(text);
    if (extracted) {
      setServer(extracted.server);
      setVid(extracted.vid);
      setStatusMessage(`Extraído: Server=${extracted.server} e VID=${extracted.vid}`);
      setTimeout(() => setStatusMessage(null), 3500);
    } else if (text.trim().length > 0) {
      setStatusMessage('Não foi possível detectar server= e vid= no texto colado.');
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full bg-[#050505] text-white overflow-hidden select-none">
      {/* LEFT / TOP AREA: Video Player or Preview Screen */}
      <div className="flex-1 flex flex-col bg-black relative min-h-[300px] border-b md:border-b-0 md:border-r border-[#1a1a1a]">
        {isPlaying && activeStreamUrl ? (
          <div className="relative w-full h-full flex flex-col justify-between bg-black">
            {/* Embedded Iframe Player */}
            <iframe
              key={activeStreamUrl}
              name="MoviePlayer"
              title={activeMovieTitle || 'Filme On Demand'}
              src={activeStreamUrl}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              frameBorder="0"
              scrolling="no"
              allow="encrypted-media; autoplay; fullscreen; picture-in-picture; accelerometer; gyroscope"
              allowFullScreen
              className="w-full h-full flex-1 border-0"
            />

            {/* Floating Quick Bar for TV */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-neutral-800 pointer-events-auto flex items-center gap-2 shadow-lg">
                <Film className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white truncate max-w-xs md:max-w-md">
                  {activeMovieTitle}
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-cyan-300">
                  {server} | {vid}
                </span>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setIsPlaying(false)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-bold transition cursor-pointer"
                >
                  Fechar Player
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Placeholder / Ready Screen */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0a0a0a] to-[#000000]">
            <div className="w-24 h-24 rounded-3xl bg-[#111] border border-neutral-800 flex items-center justify-center text-white mb-6 shadow-2xl relative group">
              <Film className="w-12 h-12 text-cyan-400" />
              <button
                type="button"
                onClick={() => handlePlayCurrent()}
                title="Assistir agora"
                className="absolute inset-0 rounded-3xl bg-cyan-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <Play className="w-10 h-10 text-cyan-300 fill-cyan-300" />
              </button>
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2">
              {title || 'Filme / Vídeo On Demand'}
            </h2>
            <div className="flex items-center gap-2 justify-center mb-6">
              <span className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-cyan-400 font-mono text-xs font-bold">
                SERVER: {server || '---'}
              </span>
              <span className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-cyan-400 font-mono text-xs font-bold">
                VID: {vid || '---'}
              </span>
            </div>

            <button
              type="button"
              id="btn-play-ondemand"
              onClick={() => handlePlayCurrent()}
              className="px-8 py-3.5 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black text-sm uppercase tracking-wider transition-all transform hover:scale-105 shadow-xl flex items-center gap-2.5 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-black text-black" />
              <span>Assistir Vídeo Agora</span>
            </button>

            <p className="text-xs text-neutral-500 mt-4 max-w-md leading-relaxed">
              Altere o Server e VID ao lado para carregar qualquer filme ou série instantaneamente pelo iframe principal.
            </p>
          </div>
        )}
      </div>

      {/* RIGHT AREA: Server, VID Input & Saved Library */}
      <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col bg-[#0b0b0b] shrink-0 overflow-y-auto">
        {/* Header of control panel */}
        <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-bold text-white tracking-wide">
              Controle de Filmes (On Demand)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowTemplateConfig(!showTemplateConfig)}
            title="Configurar Template do Iframe"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Status notice */}
        {statusMessage && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Collapsible Iframe Base Template Configuration */}
        {showTemplateConfig && (
          <div className="p-4 bg-[#141414] border-b border-[#222] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Iframe Principal (Template Base)</span>
              <button
                type="button"
                onClick={handleResetTemplate}
                className="text-[11px] text-neutral-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar Padrão</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={customTemplate}
              onChange={(e) => setCustomTemplate(e.target.value)}
              placeholder="Cole seu código ou template do iframe contendo {server} e {vid}"
              className="w-full p-2.5 rounded-xl bg-[#090909] border border-neutral-700 text-xs font-mono text-neutral-200 focus:border-cyan-400 outline-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-500">
                Usa <code className="text-cyan-300 font-bold">{'{server}'}</code> e <code className="text-cyan-300 font-bold">{'{vid}'}</code>
              </span>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                {templateSavedFeedback ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{templateSavedFeedback ? 'Salvo!' : 'Salvar Template'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Input Fields for Server and VID */}
        <div className="p-4 space-y-3 border-b border-[#1f1f1f]">
          {/* Quick Paste Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <ClipboardPaste className="w-3.5 h-3.5 text-neutral-400" />
                <span>Colar Iframe Completo (Detecção Automática)</span>
              </label>
            </div>
            <input
              type="text"
              value={pasteInput}
              onChange={(e) => handleExtractFromPaste(e.target.value)}
              placeholder='Cole aqui para auto-preencher server e vid...'
              className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:border-cyan-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                SERVER
              </label>
              <input
                type="text"
                id="input-movie-server"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="Ex: RCServer27"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-neutral-800 text-xs font-mono font-bold text-white placeholder-neutral-600 focus:border-cyan-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                VID
              </label>
              <input
                type="text"
                id="input-movie-vid"
                value={vid}
                onChange={(e) => setVid(e.target.value)}
                placeholder="Ex: DY ou JCKRCHSRTN"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-neutral-800 text-xs font-mono font-bold text-white placeholder-neutral-600 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
              Título / Descrição (Opcional)
            </label>
            <input
              type="text"
              id="input-movie-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Jack Reacher, Filme de Ação..."
              className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:border-cyan-400 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handlePlayCurrent()}
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/20"
            >
              <Play className="w-4 h-4 fill-black text-black" />
              <span>Assistir</span>
            </button>
            <button
              type="button"
              onClick={handleSaveCurrent}
              className="px-4 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-white border border-neutral-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar</span>
            </button>
          </div>
        </div>

        {/* Saved Movies List */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Filmes e Vídeos Salvos ({movies.length})
            </span>
          </div>

          {movies.length === 0 ? (
            <div className="py-10 text-center text-neutral-500 text-xs">
              Nenhum filme salvo ainda. Insira o Server e VID acima e clique em Salvar.
            </div>
          ) : (
            <div className="space-y-2">
              {movies.map((item) => {
                const isCurrent = server === item.server && vid === item.vid;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setServer(item.server);
                      setVid(item.vid);
                      setTitle(item.title);
                      handlePlayCurrent(item.server, item.vid, item.title);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-[#181818] border-cyan-400/80 shadow-md ring-1 ring-cyan-400/40'
                        : 'bg-[#121212] hover:bg-[#161616] border-[#202020]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#1f1f1f] text-cyan-400 flex items-center justify-center shrink-0">
                        <Play className="w-3.5 h-3.5 fill-cyan-400 ml-0.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono mt-0.5">
                          <span>{item.server}</span>
                          <span>•</span>
                          <span>{item.vid}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMovie(item.id, e)}
                        title="Remover filme da lista"
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition cursor-pointer"
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
      </div>
    </div>
  );
};
