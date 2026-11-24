package hn.inversam.manager;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Pantalla para indicar (o cambiar) la dirección del servidor de INVERSAM Manager. */
public class SetupActivity extends Activity {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private EditText input;
    private TextView message;
    private Button button;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_setup);
        input = findViewById(R.id.server_url);
        message = findViewById(R.id.message);
        button = findViewById(R.id.connect);

        String current = ServerConfig.get(this);
        if (current != null) input.setText(current);

        button.setOnClickListener(v -> connect());
        input.setOnEditorActionListener((v, actionId, e) -> {
            if (actionId == EditorInfo.IME_ACTION_GO) {
                connect();
                return true;
            }
            return false;
        });
    }

    private void showMessage(String text) {
        message.setText(text);
        message.setVisibility(text == null ? View.GONE : View.VISIBLE);
    }

    private void connect() {
        final String url = ServerConfig.normalize(input.getText().toString());
        if (url == null) {
            showMessage(getString(R.string.setup_invalid));
            return;
        }
        showMessage(null);
        button.setEnabled(false);
        button.setText(R.string.setup_checking);

        // Verifica que la dirección sea realmente un servidor de INVERSAM Manager
        io.execute(() -> {
            boolean ok = false;
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url + "/manifest.webmanifest").openConnection();
                c.setConnectTimeout(10000);
                c.setReadTimeout(10000);
                if (c.getResponseCode() == 200) {
                    byte[] buf = new byte[4096];
                    int n = c.getInputStream().read(buf);
                    ok = n > 0 && new String(buf, 0, n, "UTF-8").contains("INVERSAM");
                }
            } catch (Exception ignored) {
                ok = false;
            } finally {
                if (c != null) c.disconnect();
            }
            final boolean valid = ok;
            main.post(() -> {
                button.setEnabled(true);
                button.setText(R.string.setup_connect);
                if (valid) {
                    ServerConfig.save(this, url);
                    EntryActivity.openApp(this, url);
                    finish();
                } else {
                    showMessage(getString(R.string.setup_unreachable));
                }
            });
        });
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        super.onDestroy();
    }
}
