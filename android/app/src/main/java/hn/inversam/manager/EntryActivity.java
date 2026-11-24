package hn.inversam.manager;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Abre el sistema si ya hay servidor configurado; si no, muestra la configuración. */
public class EntryActivity extends Activity {
    public static final String ACTION_CHANGE_SERVER = "hn.inversam.manager.CHANGE_SERVER";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String url = ServerConfig.get(this);
        boolean change = ACTION_CHANGE_SERVER.equals(getIntent().getAction());
        if (url == null || change) {
            startActivity(new Intent(this, SetupActivity.class));
        } else {
            openApp(this, url);
        }
        finish();
    }

    static void openApp(Activity from, String baseUrl) {
        Intent i = new Intent(from, TwaActivity.class);
        i.setData(Uri.parse(baseUrl + "/"));
        from.startActivity(i);
    }
}
