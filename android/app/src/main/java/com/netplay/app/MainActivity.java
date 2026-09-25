package com.netplay.app;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Manter a tela sempre ligada durante a reprodução de filmes (Celular e TV)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // 2. Otimizar o motor de renderização WebView para streaming de mídia MP4
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();

            // Permite autoplay de vídeos sem exigir clique físico prévio (vital para Android TV)
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Permite reproduzir vídeos de servidores de mídia com HTTP ou HTTPS (Mixed Content)
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            // Habilita persistência local para salvar o catálogo de filmes e progresso do player
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);

            // Interface nativa para permitir que o app web feche o aplicativo de forma controlada
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void exitApp() {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            finish();
                        }
                    });
                }
            }, "AndroidNative");

            // Habilita aceleração gráfica de hardware para decodificação suave de vídeo
            webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

            // Garante foco do controle remoto (D-Pad) no WebView da Smart TV
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    bridge.getWebView().requestFocus();
                }
            });
        }
    }

    /**
     * Intercepta o botão voltar nativo do Android (Celular e TV)
     * Não fecha o aplicativo abruptamente; envia o comando BACK para a aplicação web.
     */
    @Override
    public void onBackPressed() {
        dispatchKeyToWeb("BACK", "Escape", 27);
    }

    /**
     * Mapeamento do Controle Remoto da Android TV (D-PAD)
     * Envia comandos diretamente para a interface (window.onTvRemoteKey) e dispara KeyboardEvent.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();
            switch (keyCode) {
                case KeyEvent.KEYCODE_DPAD_CENTER:
                case KeyEvent.KEYCODE_ENTER:
                case KeyEvent.KEYCODE_BUTTON_A:
                case KeyEvent.KEYCODE_NUMPAD_ENTER:
                    dispatchKeyToWeb("ENTER", "Enter", 13);
                    return true;

                case KeyEvent.KEYCODE_DPAD_LEFT:
                    dispatchKeyToWeb("LEFT", "ArrowLeft", 37);
                    return true;

                case KeyEvent.KEYCODE_DPAD_RIGHT:
                    dispatchKeyToWeb("RIGHT", "ArrowRight", 39);
                    return true;

                case KeyEvent.KEYCODE_DPAD_UP:
                    dispatchKeyToWeb("UP", "ArrowUp", 38);
                    return true;

                case KeyEvent.KEYCODE_DPAD_DOWN:
                    dispatchKeyToWeb("DOWN", "ArrowDown", 40);
                    return true;

                case KeyEvent.KEYCODE_BACK:
                case KeyEvent.KEYCODE_ESCAPE:
                    // Intercepta e envia para a web. Retorna true para evitar que o Android mate a Activity!
                    dispatchKeyToWeb("BACK", "Escape", 27);
                    return true;

                case KeyEvent.KEYCODE_MENU:
                case KeyEvent.KEYCODE_INFO:
                case KeyEvent.KEYCODE_BUTTON_Y:
                case KeyEvent.KEYCODE_PROG_YELLOW:
                    dispatchKeyToWeb("MENU", "ContextMenu", 93);
                    return true;

                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                case KeyEvent.KEYCODE_MEDIA_PLAY:
                case KeyEvent.KEYCODE_MEDIA_PAUSE:
                    dispatchKeyToWeb("PLAY_PAUSE", "MediaPlayPause", 179);
                    return true;

                case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                    dispatchKeyToWeb("RIGHT", "ArrowRight", 39);
                    return true;

                case KeyEvent.KEYCODE_MEDIA_REWIND:
                    dispatchKeyToWeb("LEFT", "ArrowLeft", 37);
                    return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void dispatchKeyToWeb(final String action, final String keyName, final int keyCode) {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    String js = "try { " +
                                "  if (window.onTvRemoteKey) { " +
                                "    window.onTvRemoteKey('" + action + "'); " +
                                "  } " +
                                "  window.dispatchEvent(new KeyboardEvent('keydown', { " +
                                "    key: '" + keyName + "', " +
                                "    code: '" + keyName + "', " +
                                "    keyCode: " + keyCode + ", " +
                                "    which: " + keyCode + ", " +
                                "    bubbles: true " +
                                "  })); " +
                                "} catch(e) { console.error('Remote error:', e); }";
                    bridge.getWebView().evaluateJavascript(js, null);
                }
            });
        }
    }
}
