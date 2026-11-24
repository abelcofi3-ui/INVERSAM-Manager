package hn.inversam.manager;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

/** Dirección del servidor de INVERSAM Manager (guardada en el teléfono o fijada al compilar). */
final class ServerConfig {
    private static final String PREFS = "inversam";
    private static final String KEY_URL = "server_url";

    private ServerConfig() {}

    static String get(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String saved = p.getString(KEY_URL, null);
        if (saved != null && !saved.isEmpty()) return saved;
        String builtIn = BuildConfig.DEFAULT_URL;
        return builtIn == null || builtIn.isEmpty() ? null : normalize(builtIn);
    }

    static void save(Context ctx, String url) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_URL, url).apply();
    }

    /**
     * Acepta "inversam.vercel.app" o "https://inversam.vercel.app/" y devuelve "https://inversam.vercel.app".
     * Devuelve null si no es una dirección https válida.
     */
    static String normalize(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty()) return null;
        if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
        Uri u = Uri.parse(s);
        if (!"https".equals(u.getScheme()) || u.getHost() == null || u.getHost().isEmpty()) return null;
        String port = u.getPort() > 0 ? ":" + u.getPort() : "";
        return "https://" + u.getHost() + port;
    }
}
