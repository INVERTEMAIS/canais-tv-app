import React, { useState, useMemo } from 'react';
import {
  Play,
  Plus,
  Search,
  Film,
  Trash2,
  Clock,
  Calendar,
  Sparkles,
  Info,
  Tv
} from 'lucide-react';
import { MovieItem, MovieCategory } from '../types/movies';
import {
  loadMoviesCatalog,
  saveMoviesCatalog,
  getSavedWatchTime
} from '../utils/moviesCatalogStorage';
import { NativeMoviePlayer } from './NativeMoviePlayer';
import { AddMovieModal } from './AddMovieModal';

const CATEGORIES: MovieCategory[] = ['TODOS', 'Ação', 'Comédia', 'Drama', 'Ficção & Fantasia', 'Terror & Suspense', 'Animação', 'Documentário'];

export const MoviesCatalogView: React.FC = () => {
  const [movies, setMovies] = useState<MovieItem[]>(() => loadMoviesCatalog());
  const [selectedCategory, setSelectedCategory] = useState<MovieCategory>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePlayingMovie, setActivePlayingMovie] = useState<MovieItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState<MovieItem | null>(() => movies[0] || null);

  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      const matchCategory =
        selectedCategory === 'TODOS' || movie.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        movie.synopsis?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [movies, selectedCategory, searchQuery]);

  const handleAddMovie = (newMovie: MovieItem) => {
    const updated = [newMovie, ...movies];
    setMovies(updated);
    saveMoviesCatalog(updated);
    setSelectedMovieForDetails(newMovie);
  };

  const handleDeleteMovie = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja remover este filme do catálogo?')) {
      const updated = movies.filter((m) => m.id !== id);
      setMovies(updated);
      saveMoviesCatalog(updated);
      if (selectedMovieForDetails?.id === id) {
        setSelectedMovieForDetails(updated[0] || null);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080808] text-white overflow-hidden select-none">
      {/* 1. Hero Featured Banner (Spotlight do filme selecionado) */}
      {selectedMovieForDetails && (
        <div className="relative w-full h-[260px] md:h-[320px] shrink-0 overflow-hidden border-b border-neutral-800">
          {/* Background Poster com Blur cinematográfico */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105 filter blur-xs brightness-40"
            style={{
              backgroundImage: `url(${selectedMovieForDetails.posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&auto=format&fit=crop&q=80'})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/80 to-transparent" />

          {/* Hero Content */}
          <div className="relative z-10 h-full max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between gap-8">
            <div className="max-w-2xl flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold uppercase tracking-wider">
                  {selectedMovieForDetails.category || 'Em Destaque'}
                </span>
                {selectedMovieForDetails.year && (
                  <span className="text-xs text-neutral-400 font-semibold">
                    {selectedMovieForDetails.year}
                  </span>
                )}
                {selectedMovieForDetails.duration && (
                  <span className="text-xs text-neutral-400 font-semibold">
                    • {selectedMovieForDetails.duration}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-2 leading-tight drop-shadow-lg font-['Outfit']">
                {selectedMovieForDetails.title}
              </h1>

              <p className="text-xs md:text-sm text-neutral-300 line-clamp-2 md:line-clamp-3 mb-5 leading-relaxed drop-shadow">
                {selectedMovieForDetails.synopsis || 'Sem sinopse cadastrada.'}
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActivePlayingMovie(selectedMovieForDetails)}
                  className="px-6 py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black font-extrabold text-sm flex items-center gap-2.5 transition-all shadow-xl hover:scale-105 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Assistir Agora</span>
                </button>

                {getSavedWatchTime(selectedMovieForDetails.id) > 5 && (
                  <span className="text-xs text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Continuar assistindo
                  </span>
                )}
              </div>
            </div>

            {/* Poster Thumbnail no Desktop */}
            <div className="hidden md:block shrink-0">
              <img
                src={selectedMovieForDetails.posterUrl}
                alt={selectedMovieForDetails.title}
                className="w-36 h-52 object-cover rounded-2xl shadow-2xl border-2 border-neutral-700/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Controls & Filter Bar */}
      <div className="px-6 md:px-10 py-3 border-b border-neutral-800/80 bg-[#0d0d0d] flex flex-wrap items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input & Add Movie Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar filmes..."
              className="w-full bg-[#161616] border border-neutral-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2" />
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Adicionar Filme</span>
          </button>
        </div>
      </div>

      {/* 3. Movies Grid (Lista de Filmes) */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
              {selectedCategory === 'TODOS' ? 'Todos os Filmes' : `Filmes de ${selectedCategory}`} ({filteredMovies.length})
            </h2>
          </div>

          {filteredMovies.length === 0 ? (
            <div className="w-full py-16 flex flex-col items-center justify-center text-center">
              <Film className="w-12 h-12 text-neutral-700 mb-3" />
              <p className="text-sm text-neutral-400 font-semibold mb-1">Nenhum filme encontrado</p>
              <p className="text-xs text-neutral-600 mb-4">Tente outra busca ou adicione um novo link de filme.</p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
              >
                Adicionar Filme Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {filteredMovies.map((movie) => {
                const isSelected = selectedMovieForDetails?.id === movie.id;
                const lastTime = getSavedWatchTime(movie.id);

                return (
                  <div
                    key={movie.id}
                    onClick={() => {
                      setSelectedMovieForDetails(movie);
                      setActivePlayingMovie(movie);
                    }}
                    className={`group relative flex flex-col rounded-2xl overflow-hidden bg-[#111] border transition-all duration-300 cursor-pointer hover:scale-103 hover:shadow-2xl ${
                      isSelected
                        ? 'border-cyan-500 ring-2 ring-cyan-500/20'
                        : 'border-neutral-800/80 hover:border-neutral-600'
                    }`}
                  >
                    {/* Poster Image */}
                    <div className="relative aspect-2/3 w-full bg-neutral-900 overflow-hidden">
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
                      />

                      {/* Play Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-6 h-6 fill-current translate-x-0.5" />
                        </div>
                      </div>

                      {/* Category Badge */}
                      {movie.category && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-neutral-300 border border-neutral-700/50">
                          {movie.category}
                        </div>
                      )}

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMovie(movie.id, e)}
                        title="Remover do catálogo"
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-red-950 text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-neutral-700/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Progress Bar indicator if watched */}
                      {lastTime > 5 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800">
                          <div className="h-full bg-cyan-400 w-1/3" />
                        </div>
                      )}
                    </div>

                    {/* Movie Info */}
                    <div className="p-3 flex flex-col flex-1 justify-between bg-[#111]">
                      <div>
                        <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-cyan-400 transition-colors">
                          {movie.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-1">
                          {movie.year && <span>{movie.year}</span>}
                          {movie.duration && <span>• {movie.duration}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Native Fullscreen Video Player Modal */}
      {activePlayingMovie && (
        <NativeMoviePlayer
          movie={activePlayingMovie}
          onClose={() => setActivePlayingMovie(null)}
        />
      )}

      {/* 5. Add Movie Modal */}
      <AddMovieModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddMovie={handleAddMovie}
      />
    </div>
  );
};
