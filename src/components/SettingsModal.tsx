import React, { useState, useEffect } from 'react';
import {
  X,
  Tv,
  Plus,
  Trash2,
  Edit2,
  ShieldCheck,
  Gamepad2,
  RotateCcw,
  Sliders,
  HelpCircle,
  Code,
  Check,
  Sparkles,
  Smartphone,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { Channel } from '../types';
import { INITIAL_CHANNELS, sortChannelsAlphabetically } from '../utils/defaultChannels';
import {
  getStoredChannelTemplate,
  saveStoredChannelTemplate,
  resetChannelTemplate,
  extractCanalFromInput,
  buildChannelStreamUrl,
  buildChannelIframeCode,
} from '../utils/channelStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  onSaveChannels: (channels: Channel[]) => void;
  onOpenRemoteSimulator: () => void;
  onOpenAdBlockGuide: () => void;
  initialEditingChannel?: Channel | null;
  initialTab?: SettingsTab;
}

type SettingsTab = 'manage_channels' | 'channel_template' | 'navigation' | 'adblock';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  channels,
  onSaveChannels,
  onOpenRemoteSimulator,
  onOpenAdBlockGuide,
  initialEditingChannel,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'manage_channels');

  // Iframe Template State
  const [channelTemplate, setChannelTemplate] = useState<string>(() => getStoredChannelTemplate());
  const [templateSavedFeedback, setTemplateSavedFeedback] = useState<boolean>(false);

  // Channel Form states
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [canalCode, setCanalCode] = useState('');
  const [channelLogo, setChannelLogo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setChannelTemplate(getStoredChannelTemplate());
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (initialEditingChannel) {
        setEditingChannelId(initialEditingChannel.id);
        setChannelName(initialEditingChannel.name);
        setCanalCode(
          initialEditingChannel.canalCode ||
          extractCanalFromInput(initialEditingChannel.iframeCode || initialEditingChannel.streamUrl) ||
          ''
        );
        setChannelLogo(initialEditingChannel.logoUrl || '');
        setActiveTab('manage_channels');
      }
    }
  }, [isOpen, initialEditingChannel, initialTab]);

  if (!isOpen) return null;

  // Salvar o Iframe Padrão dos Canais
  const handleSaveChannelTemplate = () => {
    if (!channelTemplate.trim()) {
      setFormError('O template de iframe não pode ficar vazio.');
      return;
    }
    saveStoredChannelTemplate(channelTemplate);
    setTemplateSavedFeedback(true);
    setFormSuccess('Iframe padrão salvo com sucesso! Os novos canais usarão este modelo.');

    // Atualiza URLs de todos os canais existentes para refletir o novo iframe padrão
    const updatedChannels = channels.map((ch) => {
      const code = ch.canalCode || extractCanalFromInput(ch.iframeCode || ch.streamUrl) || 'ver';
      return {
        ...ch,
        canalCode: code,
        streamUrl: buildChannelStreamUrl(code, channelTemplate),
        iframeCode: buildChannelIframeCode(code, channelTemplate),
      };
    });
    onSaveChannels(sortChannelsAlphabetically(updatedChannels));

    setTimeout(() => {
      setTemplateSavedFeedback(false);
      setFormSuccess(null);
    }, 3500);
  };

  const handleResetChannelTemplate = () => {
    if (confirm('Restaurar o iframe padrão original da Rede Canais?')) {
      const reset = resetChannelTemplate();
      setChannelTemplate(reset);
      setTemplateSavedFeedback(true);
      setFormSuccess('Iframe padrão restaurado para o original!');

      const updatedChannels = channels.map((ch) => {
        const code = ch.canalCode || extractCanalFromInput(ch.iframeCode || ch.streamUrl) || 'ver';
        return {
          ...ch,
          canalCode: code,
          streamUrl: buildChannelStreamUrl(code, reset),
          iframeCode: buildChannelIframeCode(code, reset),
        };
      });
      onSaveChannels(sortChannelsAlphabetically(updatedChannels));

      setTimeout(() => {
        setTemplateSavedFeedback(false);
        setFormSuccess(null);
      }, 3500);
    }
  };

  const handleStartEdit = (ch: Channel) => {
    setEditingChannelId(ch.id);
    setChannelName(ch.name);
    setCanalCode(ch.canalCode || extractCanalFromInput(ch.iframeCode || ch.streamUrl) || '');
    setChannelLogo(ch.logoUrl || '');
    setFormError(null);
    setActiveTab('manage_channels');
  };

  const handleCancelEdit = () => {
    setEditingChannelId(null);
    setChannelName('');
    setCanalCode('');
    setChannelLogo('');
    setFormError(null);
  };

  const handleCanalCodeChange = (rawInput: string) => {
    // Se o usuário colou um iframe inteiro ou URL tipo canal=BD, extrai automaticamente
    const extracted = extractCanalFromInput(rawInput);
    setCanalCode(extracted);
  };

  const handleSaveChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = channelName.trim();
    const cleanCode = extractCanalFromInput(canalCode.trim());

    if (!trimmedName) {
      setFormError('Informe o nome do canal.');
      return;
    }
    if (!cleanCode) {
      setFormError('Informe o código do canal (ex: BD, BG, caze1, dazn1).');
      return;
    }

    const streamUrl = buildChannelStreamUrl(cleanCode, channelTemplate);
    const iframeCode = buildChannelIframeCode(cleanCode, channelTemplate);

    if (editingChannelId) {
      // Editar existente
      const updated = channels.map((c) =>
        c.id === editingChannelId
          ? {
              ...c,
              name: trimmedName,
              canalCode: cleanCode,
              iframeCode,
              streamUrl,
              logoUrl: channelLogo.trim() || undefined,
            }
          : c
      );
      onSaveChannels(sortChannelsAlphabetically(updated));
      setFormSuccess(`Canal "${trimmedName}" atualizado com sucesso!`);
    } else {
      // Novo canal
      const newChannel: Channel = {
        id: `ch-user-${Date.now()}`,
        name: trimmedName,
        canalCode: cleanCode,
        iframeCode,
        streamUrl,
        logoUrl: channelLogo.trim() || undefined,
        createdAt: Date.now(),
      };
      onSaveChannels(sortChannelsAlphabetically([...channels, newChannel]));
      setFormSuccess(`Canal "${trimmedName}" cadastrado com sucesso!`);
    }

    handleCancelEdit();
    setTimeout(() => setFormSuccess(null), 3000);
  };

  const handleDeleteChannel = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja remover o canal "${name}"?`)) {
      const updated = channels.filter((c) => c.id !== id);
      onSaveChannels(sortChannelsAlphabetically(updated));
      if (editingChannelId === id) {
        handleCancelEdit();
      }
      setFormSuccess(`Canal "${name}" removido.`);
      setTimeout(() => setFormSuccess(null), 3000);
    }
  };

  const handleRestoreDefaults = () => {
    if (confirm('Restaurar a lista de canais padrão (Canal BD, BG, Cazé TV, DAZN)?')) {
      onSaveChannels(sortChannelsAlphabetically(INITIAL_CHANNELS));
      setFormSuccess('Canais padrão restaurados com sucesso!');
      setTimeout(() => setFormSuccess(null), 3000);
    }
  };

  const sortedList = sortChannelsAlphabetically(channels);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-8 animate-fade-in select-none">
      <div className="bg-[#0c0c0c] border border-neutral-800 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Gerenciar Canais & Configurações</h2>
              <p className="text-xs text-neutral-400">
                Cadastro por código, iframe padrão, ordem alfabética e controle remoto
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-[#0f0f0f] px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('manage_channels')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'manage_channels'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4 text-white" />
            <span>Salvar Canal ({channels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('channel_template')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'channel_template'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4 text-cyan-400" />
            <span>Salvar Iframe Padrão</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('navigation')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'navigation'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-neutral-400" />
            <span>Instruções do Controle (TV)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adblock')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'adblock'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>App Android TV & Celular (Capacitor)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0c0c0c] text-neutral-200 space-y-6">
          {formSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between">
              <span>{formSuccess}</span>
              <button
                type="button"
                onClick={() => setFormSuccess(null)}
                className="text-emerald-400 hover:text-emerald-100 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: SALVAR CANAL (NOVO / EDITAR) + LISTA COM EDITAR/DELETAR */}
          {activeTab === 'manage_channels' && (
            <div className="space-y-6">
              {/* Formulário Simples: Nome + canal= */}
              <form
                onSubmit={handleSaveChannel}
                className="p-5 rounded-2xl bg-[#141414] border border-neutral-800 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-extrabold uppercase text-white tracking-wider">
                      {editingChannelId ? 'Editar Canal' : 'Salvar Novo Canal'}
                    </h3>
                  </div>
                  {editingChannelId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                {formError && (
                  <p className="text-xs text-red-400 font-medium bg-red-950/40 p-2.5 rounded-lg border border-red-900/50">
                    {formError}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome do Canal */}
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      1. Nome do Canal
                    </label>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder="Ex: Canal BD, Combate, Cazé TV 4, DAZN 3"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0a] border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:border-white outline-none"
                    />
                  </div>

                  {/* Código canal= */}
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      2. Código do Canal (<span className="text-cyan-400 font-mono">canal=</span>)
                    </label>
                    <input
                      type="text"
                      value={canalCode}
                      onChange={(e) => handleCanalCodeChange(e.target.value)}
                      placeholder="Ex: BD, BG, caze1, dazn1 (ou cole o iframe inteiro)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0a] border border-neutral-700 text-xs font-mono text-cyan-300 placeholder-neutral-500 focus:border-cyan-400 outline-none"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Dica: você pode digitar só o código (ex: <span className="text-neutral-300">BD</span>) ou colar o iframe todo que o sistema extrai automaticamente.
                    </p>
                  </div>
                </div>

                {/* Prévia da URL gerada */}
                {canalCode.trim() && (
                  <div className="p-3 rounded-xl bg-black/60 border border-neutral-800 text-[11px] font-mono text-neutral-400 flex items-center gap-2 overflow-x-auto">
                    <span className="text-neutral-500 shrink-0">Stream URL:</span>
                    <span className="text-cyan-300 truncate">
                      {buildChannelStreamUrl(canalCode, channelTemplate)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow"
                  >
                    <Plus className="w-4 h-4 text-black" />
                    <span>{editingChannelId ? 'Salvar Alterações' : 'Salvar Canal'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="text-xs text-neutral-400 hover:text-white transition cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Padrões</span>
                  </button>
                </div>
              </form>

              {/* Lista com Editar / Deletar em ordem alfabética */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase text-neutral-400 tracking-wider">
                    Canais Cadastrados ({sortedList.length}) — Ordem Alfabética (A-Z)
                  </h4>
                  <span className="text-[11px] text-neutral-500">
                    Você pode editar ou excluir qualquer canal a qualquer momento
                  </span>
                </div>

                <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-2xl overflow-hidden bg-[#111]">
                  {sortedList.length === 0 ? (
                    <div className="p-6 text-center text-neutral-500 text-xs">
                      Nenhum canal cadastrado. Preencha o formulário acima para adicionar.
                    </div>
                  ) : (
                    sortedList.map((ch) => (
                      <div
                        key={ch.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#161616] transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono font-bold text-xs text-cyan-300 px-2 py-0.5 rounded bg-black border border-neutral-800 shrink-0">
                            canal={ch.canalCode || 'ver'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{ch.name}</p>
                            <p className="text-[10px] text-neutral-500 font-mono truncate">{ch.streamUrl}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(ch)}
                            title="Editar este canal"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChannel(ch.id, ch.name)}
                            title="Excluir este canal"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-red-300 bg-neutral-900 hover:bg-red-950/40 border border-neutral-800 hover:border-red-800 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SALVAR IFRAME PADRÃO (MOLDE) */}
          {activeTab === 'channel_template' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h3 className="text-base font-extrabold text-white mb-1">
                  Molde de Iframe Padrão para Canais
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  O sistema já vem com o iframe oficial cadastrado. A única coisa que muda em cada canal é o código{' '}
                  <code className="text-cyan-400 font-mono">canal=...</code>. Caso o site altere o domínio ou formato do reprodutor, você só precisa atualizar este iframe uma vez e salvar aqui.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#141414] border border-neutral-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-2 flex items-center justify-between">
                    <span>Código do Iframe Padrão (com a variável <code className="text-cyan-400 font-mono">&#123;canal&#125;</code>)</span>
                    <span className="text-[10px] text-neutral-500 font-normal">
                      Exemplo: ...ch.php?canal=&#123;canal&#125;
                    </span>
                  </label>
                  <textarea
                    rows={4}
                    value={channelTemplate}
                    onChange={(e) => setChannelTemplate(e.target.value)}
                    placeholder='<iframe name="Player" src="//redecanaistv.af/player3/ch.php?canal={canal}" frameborder="0" height="400" scrolling="no" width="640" allow="encrypted-media" allowFullScreen></iframe>'
                    className="w-full p-3.5 rounded-xl bg-black border border-neutral-700 text-xs font-mono text-cyan-300 focus:border-cyan-400 outline-none leading-relaxed"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1.5">
                    Se você colar um iframe já contendo <code className="text-white font-mono">canal=BD</code>, o sistema detecta automaticamente e salva com a marcação <code className="text-cyan-400 font-mono">&#123;canal&#125;</code>.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleSaveChannelTemplate}
                    className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow"
                  >
                    {templateSavedFeedback ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Iframe Salvo!</span>
                      </>
                    ) : (
                      <>
                        <Code className="w-4 h-4 text-black" />
                        <span>Salvar Iframe Padrão</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetChannelTemplate}
                    className="text-xs text-neutral-400 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Iframe Original</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSTRUÇÕES DO CONTROLE REMOTO */}
          {activeTab === 'navigation' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-base font-extrabold text-white mb-1">
                  Guia do Controle Remoto (Android TV / TV Box)
                </h3>
                <p className="text-xs text-neutral-400">
                  Navegue pelos canais usando as setas do controle remoto da sua TV.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 flex items-start gap-3">
                  <div className="px-2 py-1 rounded bg-black text-cyan-400 border border-neutral-700 font-mono font-bold text-xs shrink-0">
                    ▲ / ▼
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Navegar na Lista de Canais</h4>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Sobe e desce pelos canais organizados de A a Z com rolagem suave.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 flex items-start gap-3">
                  <div className="px-2 py-1 rounded bg-black text-cyan-400 border border-neutral-700 font-mono font-bold text-xs shrink-0">
                    OK / ENTER
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Assistir Canal</h4>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Carrega imediatamente a transmissão no player.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 flex items-start gap-3">
                  <div className="px-2 py-1 rounded bg-black text-cyan-400 border border-neutral-700 font-mono font-bold text-xs shrink-0">
                    ◄ / ►
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Alternar Telas</h4>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Alterna o foco entre a lista de canais e o reprodutor.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 flex items-start gap-3">
                  <div className="px-2 py-1 rounded bg-black text-cyan-400 border border-neutral-700 font-mono font-bold text-xs shrink-0">
                    VOLTAR
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Sair ou Fechar Modais</h4>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Retorna à lista de canais ou fecha o player de vídeo em tela cheia.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRemoteSimulator();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  <span>Abrir Controle Remoto Virtual para Testar</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: APP ANDROID TV & CELULAR (CAPACITOR) */}
          {activeTab === 'adblock' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-base font-extrabold text-white mb-1 flex items-center gap-2">
                  <span>Criar App Nativo Android TV & Celular com Capacitor</span>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                    Híbrido
                  </span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Instruções completas para compilar no Android Studio e instalar na Smart TV ou no Smartphone.
                </p>
              </div>

              {/* Botão para abrir o Guia Interativo Completo com copiador de código */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-neutral-900 border border-cyan-500/40 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>Guia Interativo com Códigos Prontos para Copiar</span>
                  </h4>
                  <p className="text-[11px] text-neutral-300">
                    Acesse o passo a passo detalhado com AndroidManifest.xml, MainActivity.java e comandos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdBlockGuide();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow"
                >
                  <span>Abrir Guia Completo</span>
                  <ExternalLink className="w-3.5 h-3.5 text-black" />
                </button>
              </div>

              {/* 5 Comandos Principais */}
              <div className="p-4 rounded-2xl bg-[#141414] border border-neutral-800 space-y-2.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Comandos no Terminal (Pasta do Projeto)</span>
                </h4>
                <pre className="p-3 rounded-xl bg-black border border-neutral-800 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
{`npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android
npx cap sync android
npx cap open android`}
                </pre>
              </div>

              {/* Destaques de Configuração TV + Celular */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#141414] border border-neutral-800 space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Android TV (Principal)</span>
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Tag <code className="text-cyan-300">LEANBACK_LAUNCHER</code> no manifesto, navegação por setas (D-Pad) na MainActivity e banner 320x180 px.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#141414] border border-neutral-800 space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Celular & Tablet</span>
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Tag <code className="text-emerald-300">LAUNCHER</code> tradicional com <code className="text-emerald-300">touchscreen required=false</code> para rodar nos dois.
                  </p>
                </div>
              </div>

              {/* Anti-Anúncios */}
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-emerald-500/40 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Bloqueio Anti-Anúncios & Pop-ups Ativo</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Tanto na Web (via Sandbox estrito do Iframe) quanto no Android nativo (desativando abertura de novas janelas na WebView), cliques acidentais em propagandas não abrem abas nem travam sua TV.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

