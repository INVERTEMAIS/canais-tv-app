import React, { useState } from 'react';
import {
  Trash2,
  Edit2,
  Code,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Upload,
  Tv,
  Copy,
  ShieldCheck
} from 'lucide-react';
import { Channel } from '../types';
import { parseIframeInput } from '../utils/iframeParser';
import { INITIAL_CHANNELS } from '../utils/defaultChannels';
import { AndroidAdBlockModal } from './AndroidAdBlockModal';

interface ChannelConfigProps {
  channels: Channel[];
  onSaveChannels: (channels: Channel[]) => void;
  onSelectChannelToWatch: (channel: Channel) => void;
}

const USER_EXAMPLE_IFRAME = `<iframe name="Player" src="//%72%65%64%65%63%61%6E%61%69%73%74%76%2E%61%66/player3/ch.php?canal=ver" frameborder="0" height="400" scrolling="no" width="640" allow="encrypted-media" allowFullScreen></iframe>`;

const DEFAULT_CATEGORIES = [
  'Geral',
  'Notícias',
  'Esportes',
  'Filmes',
  'Séries',
  'Documentários',
  'Variedades',
  'Música',
  'Infantil',
  'Ciência'
];

export const ChannelConfig: React.FC<ChannelConfigProps> = ({
  channels,
  onSaveChannels,
  onSelectChannelToWatch,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Geral');
  const [channelNumber, setChannelNumber] = useState<number>(channels.length + 1);
  const [iframeInput, setIframeInput] = useState('');
  const [description, setDescription] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAndroidGuideModal, setShowAndroidGuideModal] = useState(false);

  // Clear form
  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategory('Geral');
    setChannelNumber(channels.length + 1);
    setIframeInput('');
    setDescription('');
  };

  // Populate form for editing
  const handleStartEdit = (channel: Channel) => {
    setEditingId(channel.id);
    setName(channel.name);
    setCategory(channel.category);
    setChannelNumber(channel.number);
    setIframeInput(channel.iframeCode || channel.streamUrl);
    setDescription(channel.description || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Quick insert user's prompt example
  const handleInsertUserExample = () => {
    setIframeInput(USER_EXAMPLE_IFRAME);
    if (!name) setName('Rede Canais - Ao Vivo');
    if (!category) setCategory('Geral');
    setStatusMessage({
      text: 'Exemplo oficial de iframe inserido no campo!',
      type: 'success',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Save or update channel
  const handleSaveChannel = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setStatusMessage({ text: 'Por favor, informe o nome do canal.', type: 'error' });
      return;
    }

    if (!iframeInput.trim()) {
      setStatusMessage({ text: 'Por favor, insira o código do iframe ou URL do canal.', type: 'error' });
      return;
    }

    const parsed = parseIframeInput(iframeInput);
    if (!parsed.isValid) {
      setStatusMessage({ text: parsed.error || 'Código do iframe inválido.', type: 'error' });
      return;
    }

    let updatedChannels: Channel[];

    if (editingId) {
      updatedChannels = channels.map((c) => {
        if (c.id === editingId) {
          return {
            ...c,
            number: channelNumber,
            name: name.trim(),
            category: category.trim() || 'Geral',
            iframeCode: parsed.cleanIframeCode,
            streamUrl: parsed.streamUrl,
            description: description.trim(),
          };
        }
        return c;
      });
      setStatusMessage({ text: `Canal "${name}" atualizado com sucesso!`, type: 'success' });
    } else {
      const newChannel: Channel = {
        id: `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        number: channelNumber || channels.length + 1,
        name: name.trim(),
        category: category.trim() || 'Geral',
        iframeCode: parsed.cleanIframeCode,
        streamUrl: parsed.streamUrl,
        description: description.trim(),
        isFavorite: false,
        createdAt: Date.now(),
      };
      updatedChannels = [...channels, newChannel];
      setStatusMessage({ text: `Canal "${name}" cadastrado com sucesso!`, type: 'success' });
    }

    onSaveChannels(updatedChannels);
    resetForm();
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Delete channel
  const handleDeleteChannel = (id: string, channelName: string) => {
    if (window.confirm(`Tem certeza que deseja remover o canal "${channelName}"?`)) {
      const updated = channels.filter((c) => c.id !== id);
      onSaveChannels(updated);
      setStatusMessage({ text: `Canal "${channelName}" removido.`, type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Reset to default list
  const handleResetDefaults = () => {
    if (window.confirm('Deseja restaurar a lista com os canais padrão?')) {
      onSaveChannels(INITIAL_CHANNELS);
      setStatusMessage({ text: 'Lista padrão de canais restaurada!', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Export channels to JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(channels, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `canais_tv_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import channels from JSON
  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onSaveChannels(parsed);
        setShowImportModal(false);
        setImportJsonText('');
        setStatusMessage({ text: `${parsed.length} canais importados com sucesso!`, type: 'success' });
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        alert('Formato de JSON inválido. Deve ser uma lista de canais.');
      }
    } catch {
      alert('Erro ao processar JSON. Verifique a sintaxe.');
    }
  };

  const currentParsed = iframeInput ? parseIframeInput(iframeInput) : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 border transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{statusMessage.text}</span>
        </div>
      )}

      {/* Main Form Box */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 md:p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5 font-['Outfit']">
              <Code className="w-6 h-6 text-cyan-400" />
              <span>{editingId ? 'Editar Canal' : 'Cadastrar Novo Canal ou Iframe'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Cole códigos de iframe (como redecanaistv.af) ou links diretos de transmissão.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Anti-Ad Strategy Button */}
            <button
              type="button"
              onClick={() => setShowAndroidGuideModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Estratégia Anti-Anúncios & Código Android</span>
            </button>

            <button
              type="button"
              onClick={handleInsertUserExample}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-slate-700"
            >
              <Copy className="w-4 h-4" />
              <span>Inserir Iframe de Exemplo</span>
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSaveChannel} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Channel Number */}
            <div className="space-y-1.5">
              <label htmlFor="channel-number-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Número do Canal (CH)
              </label>
              <input
                id="channel-number-input"
                type="number"
                min="1"
                max="999"
                value={channelNumber}
                onChange={(e) => setChannelNumber(parseInt(e.target.value, 10) || 1)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 text-white font-mono text-sm outline-none"
                required
              />
            </div>

            {/* Channel Name */}
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="channel-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Nome do Canal
              </label>
              <input
                id="channel-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Rede Canais - Ao Vivo"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 text-white text-sm outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Category selection */}
            <div className="space-y-1.5">
              <label htmlFor="channel-category-select" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Categoria
              </label>
              <select
                id="channel-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 text-white text-sm outline-none cursor-pointer"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="channel-desc-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Descrição Breve (Opcional)
              </label>
              <input
                id="channel-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Transmissão ao vivo em alta definição"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 text-white text-sm outline-none"
              />
            </div>
          </div>

          {/* Iframe Input Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="channel-iframe-input" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Código do Iframe HTML ou URL de Transmissão
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Aceita URLs codificadas (%72%65%64... = redecanaistv.af)
              </span>
            </div>
            <textarea
              id="channel-iframe-input"
              rows={3}
              value={iframeInput}
              onChange={(e) => setIframeInput(e.target.value)}
              placeholder='<iframe name="Player" src="//redecanaistv.af/player3/ch.php?canal=ver" frameborder="0" ...></iframe>'
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 text-cyan-300 font-mono text-xs outline-none leading-relaxed"
              required
            />

            {/* Parse feedback */}
            {currentParsed && (
              <div className="text-xs flex items-center gap-2 pt-1 font-mono">
                {currentParsed.isValid ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    URL detectada: <span className="text-slate-300 underline">{currentParsed.streamUrl}</span>
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {currentParsed.error}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              id="btn-save-channel"
              type="submit"
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'Salvar Alterações' : 'Salvar Canal na Lista'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* List of Saved Channels & Actions */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white font-['Outfit']">
              Canais Cadastrados ({channels.length})
            </h3>
            <p className="text-xs text-slate-400">
              Os canais ficam salvos no navegador da sua TV e são exibidos em ordem alfabética.
            </p>
          </div>

          {/* Management tools */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Backup</span>
            </button>

            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Lista</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 text-rose-400 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        {/* Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Canal</th>
                <th className="py-3 px-3">Nome</th>
                <th className="py-3 px-3">Categoria</th>
                <th className="py-3 px-3">URL / Iframe</th>
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {channels.map((ch) => (
                <tr key={ch.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-mono font-bold text-cyan-400">
                    CH {String(ch.number).padStart(2, '0')}
                  </td>
                  <td className="py-3 px-3 font-bold text-white">
                    <div className="flex items-center gap-2">
                      <span>{ch.name}</span>
                      {ch.isFavorite && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          ★ Favorito
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                      {ch.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-xs font-mono max-w-xs truncate">
                    {ch.streamUrl}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectChannelToWatch(ch)}
                        title="Assistir Canal"
                        className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition cursor-pointer"
                      >
                        <Tv className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(ch)}
                        title="Editar Canal"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteChannel(ch.id, ch.name)}
                        title="Remover Canal"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Importing JSON */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Importar Lista de Canais (JSON)</h3>
            <p className="text-xs text-slate-400">
              Cole o conteúdo do arquivo JSON exportado para adicionar ou atualizar seus canais.
            </p>
            <textarea
              rows={6}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="[{ id: '...', name: '...', streamUrl: '...' }]"
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs outline-none focus:border-cyan-400"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 cursor-pointer"
              >
                Carregar Canais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Android AdBlock Guide Modal */}
      <AndroidAdBlockModal
        isOpen={showAndroidGuideModal}
        onClose={() => setShowAndroidGuideModal(false)}
      />
    </div>
  );
};
