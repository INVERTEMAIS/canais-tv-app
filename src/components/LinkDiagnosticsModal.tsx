import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Globe,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Play,
  ArrowRight,
  ExternalLink,
  Edit3,
  Search,
  Check
} from 'lucide-react';
import { MovieItem, CatalogSettings } from '../types/movies';
import {
  loadCatalogSettings,
  saveCatalogSettings,
  evaluateTokenHealth,
  bulkUpdateMoviesDomain,
  saveMoviesCatalog
} from '../utils/moviesCatalogStorage';
import { testDomainConnectivity, renewMovieToken, renewMultipleMovies } from '../utils/tokenRenewalService';
import { useModalArrowNavigation } from '../hooks/useModalArrowNavigation';

interface LinkDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  movies: MovieItem[];
  onUpdateMovies: (updatedMovies: MovieItem[]) => void;
  onPlayMovie?: (movie: MovieItem) => void;
}

export const LinkDiagnosticsModal: React.FC<LinkDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  movies,
  onUpdateMovies,
  onPlayMovie,
}) => {
  const [settings, setSettings] = useState<CatalogSettings>(() => loadCatalogSettings());
  const [domainInput, setDomainInput] = useState<string>(() => settings.redecanaisDomain);
  const [isTestingDomain, setIsTestingDomain] = useState<boolean>(false);
  const [domainTestResult, setDomainTestResult] = useState<{
    ok: boolean;
    status?: number;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // Troca em massa de domínio
  const [showBulkSwap, setShowBulkSwap] = useState<boolean>(false);
  const [oldDomainInput, setOldDomainInput] = useState<string>('redecanais.la');
  const [newDomainInput, setNewDomainInput] = useState<string>('redecanais.la');
  const [bulkSwapMessage, setBulkSwapMessage] = useState<string | null>(null);

  // Filtros de listagem
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'warning' | 'no-source'>('all');

  // Estado de renovação em massa ou individual
  const [isRenewingAll, setIsRenewingAll] = useState<boolean>(false);
  const [renewProgress, setRenewProgress] = useState<{ current: number; total: number } | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ id: string; success: boolean; text: string } | null>(null);

  // Edição rápida de Link de Origem no próprio modal
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [newSourceUrlInput, setNewSourceUrlInput] = useState<string>('');

  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  useModalArrowNavigation({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    defaultFocusIndex: 0,
  });

  // Cálculos de integridade do catálogo
  const evaluatedMovies = useMemo(() => {
    if (!Array.isArray(movies)) return [];
    return movies.filter(Boolean).map((m) => {
      const health = evaluateTokenHealth(m);
      return {
        movie: m,
        health,
      };
    });
  }, [movies]);

  const stats = useMemo(() => {
    let validCount = 0;
    let warningCount = 0;
    let expiredCount = 0;
    let noSourceCount = 0;
    let withSourceCount = 0;

    for (const item of evaluatedMovies) {
      if (!item || !item.movie) continue;
      if (item.movie.sourcePageUrl) withSourceCount++;
      if (item.health?.status === 'valid') validCount++;
      else if (item.health?.status === 'warning') warningCount++;
      else if (item.health?.status === 'expired') expiredCount++;
      else if (item.health?.status === 'no-source') noSourceCount++;
    }

    return {
      total: evaluatedMovies.length,
      withSourceCount,
      validCount,
      warningCount,
      expiredCount,
      noSourceCount,
    };
  }, [evaluatedMovies]);

  // Lista filtrada
  const filteredList = useMemo(() => {
    return evaluatedMovies.filter(({ movie, health }) => {
      if (!movie) return false;
      const title = movie.title || '';
      const sourceUrl = movie.sourcePageUrl || '';
      const matchesSearch =
        !searchFilter.trim() ||
        title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        sourceUrl.toLowerCase().includes(searchFilter.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'expired') return health?.status === 'expired';
      if (statusFilter === 'warning') return health?.status === 'warning' || health?.status === 'expired';
      if (statusFilter === 'no-source') return !movie.sourcePageUrl;

      return true;
    });
  }, [evaluatedMovies, searchFilter, statusFilter]);

  if (!isOpen) return null;

  // Salvar novo domínio base
  const handleSaveDomain = () => {
    const updated = {
      ...settings,
      redecanaisDomain: domainInput.trim() || 'https://redecanais.la',
    };
    setSettings(updated);
    saveCatalogSettings(updated);
    setFeedbackMessage({
      id: 'domain',
      success: true,
      text: `Domínio ativo definido como ${updated.redecanaisDomain}`,
    });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Testar conectividade do domínio
  const handleTestDomain = async () => {
    setIsTestingDomain(true);
    setDomainTestResult(null);
    try {
      const res = await testDomainConnectivity(domainInput);
      setDomainTestResult({
        ok: res.ok,
        status: res.status,
        latencyMs: res.latencyMs,
        error: res.error,
      });
    } catch {
      setDomainTestResult({ ok: false, error: 'Erro de rede' });
    } finally {
      setIsTestingDomain(false);
    }
  };

  // Executar troca em massa de domínio em todos os filmes
  const handleExecuteBulkSwap = () => {
    if (!oldDomainInput.trim() || !newDomainInput.trim()) return;
    const { updatedMovies, count } = bulkUpdateMoviesDomain(movies, oldDomainInput, newDomainInput);
    onUpdateMovies(updatedMovies);
    saveMoviesCatalog(updatedMovies);

    // Atualiza também o domínio global ativo
    const updatedSettings = {
      ...settings,
      redecanaisDomain: newDomainInput.trim().startsWith('http')
        ? newDomainInput.trim()
        : `https://${newDomainInput.trim()}`,
    };
    setSettings(updatedSettings);
    setDomainInput(updatedSettings.redecanaisDomain);
    saveCatalogSettings(updatedSettings);

    setBulkSwapMessage(`Sucesso! ${count} filmes atualizados com o novo domínio.`);
    setTimeout(() => setBulkSwapMessage(null), 5000);
  };

  // Renovar individualmente
  const handleRenewSingle = async (movie: MovieItem) => {
    setRenewingId(movie.id);
    setFeedbackMessage(null);
    try {
      const res = await renewMovieToken(movie, settings.redecanaisDomain);
      if (res.success && res.newStreamUrl) {
        const updated = movies.map((m) =>
          m.id === movie.id
            ? {
                ...m,
                streamUrl: res.newStreamUrl!,
                tokenExpiresAt: res.expiresAt || undefined,
                lastTokenRenewedAt: Date.now(),
              }
            : m
        );
        onUpdateMovies(updated);
        saveMoviesCatalog(updated);
        setFeedbackMessage({
          id: movie.id,
          success: true,
          text: 'Token renovado com sucesso! Link pronto para tocar.',
        });
      } else {
        setFeedbackMessage({
          id: movie.id,
          success: false,
          text: res.error || 'Falha ao raspar a página.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        id: movie.id,
        success: false,
        text: err.message || 'Erro inesperado.',
      });
    } finally {
      setRenewingId(null);
      setTimeout(() => setFeedbackMessage(null), 6000);
    }
  };

  // Renovar todos os que têm link de origem
  const handleRenewAll = async () => {
    const targetMovies = movies.filter((m) => !!m.sourcePageUrl);
    if (targetMovies.length === 0) {
      setFeedbackMessage({
        id: 'global',
        success: false,
        text: 'Nenhum filme possui Link de Origem cadastrado para renovação automática.',
      });
      setTimeout(() => setFeedbackMessage(null), 5000);
      return;
    }

    setIsRenewingAll(true);
    setRenewProgress({ current: 0, total: targetMovies.length });

    try {
      const { updatedMovies, successCount, failCount } = await renewMultipleMovies(
        movies,
        settings.redecanaisDomain,
        (current, total) => {
          setRenewProgress({ current, total });
        }
      );

      onUpdateMovies(updatedMovies);
      setFeedbackMessage({
        id: 'global',
        success: true,
        text: `Renovação concluída! ${successCount} atualizados com sucesso (${failCount} falhas).`,
      });
    } catch {
      setFeedbackMessage({
        id: 'global',
        success: false,
        text: 'Ocorreu um erro durante a renovação em massa.',
      });
    } finally {
      setIsRenewingAll(false);
      setRenewProgress(null);
      setTimeout(() => setFeedbackMessage(null), 7000);
    }
  };

  // Salvar novo link de origem para um filme específico
  const handleSaveSourceUrl = (movie: MovieItem) => {
    const updated = movies.map((m) =>
      m.id === movie.id ? { ...m, sourcePageUrl: newSourceUrlInput.trim() || undefined } : m
    );
    onUpdateMovies(updated);
    saveMoviesCatalog(updated);
    setEditingSourceId(null);
    setNewSourceUrlInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div ref={modalContainerRef} className="bg-white border-2 border-neutral-300 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header Principal em Fundo Branco com Alto Contraste */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E50914] flex items-center justify-center text-white shadow-[0_0_12px_rgba(229,9,20,0.4)]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-neutral-950 uppercase font-['Outfit'] flex items-center gap-2">
                Gestão de Links, Tokens & Domínios
              </h2>
              <p className="text-[11px] text-neutral-500 font-medium">
                Auto-renovação de tokens anti-expiração e proteção contra troca de domínio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificação Global */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center gap-2 border-b ${
              feedbackMessage.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            {feedbackMessage.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Corpo com Rolagem */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-neutral-900">
          {/* SEÇÃO 1: Domínio Ativo Global & Anti-Bloqueio */}
          <div className="bg-neutral-50 border-2 border-neutral-200 p-5 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#E50914]" />
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase text-neutral-950 tracking-wide font-['Outfit']">
                    Domínio Global do Provedor (RedeCanais)
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Se o site mudar de endereço (.la para .wf, etc.), altere aqui para atualizar a busca de 100% dos filmes.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkSwap(!showBulkSwap)}
                className="text-[11px] text-[#E50914] hover:underline font-bold self-start sm:self-auto cursor-pointer"
              >
                {showBulkSwap ? 'Ocultar Troca em Massa' : '🛠️ Troca em Massa nos Links'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="https://redecanais.la"
                  className="w-full bg-white border-2 border-neutral-300 rounded-xl px-3.5 py-2.5 text-neutral-950 font-mono text-xs font-bold focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDomain}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Salvar Domínio
                </button>

                <button
                  type="button"
                  onClick={handleTestDomain}
                  disabled={isTestingDomain}
                  className="px-4 py-2.5 rounded-xl bg-white border-2 border-neutral-300 hover:border-neutral-400 text-neutral-900 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {isTestingDomain ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-[#E50914]" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Testar Conexão</span>
                </button>
              </div>
            </div>

            {/* Resultado do Teste de Conexão */}
            {domainTestResult && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  domainTestResult.ok
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {domainTestResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>
                    {domainTestResult.ok
                      ? `Domínio online e respondendo perfeitamente (HTTP ${domainTestResult.status})`
                      : `Domínio inacessível ou bloqueado: ${domainTestResult.error}`}
                  </span>
                </div>
                {domainTestResult.latencyMs !== undefined && (
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white/70">
                    {domainTestResult.latencyMs}ms
                  </span>
                )}
              </div>
            )}

            {/* Painel Expansível de Substituição em Lote */}
            {showBulkSwap && (
              <div className="mt-4 pt-4 border-t border-neutral-200 bg-white p-4 rounded-xl border">
                <h4 className="font-black text-neutral-950 uppercase text-[11px] mb-1">
                  Substituir Domínio nos Links Gravados de Todo o Catálogo
                </h4>
                <p className="text-[11px] text-neutral-500 mb-3">
                  Localiza qualquer referência a um domínio antigo no campo "Link de Origem" e troca pelo novo em 1 clique.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">
                      Domínio Antigo a Substituir:
                    </label>
                    <input
                      type="text"
                      value={oldDomainInput}
                      onChange={(e) => setOldDomainInput(e.target.value)}
                      placeholder="redecanais.la"
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-neutral-600 mb-1">
                      Novo Domínio:
                    </label>
                    <input
                      type="text"
                      value={newDomainInput}
                      onChange={(e) => setNewDomainInput(e.target.value)}
                      placeholder="https://redecanais.wf"
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {bulkSwapMessage && (
                    <span className="text-[11px] font-bold text-emerald-700">{bulkSwapMessage}</span>
                  )}
                  <button
                    type="button"
                    onClick={handleExecuteBulkSwap}
                    className="ml-auto px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-black text-xs transition cursor-pointer"
                  >
                    Executar Troca em Massa
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: Cards de Status e Botão de Ação em Massa */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-center">
              <span className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">
                Catálogo Total
              </span>
              <strong className="text-xl font-black text-neutral-950 font-['Outfit']">
                {stats.total}
              </strong>
              <span className="block text-[10px] text-neutral-500 font-semibold mt-0.5">
                {stats.withSourceCount} com Auto-Renovação
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
              <span className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">
                🟢 Válidos / Ativos
              </span>
              <strong className="text-xl font-black text-emerald-800 font-['Outfit']">
                {stats.validCount}
              </strong>
              <span className="block text-[10px] text-emerald-600 font-semibold mt-0.5">
                Prontos para Assistir
              </span>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center">
              <span className="block text-[10px] uppercase font-bold text-amber-700 mb-1">
                🟡 Alerta (Expira em breve)
              </span>
              <strong className="text-xl font-black text-amber-800 font-['Outfit']">
                {stats.warningCount}
              </strong>
              <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">
                Menos de 3h restantes
              </span>
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-center">
              <span className="block text-[10px] uppercase font-bold text-red-700 mb-1">
                🔴 Tokens Expirados
              </span>
              <strong className="text-xl font-black text-red-800 font-['Outfit']">
                {stats.expiredCount}
              </strong>
              <span className="block text-[10px] text-red-600 font-semibold mt-0.5">
                Requerem renovação
              </span>
            </div>
          </div>

          {/* Barra de Ações em Massa e Barra de Progresso */}
          <div className="p-4 bg-neutral-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-['Outfit'] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Auto-Renovação Inteligente em Massa
              </h4>
              <p className="text-[11px] text-neutral-300">
                Acessa as páginas de origem e atualiza todos os tokens vencidos ou em alerta sem você precisar fazer nada.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRenewAll}
              disabled={isRenewingAll || stats.withSourceCount === 0}
              className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#b80710] disabled:bg-neutral-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 shrink-0"
            >
              {isRenewingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    Renovando ({renewProgress?.current}/{renewProgress?.total})...
                  </span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>🚀 Renovar Todos os Vencidos</span>
                </>
              )}
            </button>
          </div>

          {/* Progresso visual quando ativo */}
          {isRenewingAll && renewProgress && (
            <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#E50914] h-full transition-all duration-300"
                style={{
                  width: `${Math.round((renewProgress.current / renewProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}

          {/* SEÇÃO 3: Filtros de Tabela e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar filme ou link..."
                className="w-full bg-neutral-50 border-2 border-neutral-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#E50914]"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>

            <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white shadow-xs text-neutral-950' : 'text-neutral-600'
                }`}
              >
                Todos ({evaluatedMovies.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  statusFilter === 'expired' ? 'bg-red-600 text-white shadow-xs' : 'text-neutral-600'
                }`}
              >
                🔴 Expirados ({stats.expiredCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('warning')}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  statusFilter === 'warning' ? 'bg-amber-500 text-neutral-950 font-black shadow-xs' : 'text-neutral-600'
                }`}
              >
                🟡 Alertas ({stats.warningCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('no-source')}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  statusFilter === 'no-source' ? 'bg-white shadow-xs text-neutral-950' : 'text-neutral-600'
                }`}
              >
                ⚪ Sem Origem ({stats.noSourceCount})
              </button>
            </div>
          </div>

          {/* TABELA DE FILMES & SAÚDE DOS TOKENS */}
          <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 text-neutral-700 uppercase font-black tracking-wider text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Filme</th>
                    <th className="py-3 px-4">Status do Token</th>
                    <th className="py-3 px-4">Link de Origem (Auto-Renovação)</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredList.map(({ movie, health }) => {
                    const isRenewingThis = renewingId === movie.id;
                    const isEditingThisSource = editingSourceId === movie.id;

                    return (
                      <tr key={movie.id} className="hover:bg-neutral-50/80 transition">
                        {/* 1. Nome do Filme */}
                        <td className="py-3 px-4 font-bold text-neutral-950">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#E50914]" />
                            <span className="font-extrabold truncate max-w-xs">{movie.title}</span>
                            <span className="text-[10px] text-neutral-400 font-medium">
                              ({movie.category})
                            </span>
                          </div>
                        </td>

                        {/* 2. Status do Token */}
                        <td className="py-3 px-4">
                          {health.status === 'valid' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-extrabold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{health.message}</span>
                            </span>
                          )}
                          {health.status === 'warning' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-extrabold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>{health.message}</span>
                            </span>
                          )}
                          {health.status === 'expired' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-900 border border-red-300 font-black text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                              <span>{health.message}</span>
                            </span>
                          )}
                          {health.status === 'no-source' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-300 font-bold text-[11px]">
                              <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Sem Link de Origem</span>
                            </span>
                          )}
                        </td>

                        {/* 3. Link de Origem */}
                        <td className="py-3 px-4 max-w-xs">
                          {isEditingThisSource ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={newSourceUrlInput}
                                onChange={(e) => setNewSourceUrlInput(e.target.value)}
                                placeholder="https://redecanais.la/filme-x"
                                className="w-full bg-white border-2 border-[#E50914] rounded-lg px-2 py-1 text-[11px] font-mono"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveSourceUrl(movie)}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSourceId(null)}
                                className="p-1 rounded bg-neutral-200 text-neutral-700 hover:bg-neutral-300 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {movie.sourcePageUrl ? (
                                <span className="font-mono text-[11px] text-neutral-600 truncate max-w-[220px]">
                                  {movie.sourcePageUrl}
                                </span>
                              ) : (
                                <span className="text-[11px] text-neutral-400 italic">
                                  Nenhuma página vinculada
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSourceId(movie.id);
                                  setNewSourceUrlInput(movie.sourcePageUrl || '');
                                }}
                                title="Editar Link de Origem"
                                className="p-1 text-neutral-400 hover:text-neutral-900 transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 4. Ações Individuais */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {onPlayMovie && (
                              <button
                                type="button"
                                onClick={() => {
                                  onPlayMovie(movie);
                                  onClose();
                                }}
                                title="Testar Reprodução"
                                className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRenewSingle(movie)}
                              disabled={!movie.sourcePageUrl || isRenewingThis}
                              className={`px-3 py-1.5 rounded-xl font-black text-[11px] tracking-wide transition cursor-pointer flex items-center gap-1 ${
                                !movie.sourcePageUrl
                                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                  : health.status === 'expired'
                                  ? 'bg-[#E50914] text-white hover:bg-[#b80710] shadow-sm shadow-red-500/30'
                                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
                              }`}
                            >
                              {isRenewingThis ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                              <span>Renovar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredList.length === 0 && (
                <div className="py-12 text-center text-neutral-500 font-medium">
                  Nenhum filme corresponde ao filtro selecionado.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-medium">
            💡 Dica: O player do NetPlay renova o token automaticamente no fundo caso o vídeo encontre erro 403.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer"
          >
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};
