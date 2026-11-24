# App Android de INVERSAM Manager

APK nativo basado en **Trusted Web Activity**: abre el sistema a pantalla completa usando el motor de Chrome del teléfono. Cámara, fotos, descargas de PDF/Excel y la sesión funcionan exactamente igual que en el navegador, y la app siempre muestra la versión más reciente del sistema (no hay que reinstalarla con cada cambio).

- Paquete: `hn.inversam.manager` · Android 6.0 o superior · requiere Google Chrome (preinstalado en casi todos los teléfonos).
- Primera apertura: pide la **dirección del sistema** (p. ej. `https://inversam.vercel.app`), a menos que se haya fijado al compilar.
- Mantener presionado el ícono → **Cambiar servidor**.

## Opción A — Compilar en GitHub (no instala nada en su PC)

1. Suba el proyecto a un repositorio de GitHub.
2. *Actions → APK Android → Run workflow*. Opcionalmente escriba la dirección del sistema.
3. Al terminar, descargue el artefacto **inversam-manager-apk** (contiene el APK y `assetlinks.json`).
4. Copie `assetlinks.json` a `public/.well-known/` y el APK a `public/descargas/inversam-manager.apk`, y vuelva a desplegar el sitio.

Para firmar siempre con la misma llave (obligatorio para poder **actualizar** la app ya instalada), agregue en *Settings → Secrets → Actions*:

| Secreto | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | El archivo `android/keystore/inversam-release.jks` en base64 (`base64 -w0 inversam-release.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | La contraseña de `android/keystore.properties` |

## Opción B — Compilar en esta PC

Requiere **JDK 17**, **Android SDK** (`platforms;android-35`, `build-tools;35.0.0`) y **Gradle 8.10+**. Si no los tiene, el script `C:\Users\abel.torres\inversam-tooling\setup-tooling.ps1` los descarga en esa carpeta (≈1.5 GB, sin instalar nada en el sistema). Ejecútelo usted mismo en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\abel.torres\inversam-tooling\setup-tooling.ps1
```

Luego, desde la carpeta del proyecto:

```bash
npm run apk                                   # pide la dirección al abrir la app
npm run apk -- https://inversam.vercel.app    # dirección fija
```

Resultado: `public/descargas/inversam-manager.apk` y `public/.well-known/assetlinks.json`. Al desplegar el sitio, el personal descarga el APK desde **/instalar**.

## Llave de firma — ¡IMPORTANTE!

La primera compilación crea `android/keystore/inversam-release.jks` y `android/keystore.properties` (excluidos de git). **Guárdelos en un lugar seguro.** Si se pierden, las nuevas versiones no podrán instalarse encima de la anterior (habría que desinstalar y volver a instalar en cada teléfono), y habría que actualizar `assetlinks.json`.

## Sin barra de direcciones

Android abre la app a pantalla completa solo si el sitio publica `/.well-known/assetlinks.json` con la huella de la llave con que se firmó el APK. El script lo genera automáticamente; basta con desplegarlo junto con el sitio. Si falta, la app funciona igual pero muestra una barra pequeña con la dirección.
