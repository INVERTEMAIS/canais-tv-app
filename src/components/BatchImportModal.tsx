import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  HelpCircle,
  FileText,
  HardDrive,
  CloudDownload,
  Link as LinkIcon
} from 'lucide-react';
import { MovieItem } from '../types/movies';
import {
  parseSpreadsheetText,
  ParsedBatchMovie,
  probeVideoDuration,
  triggerDownload,
  exportCatalogToCsv,
  convertCloudShareUrlToDirectUrl
} from '../utils/batchImportHelper';
import { NETFLIX_PALETTES } from '../utils/moviesCatalogStorage';
import { useModalArrowNavigation } from '../hooks/useModalArrowNavigation';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBatch: (movies: MovieItem[]) => void;
  existingMovies: MovieItem[];
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onImportBatch,
  existingMovies,
}) => {
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [cloudUrl, setCloudUrl] = useState<string>('');
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);
  const [parsedMovies, setParsedMovies] = useState<ParsedBatchMovie[]>([]);
  const [isProbingDuration, setIsProbingDuration] = useState<boolean>(false);
  const [probeProgress, setProbeProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [autoProbeDuration, setAutoProbeDuration] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // Navegação Universal por Setas no Modal
  useModalArrowNavigation({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    defaultFocusIndex: 0,
  });

  if (!isOpen) return null;

  // Quando o usuário carrega arquivo de planilha ou pendrive
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(`Lendo arquivo "${file.name}"...`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvRawText(content);
        processRawText(content);
      }
    };
    reader.onerror = () => {
      setStatusMessage('Erro ao ler o arquivo. Verifique se o pendrive está conectado.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Baixar arquivo diretamente via Google Drive ou Link de Nuvem
  const handleFetchFromCloud = async () => {
    if (!cloudUrl.trim()) return;

    setIsLoadingCloud(true);
    setStatusMessage('Buscando arquivo na nuvem...');
    try {
      const directUrl = convertCloudShareUrlToDirectUrl(cloudUrl.trim());
      const response = await fetch(directUrl);
      if (!response.ok) {
        throw new Error(`Falha no download (${response.status})`);
      }
      const text = await response.text();
      setCsvRawText(text);
      processRawText(text);
      setStatusMessage('Lista da nuvem carregada com sucesso!');
    } catch (err: any) {
      setStatusMessage(
        'Não foi possível baixar direto da URL. Se for Google Drive, certifique-se de que o link está configurado como "Qualquer pessoa com o link pode ler".'
      );
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // Processa o texto CSV e gera os itens parseados
  const processRawText = (text: string) => {
    const items = parseSpreadsheetText(text);
    setParsedMovies(items);
    if (items.length > 0) {
      setActiveTab('preview');
      setStatusMessage(`${items.length} filme(s) identificado(s) na planilha.`);
      if (autoProbeDuration) {
        probeDurations(items);
      }
    } else {
      setStatusMessage('Nenhum filme válido encontrado no texto. Verifique o formato.');
    }
  };

  // Puxa a duração de cada vídeo em segundo plano
  const probeDurations = async (items: ParsedBatchMovie[]) => {
    const validItems = items.filter((m) => m.status === 'valid' && !m.duration);
    if (validItems.length === 0) return;

    setIsProbingDuration(true);
    setProbeProgress({ current: 0, total: validItems.length });

    let count = 0;
    const updated = [...items];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.status === 'valid' && !item.duration) {
        item.status = 'loading';
        setParsedMovies([...updated]);

        const dur = await probeVideoDuration(item.streamUrl, 6000);
        if (dur) {
          item.detectedDuration = dur;
          item.duration = dur;
        } else {
          item.duration = '1h 50m'; // padrão se não responder em 6s
        }
        item.status = 'valid';

        count++;
        setProbeProgress({ current: count, total: validItems.length });
        setParsedMovies([...updated]);
      }
    }

    setIsProbingDuration(false);
    setStatusMessage('Durações dos vídeos verificadas e preenchidas automaticamente!');
  };

  // Excluir linha do preview
  const handleRemoveItem = (id: string) => {
    setParsedMovies((prev) => prev.filter((item) => item.id !== id));
  };

  // Concluir e salvar no catálogo
  const handleFinalizeImport = () => {
    const validOnes = parsedMovies.filter((m) => m.status === 'valid');
    if (validOnes.length === 0) {
      alert('Nenhum filme válido para importar.');
      return;
    }

    const newMovies: MovieItem[] = validOnes.map((item, idx) => {
      const palette = NETFLIX_PALETTES[(idx + existingMovies.length) % NETFLIX_PALETTES.length];
      return {
        id: `movie_${Date.now()}_${idx}`,
        title: item.title,
        streamUrl: item.streamUrl,
        sourcePageUrl: item.sourcePageUrl,
        category: item.category,
        year: item.year || new Date().getFullYear(),
        synopsis: item.synopsis || 'Importado via planilha NetPlay.',
        duration: item.duration || item.detectedDuration || '1h 50m',
        tokenParamKey: item.tokenKey,
        tokenExpiresAt: item.tokenExpiresAt,
        backdropColor: palette.bg,
        accentColor: palette.accent,
        createdAt: Date.now() + idx,
      };
    });

    onImportBatch(newMovies);
    onClose();
  };

  // Baixar modelo de planilha com a coluna Link_Origem para auto-renovação
  const handleDownloadTemplate = () => {
    const templateContent =
      'Nome do Filme;Link MP4;Link_Origem;Categoria;Ano;Sinopse;Duracao\r\n' +
      'Gladiador II;https://neosoro.gq/V/RCFServer4/ondemand/MSOCGNHA.mp4?sv=24&cc=y&secure_uri=true&nu3zAQc9HC3GbwJq=1789858783-1aVawtjNUaVr1Fmgr5piXHcGJHExiHUZzfGFwHV9ypk%3D;https://redecanais.la/gladiador-2-dublado;Ação;2024;Anos após testemunhar a morte do herói Maximus, Lucius deve lutar no Coliseu.;auto\r\n' +
      'Big Buck Bunny 4K;https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4;;Animação;2023;Um dócil coelho decide enfrentar esquilos travessos na floresta.;auto\r\n' +
      'Tears of Steel;https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4;;Ficção & Fantasia;2022;Em um futuro distópico, cientistas tentam salvar o planeta.;auto';

    triggerDownload(templateContent, 'modelo_planilha_filmes_netplay.csv');
  };

  // Exportar filmes atuais
  const handleExportCurrentCatalog = () => {
    const csvData = exportCatalogToCsv(existingMovies);
    triggerDownload(csvData, `catalogo_filmes_netplay_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const validCount = parsedMovies.filter((m) => m.status === 'valid').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div ref={modalContainerRef} className="bg-white border-2 border-neutral-300 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header no estilo NetPlay em Branco e Alto Contraste */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-6 bg-[#E50914] rounded-xs shadow-[0_0_6px_#E50914]" />
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#E50914]" />
              <h2 className="text-base font-black tracking-wide text-neutral-950 uppercase font-['Outfit']">
                Subir Lote de Filmes (Planilha / CSV)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCurrentCatalog}
              title="Exportar catálogo atual para planilha CSV"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-bold border border-neutral-300 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-600" />
              <span>Exportar Atual</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas e Barra de Ações Rápidas */}
        <div className="px-6 py-3 border-b border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-[#E50914] text-white shadow-xs'
                  : 'bg-white text-neutral-700 hover:text-neutral-950 border border-neutral-300'
              }`}
            >
              1. Enviar ou Colar Planilha
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-[#E50914] text-white shadow-xs'
                  : 'bg-white text-neutral-700 hover:text-neutral-950 border border-neutral-300'
              }`}
            >
              <span>2. Revisar Filmes ({parsedMovies.length})</span>
              {validCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 px-3 py-1.5 rounded-lg transition cursor-pointer active:scale-95 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Baixar Modelo de Planilha (.CSV)</span>
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs bg-white">
          {statusMessage && (
            <div className="p-3 bg-neutral-50 border border-neutral-300 rounded-xl flex items-center justify-between text-neutral-900 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E50914] shrink-0" />
                <span className="font-semibold">{statusMessage}</span>
              </div>
              {isProbingDuration && (
                <span className="text-[11px] font-mono text-neutral-500 font-bold">
                  {probeProgress.current} de {probeProgress.total} processados...
                </span>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Opção 1: Pendrive USB na Smart TV ou Arquivo Local */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className="border-2 border-dashed border-neutral-300 hover:border-[#E50914] focus:border-[#E50914] focus:ring-2 focus:ring-red-600/50 bg-neutral-50 hover:bg-red-50/20 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all outline-none group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-11 h-11 rounded-xl bg-white border border-neutral-300 group-hover:border-[#E50914] group-focus:border-[#E50914] flex items-center justify-center text-[#E50914] mb-2.5 transition-colors shadow-xs">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-black uppercase text-neutral-950 mb-1 tracking-wide">
                    1. Carregar de Pendrive USB / Arquivo Local
                  </h3>
                  <p className="text-[10px] text-neutral-500 max-w-xs leading-relaxed font-medium">
                    Conecte o pendrive na Smart TV ou TV Box e selecione sua planilha <strong>.CSV</strong>, <strong>.TXT</strong> ou <strong>.JSON</strong>.
                  </p>
                </div>

                {/* Opção 2: Google Drive / Link Remoto da Nuvem */}
                <div className="border border-neutral-300 bg-neutral-50 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CloudDownload className="w-4 h-4 text-[#E50914]" />
                      <h3 className="text-xs font-black uppercase text-neutral-950 tracking-wide">
                        2. Baixar Lista via Google Drive / Link
                      </h3>
                    </div>
                    <p className="text-[10px] text-neutral-500 mb-3 leading-relaxed font-medium">
                      Cole o link de compartilhamento do <strong>Google Drive</strong>, <strong>Google Sheets</strong> ou <strong>URL direta</strong> do arquivo.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={cloudUrl}
                      onChange={(e) => setCloudUrl(e.target.value)}
                      placeholder="https://drive.google.com/file/d/.../view"
                      className="flex-1 bg-white border border-neutral-300 focus:border-[#E50914] rounded-xl px-3 py-2 text-neutral-900 text-xs placeholder-neutral-400 outline-none font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleFetchFromCloud}
                      disabled={!cloudUrl.trim() || isLoadingCloud}
                      className="px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-bold text-xs shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isLoadingCloud ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Baixar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Caixa de Texto para Colar Linhas ou JSON */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-neutral-900 font-extrabold uppercase tracking-wider text-[11px]">
                    3. Ou cole as linhas da planilha / JSON diretamente:
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono font-medium">
                    Formato: Nome;Link MP4;Categoria;Ano;Sinopse;Duração
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  placeholder="Gladiador II;https://servidor.com/video.mp4;Ação;2024;Sinopse do filme;auto"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-3 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-[#E50914] font-mono text-[11px]"
                />
              </div>

              {/* Opção de Auto-Puxar Duração */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-50 border border-neutral-300 rounded-xl">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#E50914] mt-0.5" />
                  <div>
                    <span className="font-extrabold text-neutral-950 text-xs block">
                      Puxar Duração Automaticamente via MP4
                    </span>
                    <span className="text-[10px] text-neutral-600 font-medium">
                      O sistema lê o cabeçalho do arquivo de vídeo e calcula o tempo exato (ex: 2h 15m) sem você precisar preencher manualmente.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoProbeDuration}
                  onChange={(e) => setAutoProbeDuration(e.target.checked)}
                  className="w-4 h-4 accent-[#E50914] cursor-pointer"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => processRawText(csvRawText)}
                  disabled={!csvRawText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#b80710] disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-black tracking-wide transition cursor-pointer flex items-center gap-2 active:scale-95 shadow-md shadow-red-500/20"
                >
                  <span>Processar Linhas da Planilha</span>
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Barra de Status do Preview */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-neutral-900">
                  Filmes Identificados: {validCount} válidos de {parsedMovies.length} total
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => probeDurations(parsedMovies)}
                    disabled={isProbingDuration}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#E50914] ${
                        isProbingDuration ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Re-testar Durações MP4</span>
                  </button>
                </div>
              </div>

              {/* Tabela / Lista de Filmes a Importar */}
              {parsedMovies.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-neutral-400" />
                  <p>Nenhum filme carregado ainda. Volte para a aba anterior e cole as linhas.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {parsedMovies.map((movie) => (
                    <div
                      key={movie.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        movie.status === 'valid'
                          ? 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100'
                          : 'border-red-300 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {movie.status === 'valid' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#E50914] shrink-0 mt-0.5" />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-black text-neutral-900 truncate max-w-xs">
                              {movie.title}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded bg-neutral-200 border border-neutral-300 text-[10px] text-neutral-800 uppercase font-bold">
                              {movie.category}
                            </span>
                            {movie.year && (
                              <span className="text-[10px] text-neutral-500 font-mono font-semibold">
                                • {movie.year}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[10px] text-[#E50914] font-mono font-bold flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-[#E50914]" />
                              {movie.duration || 'Puxando...'}
                            </span>
                          </div>

                          <p className="text-[10px] text-neutral-500 font-mono truncate mt-1">
                            {movie.streamUrl}
                          </p>

                          {movie.errorMessage && (
                            <p className="text-[10px] text-red-600 font-bold mt-0.5">
                              {movie.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(movie.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Remover filme desta importação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-white flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-medium hidden sm:inline">
            Dica: Filmes com links expirados podem ter seu token renovado em 1 clique depois.
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition cursor-pointer border border-neutral-300"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleFinalizeImport}
              disabled={validCount === 0}
              className="px-6 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-black text-xs tracking-wide transition cursor-pointer flex items-center gap-2 shadow-md shadow-red-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Importar {validCount} Filmes para o Catálogo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
