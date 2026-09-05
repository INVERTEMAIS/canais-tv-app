# Manual Completo: Publicar no GitHub e Gerar App Android TV & Celular com Capacitor e Android Studio

Este manual reúne todas as etapas e códigos necessários para versionar este projeto no **GitHub**, cloná-lo em qualquer computador e compilar o aplicativo nativo (**APK**) com suporte híbrido perfeito tanto para **Smart TVs (Android TV, Google TV, Fire TV, TV Boxes)** quanto para **Smartphones e Tablets Android**.

---

## ÍNDICE RÁPIDO

1. [O que deve e não deve ir pro Git (.gitignore)](#1-o-que-deve-e-não-deve-ir-pro-git-gitignore)
2. [Como Enviar o Projeto para o GitHub](#2-como-enviar-o-projeto-para-o-github)
3. [Como Clonar e Configurar em uma Nova Máquina](#3-como-clonar-e-configurar-em-uma-nova-máquina)
4. [Instalação e Sincronização do Capacitor](#4-instalação-e-sincronização-do-capacitor)
5. [Código 1: capacitor.config.json](#5-código-1-capacitorconfigjson)
6. [Código 2: AndroidManifest.xml (Híbrido TV + Celular)](#6-código-2-androidmanifestxml-híbrido-tv--celular)
7. [Código 3: MainActivity.java (D-Pad da TV + Bloqueio de Anúncios)](#7-código-3-mainactivityjava-d-pad-da-tv--bloqueio-de-anúncios)
8. [Banner Obrigatório da Android TV (320x180 px)](#8-banner-obrigatório-da-android-tv-320x180-px)
9. [Como Compilar o APK no Android Studio](#9-como-compilar-o-apk-no-android-studio)
10. [Como Instalar na Smart TV e no Celular](#10-como-instalar-na-smart-tv-e-no-celular)
11. [Rotina de Atualizações Futuras com o GitHub](#11-rotina-de-atualizações-futuras-com-o-github)

---

## 1. O que deve e não deve ir pro Git (.gitignore)

Para não poluir o repositório no GitHub com gigabytes de arquivos temporários, bibliotecas pesadas do Gradle e caminhos de SDK específicos da sua máquina, o arquivo `.gitignore` na raiz do projeto já está configurado:

### Conteúdo do arquivo `/.gitignore`:
```gitignore
# Node & Dependências
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
*.jks
```

> **Por que o arquivo `android/local.properties` é ignorado?**  
> Porque ele grava o caminho absoluto do SDK no seu computador pessoal (ex: `C:\Users\Nome\AppData\Local\Android\Sdk`). Se for pro Git, causará erros em outras máquinas. O Android Studio recria esse arquivo automaticamente em cada computador!

---

## 2. Como Enviar o Projeto para o GitHub

1. Acesse o [GitHub](https://github.com) e crie um novo repositório vazio (ex: `canais-tv-app`). Não marque a opção de criar README ou .gitignore no GitHub (já temos aqui).
2. Abra o terminal na pasta raiz do seu projeto no computador e rode os comandos:

```bash
# Iniciar o repositório git local (se ainda não tiver iniciado)
git init

# Definir a branch principal como main
git branch -M main

# Adicionar todos os arquivos do projeto (o .gitignore protegerá os arquivos temporários)
git add .

# Criar o primeiro commit
git commit -m "feat: configuracao inicial do app canais tv com capacitor e suporte android tv"

# Vincular ao seu repositório no GitHub (substitua pelo seu link do GitHub)
git remote add origin https://github.com/SEU_USUARIO/canais-tv-app.git

# Enviar os arquivos para o GitHub
git push -u origin main
```

---

## 3. Como Clonar e Configurar em uma Nova Máquina

Se você for gerar o APK em outro computador (ou se clonar o repositório futuramente), execute:

```bash
# 1. Clonar o repositório
git clone https://github.com/SEU_USUARIO/canais-tv-app.git
cd canais-tv-app

# 2. Instalar as dependências do Node
npm install
```

---

## 4. Instalação e Sincronização do Capacitor

Com as dependências instaladas, inicialize o ambiente Android nativo com os comandos:

```bash
# 1. Instalar os pacotes nativos do Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Gerar a pasta 'dist' otimizada da aplicação Web
npm run build

# 3. Adicionar o módulo nativo do Android (cria a pasta 'android/')
# (Nota: execute este comando se a pasta 'android/' ainda não existir no projeto)
npx cap add android

# 4. Sincronizar o build Web com o projeto nativo do Android
npx cap sync android

# 5. Abrir o projeto diretamente dentro do Android Studio
npx cap open android
```

---

## 5. Código 1: `capacitor.config.json`

Verifique se o arquivo `capacitor.config.json` na raiz do projeto está configurado exatamente assim. Ele autoriza o tráfego misto (HTTP/HTTPS) e garante que as URLs dos streams de canais funcionem sem bloqueios de segurança do sistema:

```json
{
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
}
```

---

## 6. Código 2: `AndroidManifest.xml` (Híbrido TV + Celular)

Localização do arquivo:
`android/app/src/main/AndroidManifest.xml`

Substitua todo o conteúdo do arquivo pelo código abaixo. Este manifesto é o segredo para o aplicativo ser aceito e funcionar perfeitamente em **dois mundos diferentes**:

- **Na Android TV**: Ativa o `LEANBACK_LAUNCHER` (para aparecer no carrossel de apps da TV) e define que o Touchscreen **não é obrigatório** (`android:required="false"`).
- **No Celular**: Ativa o `LAUNCHER` tradicional e define que o Leanback **não é obrigatório** (`android:required="false"`).

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissões de Conexão à Internet e Rede -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- 
      CONFIGURAÇÃO HÍBRIDA MULTI-DISPOSITIVO:
      A flag 'android:required="false"' é INDISPENSÁVEL. 
      Ela permite instalar o app em TVs sem tela de toque e em Celulares sem sistema Leanback.
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

            <!-- 1. ÍCONE PARA CELULARES E TABLETS ANDROID -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- 2. ÍCONE NO CARROSSEL PRINCIPAL DA ANDROID TV / GOOGLE TV / FIRE TV -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>

</manifest>
```

---

## 7. Código 3: `MainActivity.java` (D-Pad da TV + Bloqueio de Anúncios)

Localização do arquivo:
`android/app/src/main/java/com/canaistv/app/MainActivity.java`

Substitua todo o conteúdo pelo código abaixo. Ele ativa:
1. Navegação nativa via setas (D-Pad) do controle remoto da TV.
2. Autoplay contínuo para os vídeos começarem sem necessitar de toque físico.
3. Desativação de múltiplas janelas e pop-ups para que propagandas de sites de canais não travem a TV.
4. Mapeamento do botão "Voltar" do controle remoto.

```java
package com.canaistv.app;

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

        // Obtém o componente WebView do Capacitor
        webView = this.bridge.getWebView();

        if (webView != null) {
            // 1. SUPORTE TOTAL AO CONTROLE REMOTO (D-PAD) DA ANDROID TV
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();

            WebSettings settings = webView.getSettings();

            // 2. CONFIGURAÇÃO DE REPRODUÇÃO DE VÍDEO
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false); // Autoplay sem clique físico

            // 3. BLOQUEIO DE POP-UPS, ANÚNCIOS E MÚLTIPLAS JANELAS
            settings.setSupportMultipleWindows(false); // Impede que anúncios abram novas abas
            settings.setJavaScriptCanOpenWindowsAutomatically(false); // Bloqueia window.open()
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            // 4. INTERCEPTADOR DE REDIRECIONAMENTOS EXTERNOS MALICIOSOS
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String url = request.getUrl().toString();
                    
                    // Bloqueia tentativas de redirecionar para a Play Store ou sites de anúncios
                    if (url.startsWith("market://") || url.startsWith("intent://") || url.contains("adclick") || url.contains("doubleclick")) {
                        return true; // Aborta a abertura
                    }
                    return false;
                }
            });
        }
    }

    // 5. NAVEGAÇÃO COM O BOTÃO 'VOLTAR' NO CONTROLE REMOTO DA TV
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
}
```

---

## 8. Banner Obrigatório da Android TV (320x180 px)

A Android TV e o Google TV exigem um banner retangular na proporção **16:9** (tamanho exato: **320 x 180 pixels**) para exibir o card do app na grade da TV.

1. Crie ou salve uma imagem retangular de **320x180 px** (formato PNG) com o logo ou nome "Canais TV".
2. Salve o arquivo com o nome exato: `banner.png`.
3. Coloque esse arquivo na pasta:
   `android/app/src/main/res/drawable/banner.png`

*(Se essa pasta `drawable` não existir dentro de `res`, pode criá-la).*

---

## 9. Como Compilar o APK no Android Studio

1. Abra o projeto no Android Studio rodando `npx cap open android`.
2. Aguarde o Gradle sincronizar os arquivos (barra de progresso no canto inferior).
3. No menu superior do Android Studio, clique em:  
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. Quando a compilação terminar, uma notificação aparecerá no canto inferior direito:  
   *`APK(s) generated successfully for 1 module: Locate`*.
5. Clique no link azul **Locate**.
6. Ele abrirá a pasta contendo o arquivo compilado: **`app-debug.apk`**.

---

## 10. Como Instalar na Smart TV e no Celular

### Na Smart TV / TV Box (Opção 1 - Pen Drive USB)
1. Copie o arquivo `app-debug.apk` para um pen drive.
2. Plugue o pen drive na porta USB da sua TV Box ou Smart TV.
3. Abra um gerenciador de arquivos na TV (ex: *File Commander*, *X-plore* ou *AnExplorer*).
4. Clique no arquivo `app-debug.apk` e selecione **Instalar**.

### No Fire TV Stick / Chromecast / Android TV (Opção 2 - App Downloader)
1. Na loja de apps da TV, instale o aplicativo gratuito **Downloader** (da AFTVnews).
2. Faça upload do seu arquivo `app-debug.apk` no Google Drive, Mediafire ou qualquer serviço com link direto.
3. Abra o app Downloader na TV, digite o link direto do APK e aperte **Go**.
4. O app será baixado e instalado diretamente pela tela da TV.

### No Smartphone Android
1. Envie o arquivo `app-debug.apk` para o celular (via WhatsApp, Telegram, Google Drive ou cabo USB).
2. Toque no arquivo e clique em **Instalar** (permita a instalação de fontes desconhecidas se solicitado).

---

## 11. Rotina de Atualizações Futuras com o GitHub

Sempre que você cadastrar novos canais ou fizer melhorias visuais no código:

```bash
# 1. Enviar as novidades para o GitHub:
git add .
git commit -m "update: novos canais adicionados"
git push

# 2. Gerar o novo APK para sua TV:
npm run build
npx cap sync android
```
Depois abra o Android Studio (`npx cap open android`) e clique novamente em **Build APK(s)**!
