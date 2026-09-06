import React, { useState } from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  X,
  Smartphone,
  Tv,
  Terminal,
  Code,
  Download,
  FolderTree,
  ExternalLink,
  Laptop,
  GitBranch,
  Github
} from 'lucide-react';

interface AndroidAdBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = 'github_flow' | 'google_services' | 'terminal' | 'manifest' | 'main_activity' | 'capacitor_config' | 'export_apk';

export const AndroidAdBlockModal: React.FC<AndroidAdBlockModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('github_flow');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const gitCommands = `# 1. Inicializar o repositório Git local
git init

# 2. Definir a branch principal como main
git branch -M main

# 3. Adicionar todos os arquivos do projeto (o .gitignore protegerá os arquivos temporários)
git add .

# 4. Fazer o commit inicial
git commit -m "feat: configuracao inicial do app canais tv com capacitor e suporte android tv"

# 5. Conectar ao seu repositório no GitHub (substitua com o link do seu repo)
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# 6. Enviar para o GitHub
git push -u origin main`;

  const gitignoreCode = `# Node & Dependências
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
bun.lockb

# Build Web (Vite)
dist/
dist-ssr/
build/
coverage/

# Variáveis de Ambiente
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
!.env.example

# Arquivos temporários e SO
.DS_Store
Thumbs.db
*.log

# Android & Gradle (Capacitor)
android/.gradle/
android/build/
android/app/build/
android/captures/
android/.cxx/
android/local.properties

# Android Studio & IDEs
.idea/
*.iml
android/*.iml
android/app/*.iml
.vscode/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Pacotes de compilação Android (APKs e Bundles)
*.apk
*.aab
*.keystore
*.jks`;

  const cloneCommands = `# Em um computador novo ou após baixar do GitHub:
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO

# 1. Instalar as dependências do projeto
npm install

# 2. Instalar dependências nativas do Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Gerar a build de produção Web
npm run build

# 4. Adicionar a plataforma Android (se for a 1ª vez criando a pasta android)
npx cap add android

# 5. Sincronizar o código Web com o Android Studio
npx cap sync android

# 6. Abrir o projeto diretamente no Android Studio
npx cap open android`;

  const googleServicesJsonCode = `{
  "project_info": {
    "project_number": "88349835370",
    "project_id": "micro-catcher-mpthm",
    "storage_bucket": "micro-catcher-mpthm.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:88349835370:android:8af9985f745c5246230a13",
        "android_client_info": {
          "package_name": "com.canaistv.app"
        }
      },
      "oauth_client": [
        {
          "client_id": "88349835370-5hu1uhpqp30g101ivilk8406gb6iv66t.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "AIzaSyDhp3AovgFu23w6SdknzvWrPBEmBHmR7FI"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [
            {
              "client_id": "88349835370-5hu1uhpqp30g101ivilk8406gb6iv66t.apps.googleusercontent.com",
              "client_type": 3
            }
          ]
        }
      }
    }
  ],
  "configuration_version": "1"
}`;

  const capacitorConfigCode = `{
  "appId": "com.canaistv.app",
  "appName": "Canais TV",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": true,
    "allowNavigation": [
      "*.redecanaistv.af",
      "redecanaistv.af",
      "*.redecanais.*",
      "*"
    ]
  },
  "android": {
    "allowMixedContent": true,
    "captureInput": true,
    "webContentsDebuggingEnabled": false
  }
}`;

  const manifestCode = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissões necessárias de rede -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- 
      CONFIGURAÇÃO HÍBRIDA (ANDROID TV + CELULAR):
      android:required="false" é o segredo para funcionar em ambos!
      Permite instalar em TVs sem touchscreen e celulares sem leanback.
    -->
    <uses-feature
        android:name="android.software.leanback"
        android:required="false" />
    <uses-feature
        android:name="android.hardware.touchscreen"
        android:required="false" />
    <uses-feature
        android:name="android.hardware.wifi"
        android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:banner="@drawable/banner">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">

            <!-- 1. INTENT FILTER PARA CELULARES E TABLETS -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- 2. INTENT FILTER OBRIGATÓRIO PARA ANDROID TV / GOOGLE TV / FIRE TV -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>

</manifest>`;

  const mainActivityCode = `package com.canaistv.app;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Obtém a WebView do Capacitor
        webView = this.bridge.getWebView();

        if (webView != null) {
            // 1. SUPORTE A CONTROLE REMOTO D-PAD NA ANDROID TV
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();

            WebSettings settings = webView.getSettings();

            // 2. CONFIGURAÇÕES DO PLAYER E REPRODUÇÃO
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false); // Autoplay sem clique físico

            // 3. BLOQUEIO DE ANÚNCIOS, POP-UPS E NOVAS ABAS
            settings.setSupportMultipleWindows(false); // Impede que anúncios abram novas janelas
            settings.setJavaScriptCanOpenWindowsAutomatically(false); // Bloqueia window.open()
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            // 4. INTERCEPTADOR DE REDIRECIONAMENTOS EXTERNOS
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String url = request.getUrl().toString();
                    
                    // Bloqueia tentativas de abrir Play Store de anúncios ou redirects suspeitos
                    if (url.startsWith("market://") || url.startsWith("intent://") || url.contains("adclick") || url.contains("doubleclick")) {
                        return true; // Aborta e não abre na TV
                    }
                    return false;
                }
            });
        }
    }

    // 5. NAVEGAÇÃO DO BOTÃO 'VOLTAR' NO CONTROLE DA TV E CELULAR
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }
}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fade-in select-none">
      <div className="bg-[#0e0e0e] border border-neutral-800 rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-white border border-neutral-700">
              <Tv className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-extrabold text-white">
                  Manual de Publicação GitHub, Capacitor & Android Studio
                </h2>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                  Android TV + Celular
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Passo a passo completo com arquivos prontos para salvar no Git e compilar o APK
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
        <div className="flex border-b border-neutral-800 bg-[#0a0a0a] px-4 md:px-6 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('github_flow')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'github_flow'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>1. GitHub & .gitignore</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'terminal'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>2. Comandos do Capacitor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('google_services')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'google_services'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FolderTree className="w-4 h-4 text-amber-400" />
            <span>3. google-services.json (Firebase)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manifest')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'manifest'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>4. AndroidManifest.xml</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('main_activity')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'main_activity'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>5. MainActivity.java</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('capacitor_config')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'capacitor_config'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>6. capacitor.config.json</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export_apk')}
            className={`py-3 px-4 font-bold text-xs tracking-wider transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'export_apk'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>7. Gerar APK & Instalar na TV</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 text-neutral-300 text-xs">
          {/* TAB 1: GITHUB & GITIGNORE */}
          {activeTab === 'github_flow' && (
            <div className="space-y-5 max-w-4xl">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Github className="w-4 h-4 text-cyan-400" />
                  <span>Passo 1: Subir para o GitHub e Configurar o .gitignore</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  O arquivo <code className="text-cyan-300">.gitignore</code> já foi criado na raiz do seu projeto para proteger os arquivos e evitar subir gigabytes de caches do Android e Gradle.
                </p>
              </div>

              {/* Sub-seção A: Comandos Git */}
              <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>Comandos no Terminal para Enviar ao GitHub:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(gitCommands, 'gitCommands')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                  >
                    {copiedSection === 'gitCommands' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Copiar Comandos Git</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg bg-black border border-neutral-800 p-3 font-mono text-cyan-300 overflow-x-auto text-[11px] leading-relaxed">
                  {gitCommands}
                </pre>
              </div>

              {/* Sub-seção B: Arquivo .gitignore */}
              <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-emerald-400" />
                      <span>Conteúdo do Arquivo .gitignore (Raiz do Projeto)</span>
                    </span>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Ignora <code className="text-white">node_modules</code>, <code className="text-white">dist</code>, <code className="text-white">android/.gradle</code> e <code className="text-white">local.properties</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(gitignoreCode, 'gitignoreCode')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                  >
                    {copiedSection === 'gitignoreCode' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Copiar .gitignore</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="rounded-lg bg-black border border-neutral-800 p-3 font-mono text-emerald-300 overflow-x-auto text-[11px] leading-relaxed max-h-[30vh]">
                  {gitignoreCode}
                </pre>
              </div>

              {/* Dica de Clonagem */}
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 text-xs flex items-start gap-3">
                <Github className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-bold">Ao clonar em um novo computador com Android Studio:</strong>
                  <p className="text-cyan-300/80 leading-relaxed">
                    Basta rodar <code className="bg-black/60 px-1 py-0.5 rounded text-white">git clone &lt;link&gt;</code>, entrar na pasta e executar <code className="bg-black/60 px-1 py-0.5 rounded text-white">npm install</code>. Em seguida, siga para a aba "2. Comandos do Capacitor".
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMANDOS DO CAPACITOR */}
          {activeTab === 'terminal' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Passo 2: Instalação e Inicialização do Capacitor
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Abra o terminal na pasta do projeto e execute os comandos abaixo sequencialmente:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cloneCommands, 'terminal')}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                >
                  {copiedSection === 'terminal' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar Comandos</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl bg-black border border-neutral-800 p-4 font-mono text-cyan-300 overflow-x-auto text-[11px] leading-relaxed">
                <pre>{cloneCommands}</pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 space-y-1.5">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    Scripts Rápidos (já adicionados no package.json):
                  </span>
                  <p className="text-neutral-400 leading-relaxed text-[11px]">
                    Depois da 1ª vez, sempre que alterar algo e quiser atualizar o Android Studio:
                  </p>
                  <code className="block bg-black px-3 py-1.5 rounded text-white font-mono text-[11px]">
                    npm run cap:sync
                  </code>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 space-y-1.5">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Abrir o Android Studio pelo terminal:
                  </span>
                  <p className="text-neutral-400 leading-relaxed text-[11px]">
                    Você pode abrir o projeto nativo a qualquer momento digitando:
                  </p>
                  <code className="block bg-black px-3 py-1.5 rounded text-white font-mono text-[11px]">
                    npm run cap:open
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* TAB GOOGLE SERVICES (FIREBASE) */}
          {activeTab === 'google_services' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Arquivo: android/app/google-services.json</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Projeto Firebase criado: <code className="text-cyan-300 font-mono">micro-catcher-mpthm</code>. O arquivo já foi gerado na pasta <code className="text-emerald-300">android/app/</code> e <code className="text-emerald-300">app/</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(googleServicesJsonCode, 'googleServicesJsonCode')}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                >
                  {copiedSection === 'googleServicesJsonCode' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar google-services.json</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl bg-black border border-neutral-800 p-4 font-mono text-amber-300 overflow-x-auto text-[11px] leading-relaxed max-h-[45vh]">
                <pre>{googleServicesJsonCode}</pre>
              </div>

              <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 space-y-2">
                <span className="font-bold text-white text-xs block">
                  Onde colocar este arquivo no Android Studio:
                </span>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  No seu projeto Android compilado pelo Capacitor, coloque o arquivo em:
                  <br />
                  📁 <code className="text-cyan-300 font-mono bg-black px-2 py-0.5 rounded">android/app/google-services.json</code>
                  <br />
                  *(Também salvamos uma cópia em <code className="text-white font-mono bg-black px-2 py-0.5 rounded">app/google-services.json</code> e na raiz do projeto)*.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ANDROID MANIFEST */}
          {activeTab === 'manifest' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Passo 3: android/app/src/main/AndroidManifest.xml
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Habilita o ícone na tela inicial da TV (<code className="text-cyan-400">LEANBACK_LAUNCHER</code>) e no Celular (<code className="text-cyan-400">LAUNCHER</code>).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(manifestCode, 'manifest')}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                >
                  {copiedSection === 'manifest' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar AndroidManifest.xml</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl bg-black border border-neutral-800 p-4 font-mono text-cyan-300 overflow-x-auto text-[11px] leading-relaxed max-h-[50vh]">
                <pre>{manifestCode}</pre>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-3">
                <Tv className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-1">Banner Obrigatório para Android TV (320x180 px):</strong>
                  A Android TV exige um banner retangular de 320x180 pixels salvo em <code className="bg-black/60 px-1 py-0.5 rounded text-white">android/app/src/main/res/drawable/banner.png</code>. Sem ele, a TV não mostra o card do app na tela de início.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MAIN ACTIVITY */}
          {activeTab === 'main_activity' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Passo 4: android/app/src/main/java/com/canaistv/app/MainActivity.java
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Habilita foco do controle remoto D-Pad da TV e bloqueia janelas de anúncios.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(mainActivityCode, 'main_activity')}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                >
                  {copiedSection === 'main_activity' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar MainActivity.java</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl bg-black border border-neutral-800 p-4 font-mono text-cyan-300 overflow-x-auto text-[11px] leading-relaxed max-h-[50vh]">
                <pre>{mainActivityCode}</pre>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141414] border border-neutral-800 text-neutral-300 text-xs">
                <strong className="text-white block mb-1">O que este código faz na prática:</strong>
                <ul className="list-disc pl-5 space-y-1 text-neutral-400">
                  <li><strong className="text-neutral-200">setFocusable(true)</strong>: Permite que as setas (cima, baixo, esquerda, direita) do controle remoto da TV naveguem naturalmente entre os canais.</li>
                  <li><strong className="text-neutral-200">setSupportMultipleWindows(false)</strong>: Anúncios que tentam abrir novas janelas com cliques falsos são instantaneamente neutralizados.</li>
                  <li><strong className="text-neutral-200">onKeyDown(KEYCODE_BACK)</strong>: Faz o botão 'Voltar' do controle retornar de um canal ou fechar modais em vez de encerrar o app abruptamente.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/70 text-emerald-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Por que o site acusou 'Página Bloqueada' e como foi resolvido:</span>
                </div>
                <p className="text-emerald-300/90 leading-relaxed">
                  O player do RedeCanais possui um script de proteção que verifica se o <code className="bg-black/40 px-1 py-0.5 rounded text-white">&lt;iframe&gt;</code> possui restrições HTML de <code className="bg-black/40 px-1 py-0.5 rounded text-white">sandbox</code> bloqueando popups. Quando detecta o sandbox restrito, ele substitui a tela do vídeo pelo aviso de bloqueio.
                </p>
                <p className="text-emerald-300/90 leading-relaxed">
                  <strong>A Solução:</strong> O app agora usa por padrão o <strong>Modo Direto</strong> (sem sandbox no HTML), fazendo com que o player do RedeCanais funcione normalmente sem disparar o detector. No Android APK, o bloqueio de popups e propagandas indesejadas é feito <strong>nativamente na WebView</strong> pelo código acima do <code className="bg-black/40 px-1 py-0.5 rounded text-white">MainActivity.java</code>, que suprime as janelas sem alertar o site!
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: CAPACITOR CONFIG */}
          {activeTab === 'capacitor_config' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Passo 6: capacitor.config.json (Raiz do Projeto)
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Já criado e configurado automaticamente no seu projeto com permissão para streams e iframes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(capacitorConfigCode, 'capacitor_config')}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
                >
                  {copiedSection === 'capacitor_config' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar capacitor.config.json</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl bg-black border border-neutral-800 p-4 font-mono text-cyan-300 overflow-x-auto text-[11px] leading-relaxed">
                <pre>{capacitorConfigCode}</pre>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed">
                A flag <code className="text-white bg-neutral-900 px-1.5 py-0.5 rounded">cleartext: true</code> e <code className="text-white bg-neutral-900 px-1.5 py-0.5 rounded">allowMixedContent: true</code> são vitais para evitar que o Android bloqueie transmissões HTTP ou URLs com certificados dinâmicos.
              </p>
            </div>
          )}

          {/* TAB 7: GERAR APK & INSTALAR NA TV */}
          {activeTab === 'export_apk' && (
            <div className="space-y-5 max-w-4xl">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Passo 7: Compilar o APK e Instalar na Smart TV e Celular
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Como gerar o arquivo <code className="text-white font-mono">.apk</code> no Android Studio e instalar na TV.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Como Gerar APK */}
                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>No Android Studio (Gerar APK):</span>
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5 text-neutral-400 text-xs">
                    <li>Abra o projeto com o comando <code className="text-cyan-300">npx cap open android</code>.</li>
                    <li>No menu superior, clique em: <strong className="text-white">Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.</li>
                    <li>Aguarde o Gradle terminar a compilação.</li>
                    <li>Clique no link azul <strong className="text-cyan-300 font-bold">locate</strong> na notificação inferior direita.</li>
                    <li>Pronto! O arquivo <code className="text-emerald-400 font-mono">app-debug.apk</code> estará na pasta.</li>
                  </ol>
                </div>

                {/* Instalar na TV */}
                <div className="p-4 rounded-xl bg-[#141414] border border-neutral-800 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <Tv className="w-4 h-4 text-emerald-400" />
                    <span>Instalar na TV / TV Box:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-2 text-neutral-400 text-xs">
                    <li>
                      <strong className="text-white">Opção 1 (Pen Drive):</strong> Copie o <code className="text-emerald-400">app-debug.apk</code> para um pen drive, conecte na TV e use um gerenciador de arquivos (ex: File Commander) para instalar.
                    </li>
                    <li>
                      <strong className="text-white">Opção 2 (App Downloader):</strong> No Fire TV ou Android TV, baixe o aplicativo <em>Downloader</em>, hospede seu APK no Google Drive ou Mediafire e digite o link para baixar direto na TV.
                    </li>
                    <li>
                      <strong className="text-white">Opção 3 (No Celular):</strong> Basta enviar o arquivo APK por WhatsApp ou Telegram para o celular e clicar em "Instalar".
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-[#121212] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Configuração pronta para GitHub, Android TV, Google TV e Smartphones Android.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
