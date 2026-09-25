import React, { useRef } from 'react';
import { Smartphone, Tv, CheckCircle2, HelpCircle, X, ShieldAlert, Zap, Film, Sparkles } from 'lucide-react';
import { useModalArrowNavigation } from '../hooks/useModalArrowNavigation';

interface DeviceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceGuideModal: React.FC<DeviceGuideModalProps> = ({ isOpen, onClose }) => {
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  useModalArrowNavigation({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    defaultFocusIndex: 0,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div ref={modalContainerRef} className="bg-white border-2 border-neutral-300 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header em Fundo Branco com Alto Contraste */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-6 bg-[#E50914] rounded-xs shadow-[0_0_6px_#E50914]" />
            <h2 className="text-base font-black tracking-wide text-neutral-950 uppercase font-['Outfit']">
              Guia: Melhor Forma de Usar no Celular e Android TV
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Abas Visuais */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-neutral-800 bg-white">
          {/* Sessão 1: Novo Modo IPTV e Transmissões Ao Vivo */}
          <div className="bg-neutral-900 text-white border-2 border-red-600/40 p-5 rounded-2xl shadow-md">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#E50914] flex items-center justify-center text-white shadow-[0_0_12px_rgba(229,9,20,0.6)]">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-1.5 text-white font-['Outfit']">
                  Aba IPTV: Transmissões Ao Vivo & Gerenciador de Listas
                </h3>
                <span className="text-[10px] text-red-300 font-semibold">
                  Canais ao vivo HLS (.m3u8), reprodução contínua e gerenciador inteligente
                </span>
              </div>
            </div>

            <ul className="space-y-2 text-[11px] leading-relaxed text-neutral-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Navegação pelas Setas entre Filmes e IPTV:</strong> O controle remoto D-PAD navega nos botões superiores <strong>[🎬 Filmes]</strong> e <strong>[📺 IPTV]</strong> com borda de alto contraste.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Gerenciador de Listas & Canais:</strong> Acesse a aba de gerenciamento para visualizar todas as listas importadas, excluir uma lista completa ou marcar canais específicos da lista X para exclusão em lote.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Deletar Canais Fora do Ar Durante Reprodução:</strong> Se um canal estiver offline ou com tela preta, você pode clicar no botão <strong>Excluir Canal Fora do Ar</strong> na tela de sinal ou na gaveta lateral; o app remove o canal e avança imediatamente para o próximo!
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Busca Universal de Canais:</strong> Pesquise qualquer canal e veja todas as opções encontradas, mesmo de listas diferentes ou cadastros avulsos.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Card de Confirmação Seguro:</strong> Todas as exclusões utilizam o card de aviso integrado ao sistema com controle por setas (Sim, Excluir / Cancelar).
                </span>
              </li>
            </ul>
          </div>

          {/* Sessão: Destaque Automático do Mais Assistido */}
          <div className="bg-neutral-50 border-2 border-neutral-200 p-5 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-3 text-neutral-950">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#E50914] flex items-center justify-center text-[#E50914] shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-1.5 font-['Outfit']">
                  Destaque Automático: O Filme Mais Assistido
                </h3>
                <span className="text-[10px] text-neutral-500 font-semibold">
                  Inteligência de catálogo para exibir seu conteúdo favorito no topo
                </span>
              </div>
            </div>

            <ul className="space-y-2 text-[11px] leading-relaxed text-neutral-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Cálculo Automático de Preferência:</strong> Sempre que você assiste a um filme, o NetPlay registra o número de reproduções e o tempo assistido.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Badge Especial 🔥 MAIS ASSISTIDO:</strong> O título que tiver mais visualizações é promovido automaticamente ao topo da tela inicial com banner gigante de cinema e botão rápido de retomar.
                </span>
              </li>
            </ul>
          </div>

          {/* Sessão 1: No Celular / Smartphone Android */}
          <div className="bg-neutral-50 border-2 border-neutral-200 p-5 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-3 text-neutral-950">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#E50914] flex items-center justify-center text-[#E50914] shadow-xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide">
                  No Smartphone & Tablet Android
                </h3>
                <span className="text-[10px] text-neutral-500 font-semibold">
                  Touch nativo, rotação de tela e controles otimizados
                </span>
              </div>
            </div>

            <ul className="space-y-2 text-[11px] leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Rolagem Fluida por Toque:</strong> Role a tela com o polegar. A barra de gêneros permite deslizar horizontalmente com total fluidez.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Tela de Detalhes Centralizada:</strong> Toque no card para abrir os detalhes com botões centralizados e fáceis de tocar no celular.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Retorno Inteligente do Player:</strong> Ao sair do player de vídeo, você volta diretamente para a tela de detalhes do filme sem perder o lugar.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Lembrança de Onde Parou:</strong> O app grava automaticamente os últimos segundos assistidos para retomar na hora certa com barra de progresso vermelha.
                </span>
              </li>
            </ul>
          </div>

          {/* Sessão 2: Na Smart TV / TV Box / Android TV */}
          <div className="bg-neutral-50 border-2 border-neutral-200 p-5 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-3 text-neutral-950">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#E50914] flex items-center justify-center text-[#E50914] shadow-xs">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Na Smart TV & TV Box (Android TV / Google TV / Fire TV)
                </h3>
                <span className="text-[10px] text-neutral-500 font-semibold">
                  Controle remoto 100% nativo com D-PAD sem necessidade de mouse
                </span>
              </div>
            </div>

            <ul className="space-y-2 text-[11px] leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Navegação Perfeita por Setas (D-PAD):</strong> Use as setas (Cima, Baixo, Esquerda, Direita). Seta para cima sobe ordenadamente da grade para as categorias, destaque e topo sem pular ou errar a ordem.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Ações no Card:</strong> Dentro de cada card de filme, pressione <strong>Direita</strong> para alternar entre <strong>[Ver]</strong>, o ícone da caneta <strong>[✏️ Editar]</strong> e a lixeira <strong>[🗑️ Excluir]</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Botão OK / Enter:</strong> Pressione <strong>OK</strong> para abrir detalhes ou executar a ação selecionada.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Botão Voltar Seguro:</strong> Ao pressionar Voltar na tela inicial, o app solicita um segundo toque rápido antes de fechar, evitando saídas acidentais.
                </span>
              </li>
            </ul>
          </div>

          {/* Sessão 3: Importação em Lote (CSV, Planilha, Lista de Links e JSON) */}
          <div className="bg-neutral-50 border-2 border-neutral-200 p-5 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-3 text-neutral-950">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#E50914] flex items-center justify-center text-[#E50914] shadow-xs">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Importação em Lote Inteligente (CSV, Links Diretos e JSON)
                </h3>
                <span className="text-[10px] text-neutral-500 font-semibold">
                  Suporte avançado para links com proxy, tokens de CDN e formatos variados
                </span>
              </div>
            </div>

            <ul className="space-y-2 text-[11px] leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Formato Planilha (CSV / TXT):</strong> Separado por ponto e vírgula (<code>;</code>), vírgula (<code>,</code>) ou barra vertical (<code>|</code>). Exemplo: <code>Gladiador II;https://servidor.com/video.mp4;Ação;2024;Sinopse;auto</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Apenas Links (Uma URL por linha):</strong> Pode colar diretamente apenas os links dos vídeos. O sistema extrai o nome do filme do link automaticamente.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">Suporte Total a JSON:</strong> Aceita arrays <code>[&#123; "Nome": "...", "Link MP4": "..." &#125;]</code> ou objetos únicos, com chaves em maiúsculas ou minúsculas e sem quebrar em vírgulas extras.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-950">URLs com Proxy e Tokens Longos:</strong> Links complexos com parâmetros encadeados (ex: <code>.../proxy?container=videos&url=https://...&nu3zAQc9HC3GbwJq=...</code>) são lidos integralmente sem truncar nem quebrar colunas.
                </span>
              </li>
            </ul>
          </div>

          {/* Sessão 4: Dicas sobre Links com Token Anti-Expiração */}
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl text-[11px] flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#E50914] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-neutral-950 uppercase mb-1">
                Atualização Rápida de Links Expirados
              </h4>
              <p className="text-neutral-700 leading-relaxed font-medium">
                Se algum servidor renovar o token de autenticação temporário do filme, abra os detalhes do filme, clique no ícone da caneta <strong>[✏️ Editar]</strong> e substitua o link. O filme permanece no catálogo com todo o histórico preservado!
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-white flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white font-black text-xs transition cursor-pointer shadow-md shadow-red-500/20 active:scale-95"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
