package hn.inversam.manager;

import android.net.Uri;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Muestra INVERSAM Manager a pantalla completa usando Chrome (Trusted Web Activity):
 * cámara, fotos, descargas de PDF/Excel y la sesión funcionan igual que en el navegador.
 */
public class TwaActivity extends LauncherActivity {
    @Override
    protected Uri getLaunchingUrl() {
        Uri fromIntent = getIntent() != null ? getIntent().getData() : null;
        if (fromIntent != null) return fromIntent;
        String url = ServerConfig.get(this);
        return Uri.parse((url != null ? url : "https://localhost") + "/");
    }
}
