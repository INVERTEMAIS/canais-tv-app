# NETPLAY: Manual de Criação e Compilação do Aplicativo (Android Studio + Capacitor + Smart TV)

Este manual técnico e arquitetural descreve a estrutura de criação e compilação do **NETPLAY** para **Smartphones Android** e **Smart TVs (Android TV, Google TV, Fire TV, TV Boxes)**, cobrindo o suporte nativo a **Filmes On-Demand (MP4)**, **Canais IPTV Ao Vivo (HLS .m3u8)**, navegação fluida por controle remoto **D-PAD**, **Gerenciador de Listas** e compilação de APKs de alto rendimento.

---

## 📑 ÍNDICE

1. [Identidade e Especificações do App](#1-identidade-e-especificações-do-app)
2. [Arquitetura Híbrida: Filmes On-Demand + IPTV Ao Vivo](#2-arquitetura-híbrida-filmes-on-demand--iptv-ao-vivo)
3. [Design dos Componentes e Posicionamento de Categorias](#3-design-dos-componentes-e-posicionamento-de-categorias)
4. [Engenharia de Navegação por Setas (D-PAD Android TV)](#4-engenharia-de-navegação-por-setas-d-pad-android-tv)
5. [Sistema de Exclusão com Cards de Aviso no Sistema](#5-sistema-de-exclusão-com-cards-de-aviso-no-sistema)
6. [Gerenciador de Listas e Canais IPTV](#6-gerenciador-de-listas-e-canais-iptv)
7. [Player HLS e Exclusão de Canais Offline Durante Reprodução](#7-player-hls-e-exclusão-de-canais-offline-durante-reprodução)
8. [Configurações Nativas Android (AndroidManifest, MainActivity e Capacitor)](#8-configurações-nativas-android-androidmanifest-mainactivity-e-capacitor)
9. [Passo a Passo de Compilação do APK no Android Studio](#9-passo-a-passo-de-compilação-do-apk-no-android-studio)
10. [Instalação e Testes na Smart TV e Celular](#10-instalação-e-testes-na-smart-tv-e-celular)

---

## 1. Identidade e Especificações do App

- **Nome Oficial:** `NETPLAY`
- **Application ID:** `com.netplay.app`
- **Padrão de Cores:**
  - Fundo Primário: Branco Puro (`#FFFFFF`) e Cinza Suave (`#F8F9FA`)
  - Painéis Cinematográficos: Preto Ônix (`#000000`, `#141414`, `#1A0808`)
  - Cor de Acento e Foco: Vermelho Vibrante NetPlay (`#E50914`)
  - Tipografia: Outfit / Sans-Serif de Alta Legibilidade
- **Suporte de Mídia:**
  - Filmes: Arquivos de vídeo `.mp4` Full HD / 4K / Webm
  - IPTV: Transmissões contínuas HLS (`.m3u8`), TS streams e RTMP

---

## 2. Arquitetura Híbrida: Filmes On-Demand + IPTV Ao Vivo

O NETPLAY é estruturado em React 18 + Vite com TypeScript e Tailwind CSS:

```text
src/
├── components/
│   ├── NetflixMoviesApp.tsx       <- Container principal e roteamento entre abas
│   ├── IptvView.tsx               <- Visão de grade de canais e banner hero IPTV
│   ├── IptvManagerView.tsx        <- Gerenciador completo de listas e canais
│   ├── IptvPlayer.tsx             <- Player HLS com menu de canais e exclusão ao vivo
│   ├── NativeMoviePlayer.tsx      <- Player nativo cinema com salvamento de progresso
│   ├── AddMovieModal.tsx          <- Cadastro e edição de filmes MP4
│   ├── AddIptvChannelModal.tsx    <- Cadastro unitário e importador de listas M3U
│   ├── BatchImportModal.tsx       <- Importador em lote de filmes via CSV / Excel
│   ├── DeviceGuideModal.tsx       <- Manual de uso embutido na interface
│   └── LinkDiagnosticsModal.tsx   <- Painel de diagnóstico de links e renovação de tokens
├── types/
│   ├── movies.ts                  <- Tipagem de filmes, categorias e progresso
│   └── iptv.ts                    <- Tipagem de canais IPTV, listas e qualidades
└── utils/
    ├── moviesCatalogStorage.ts    <- Persistência e catálogo de filmes
    ├── iptvStorage.ts             <- Persistência de canais IPTV e listas
    ├── iptvParser.ts              <- Parser avançado M3U/M3U8 com detecção de grupos
    └── playerSecurity.ts          <- Sanitização e aceleração de vídeo
```

---

## 3. Design dos Componentes e Posicionamento de Categorias

A interface foi refinada para máxima usabilidade:
1. **Cabeçalho Limpo:** Foram retiradas todas as categorias horizontais do topo. O cabeçalho abriga exclusivamente a marca NETPLAY, o alternador de abas `[🎬 Filmes]` / `[📺 IPTV]`, a busca rápida e os botões de ação (`Guia`, `Lote/M3U`, `Links`, `+ Adicionar`).
2. **Categorias Estratégicas:** Tanto no modo de Filmes quanto no modo IPTV, a barra de categorias fica posicionada **abaixo do banner hero de destaque e logo acima do catálogo de cards**.
3. **Alto Contraste e Acessibilidade:** Botões e cards possuem anéis de seleção vibrantes (`ring-4 ring-[#E50914]`) permitindo fácil identificação visual em telas de 40 a 75 polegadas.

---

## 4. Engenharia de Navegação por Setas (D-PAD Android TV)

Para dispensar completamente mouses virtuais (*air-mouse*), o arquivo `NetflixMoviesApp.tsx` implementa uma máquina de estados de navegação D-PAD com **4 zonas físicas ordenadas**:

```text
[ ZONA 1: HEADER ]        -> Filmes ↔ IPTV ↔ Buscar ↔ Guia ↔ Lote ↔ Links ↔ Adicionar
       ↕
[ ZONA 2: HERO BANNER ]    -> Assistir Destaque ↔ Editar/Favoritar
       ↕
[ ZONA 3: CATEGORIAS ]     -> Todos ↔ Gênero 1 ↔ Gênero 2 ↔ Gênero 3...
       ↕
[ ZONA 4: GRADE DE CARDS ] -> [ Card Anterior ↔ Card Atual ↔ Próximo Card ]
                               [ Ações: Assistir ↔ Favoritar ↔ Editar ↔ Excluir ]
```

### Comportamento Geométrico da Grade
- A função `getGridColumns()` calcula em tempo real o número exato de colunas visíveis no monitor da Smart TV.
- Pressionar **Seta Abaixo (↓)** salta exatamente uma linha física (`index + cols`).
- Pressionar **Seta Acima (↑)** sobe geometricamente (`index - cols`); se estiver na primeira linha física, transfere o foco suavemente para a barra de Categorias.
- As teclas físicas **MENU** e **DELETE** do controle remoto acionam diretamente a edição ou exclusão do item focado.

---

## 5. Sistema de Exclusão com Cards de Aviso no Sistema

Para cumprir as diretrizes de experiência nativa e evitar os alertas cinzas padrões dos navegadores (`window.confirm`), o sistema utiliza um **Card de Aviso no Sistema**:
- **Design:** Modal centralizado com borda vermelha vibrante, ícone de lixeira e o nome do filme ou canal em destaque com fundo claro e tipografia preta.
- **Teclado e Controle:** Foco padrão no botão de cancelamento (`Cancelar`), permitindo confirmar (`Sim, Excluir`) pelas setas horizontais do controle e tecla Enter. Tecla Voltar/Back fecha o card imediatamente.
- **Segurança de Operação:** Aplicado de forma padronizada em exclusões de filmes, exclusões unitárias de canais IPTV, exclusões em lote e exclusões de listas completas.

---

## 6. Gerenciador de Listas e Canais IPTV

O componente `IptvManagerView.tsx` foi desenvolvido especialmente para listas volumosas:
1. **Visão por Listas & Grupos:**
   - Lista todas as listas M3U importadas com contagem de canais.
   - Opção para **Deletar Lista Completa** de uma só vez com confirmação segura.
   - Opção para expandir uma lista, marcar canais específicos com checkboxes e excluir apenas os selecionados da lista X.
2. **Visão de Todos os Canais:**
   - Listagem completa de todos os canais cadastrados no app.
   - Ações de seleção múltipla global para remoção em massa.
   - Botão **Limpar Todos os Canais** para restaurar a grade a zero.
3. **Busca Universal:**
   - A pesquisa por texto busca instantaneamente em múltiplos campos: nome do canal, categoria, URL e nome da lista de origem. Ao pesquisar "Canal X", todos os canais com esse nome são retornados, mesmo que venham de listas diferentes ou tenham sido cadastrados individualmente.

---

## 7. Player HLS e Exclusão de Canais Offline Durante Reprodução

O componente `IptvPlayer.tsx` utiliza a biblioteca de alta performance `Hls.js` integrada ao elemento `<video>` nativo do HTML5:
1. **Tratamento de Quedas de Sinal:** Se um link estiver indisponível ou fora do ar, o player exibe uma tela amigável com o botão de destaque:
   `[🗑️ Excluir Canal Fora do Ar]`.
2. **Remoção sem Interrupção:** Ao clicar em excluir, o canal é eliminado do armazenamento e o player avança automaticamente para o próximo canal da lista.
3. **Acesso Rápido:** Um botão de lixeira fica disponível na barra superior OSD e em cada canal dentro da gaveta lateral de canais (tecla **C**).
4. **Atalho Remoto:** Pressionar a tecla **DELETE** no controle remoto durante a reprodução aciona o card de aviso para remoção rápida do canal defeituoso.

---

## 8. Configurações Nativas Android (AndroidManifest, MainActivity e Capacitor)

### capacitor.config.json
```json
{
  "appId": "com.netplay.app",
  "appName": "NETPLAY",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "server": {
    "cleartext": true,
    "allowNavigation": ["*"]
  },
  "android": {
    "allowMixedContent": true,
    "webContentsDebuggingEnabled": true
  }
}
```

### AndroidManifest.xml (Híbrido Smartphone + Smart TV)
- Touchscreen declarado como não obrigatório para permitir instalação em TVs:
  ```xml
  <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
  <uses-feature android:name="android.software.leanback" android:required="false" />
  ```
- Banner de TV no manifesto:
  ```xml
  android:banner="@drawable/tv_banner"
  android:usesCleartextTraffic="true"
  android:hardwareAccelerated="true"
  ```

### MainActivity.java (Despacho de Teclas D-PAD e Vídeo)
- Configuração do WebView com decodificação por hardware, mixed content e repasse de teclas:
  ```java
  webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
  webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  ```

---

## 9. Passo a Passo de Criação e Compilação com ZIP / Pasta Local no PC (Sem GitHub)

Não é necessário usar GitHub ou Git! Você pode baixar o arquivo ZIP completo do projeto diretamente no Google AI Studio e trabalhar 100% na sua máquina local:

### Passo 1: Baixar e Descompactar o Projeto
1. No Google AI Studio, clique na opção de **Download / Exportar ZIP** do projeto.
2. Descompacte o arquivo `.zip` em uma pasta de sua escolha no seu computador:
   - **Exemplo no Windows:** `C:\projetos\netplay`
   - **Exemplo no Mac/Linux:** `~/projetos/netplay`

### Passo 2: Instalar Dependências e Gerar o Build
Abra o terminal (Prompt de Comando ou PowerShell no Windows, Terminal no Mac/Linux) dentro da pasta descompactada:
```bash
# 1. Instalar as dependências do projeto (Capacitor e React já inclusos no package.json)
npm install

# 2. Gerar o build da aplicação Web de alta velocidade
npm run build

# 3. Sincronizar os arquivos compilados com a pasta nativa Android
npx cap sync android
```

### Passo 3: Abrir no Android Studio
Você tem duas opções fáceis para abrir o projeto:

- **Opção A (Pelo Terminal):**
  ```bash
  npx cap open android
  # ou: npm run cap:open
  ```

- **Opção B (Direto pelo Android Studio):**
  1. Abra o **Android Studio**.
  2. Clique em **File > Open** (ou *Open Project*).
  3. Navegue até a pasta do projeto descompactada e selecione a subpasta **`android`**.
  4. O Android Studio reconhecerá o projeto Gradle imediatamente.

### Passo 4: Estrutura Nativa Android Já Pronta
A pasta `android/` já está 100% configurada:
- `build.gradle`, `settings.gradle` e `variables.gradle` prontos para compilação.
- `app/build.gradle` configurado com `applicationId: com.netplay.app` e SDK 34.
- `AndroidManifest.xml` configurado para **Android TV (Leanback Launcher)** e **Smartphones (Touchscreen opcional)**.
- `MainActivity.java` configurado com repasse de teclas do controle remoto **D-PAD**, aceleração de hardware e mixed content para streaming contínuo.

### Passo 5: Gerar o APK Instalável
1. No Android Studio, aguarde o processo **Gradle Sync Finished** (barra inferior).
2. No menu superior, vá em:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. Aguarde alguns segundos até a notificação no canto inferior direito informando:
   *`APK(s) generated successfully for module 'netplay.app'`*.
4. Clique no link azul **`locate`** na notificação (ou abra a pasta `android/app/build/outputs/apk/debug/`).
5. O arquivo **`app-debug.apk`** estará pronto para ser instalado!

---

## 10. Instalação e Testes na Smart TV e Celular

### Na Smart TV (Android TV, Google TV, TV Box, Fire TV):
1. **Método Pen Drive:**
   - Copie o arquivo `app-debug.apk` para um pen drive.
   - Conecte o pen drive na porta USB da sua TV ou TV Box.
   - Abra um gerenciador de arquivos (ex: *File Commander*, *X-plore* ou *AnExplorer*) e selecione o APK para instalar.
2. **Método Sem Fio (Send Files to TV):**
   - Instale o app gratuito **Send Files to TV** na TV e no celular/PC.
   - Transfira o APK pela rede Wi-Fi e instale diretamente na TV.
3. **Método App Downloader (Fire TV):**
   - No Fire TV, use o app *Downloader* para baixar o APK hospedado em um link direto (Google Drive, Dropbox, Mediafire).
4. **Experiência na TV:**
   - O aplicativo aparecerá na grade inicial da TV com o banner 16:9 oficial do **NETPLAY**.
   - Toda a navegação funciona 100% pelas setas (D-PAD) do controle remoto!

### No Celular Android (Smartphone / Tablet):
1. Transfira o arquivo `app-debug.apk` para o celular (via WhatsApp, Telegram, cabo USB ou Google Drive).
2. Toque no arquivo APK e confirme a instalação (habilite "Instalar de fontes desconhecidas" se o Android solicitar).
3. O aplicativo se ajusta automaticamente com rolagem vertical suave, comandos táteis e rotação de tela para modo cinema widescreen.
