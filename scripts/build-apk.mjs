#!/usr/bin/env node
/**
 * Compila el APK de Android de INVERSAM Manager.
 *
 * Uso:   npm run apk -- [https://direccion-del-sistema]
 *        (sin dirección, la app la pide la primera vez que se abre)
 *
 * Requiere JDK 17, Android SDK (platform 35, build-tools 35) y Gradle 8.10+.
 * Los busca en JAVA_HOME / ANDROID_HOME / PATH o en ../inversam-tooling (ver android/README.md).
 *
 * Resultado:
 *   public/descargas/inversam-manager.apk   → se publica junto al sistema (página /instalar)
 *   public/.well-known/assetlinks.json      → verificación para abrir sin barra de navegador
 *   android/keystore/ + android/keystore.properties → llave de firma (¡RESPALDAR! no subir a git)
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";

const root = resolve(".");
const androidDir = join(root, "android");
const tooling = resolve(root, "..", "inversam-tooling");
const isWin = process.platform === "win32";
const exe = (name) => (isWin ? `${name}.exe` : name);

const url = (process.argv[2] ?? "").trim().replace(/\/+$/, "");
if (url && !/^https:\/\/[^/\s]+$/.test(url)) {
  console.error("La dirección debe ser https://dominio (sin ruta). Ej: https://inversam.vercel.app");
  process.exit(1);
}

const javaHome = process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, "bin", exe("keytool")))
  ? process.env.JAVA_HOME
  : existsSync(join(tooling, "jdk")) ? join(tooling, "jdk") : null;
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (existsSync(join(tooling, "sdk")) ? join(tooling, "sdk") : null);
const gradleBin = existsSync(join(tooling, "gradle", "bin")) ? join(tooling, "gradle", "bin", isWin ? "gradle.bat" : "gradle") : isWin ? "gradle.bat" : "gradle";

if (!javaHome) fail("No se encontró JDK 17 (defina JAVA_HOME).");
if (!androidHome) fail("No se encontró el Android SDK (defina ANDROID_HOME).");

const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome };
env.PATH = `${join(javaHome, "bin")}${isWin ? ";" : ":"}${env.PATH ?? env.Path ?? ""}`;
const keytool = join(javaHome, "bin", exe("keytool"));

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { env, stdio: "pipe", encoding: "utf8", shell: isWin && cmd.endsWith(".bat"), ...opts });
}

// 1. local.properties (ruta del SDK)
writeFileSync(join(androidDir, "local.properties"), `sdk.dir=${androidHome.replace(/\\/g, "\\\\")}\n`);

// 2. Llave de firma (se crea una sola vez; perderla impide actualizar la app instalada)
const propsFile = join(androidDir, "keystore.properties");
const ksFile = join(androidDir, "keystore", "inversam-release.jks");
if (!existsSync(propsFile)) {
  mkdirSync(join(androidDir, "keystore"), { recursive: true });
  const pass = randomBytes(18).toString("base64url");
  run(keytool, [
    "-genkeypair", "-v", "-keystore", ksFile, "-alias", "inversam", "-keyalg", "RSA", "-keysize", "2048",
    "-validity", "10000", "-storepass", pass, "-keypass", pass,
    "-dname", "CN=INVERSAM, O=INVERSAM, L=Santa Barbara, C=HN",
  ]);
  writeFileSync(propsFile, `storeFile=keystore/inversam-release.jks\nstorePassword=${pass}\nkeyAlias=inversam\nkeyPassword=${pass}\n`);
  console.log("✔ Llave de firma creada en android/keystore/ — RESPÁLDELA junto con android/keystore.properties");
}
const props = Object.fromEntries(
  readFileSync(propsFile, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

// 3. Huella SHA-256 → assetlinks.json (permite abrir sin barra de direcciones)
const listing = run(keytool, ["-list", "-v", "-keystore", join(androidDir, props.storeFile), "-alias", props.keyAlias, "-storepass", props.storePassword]);
const fingerprint = listing.match(/SHA256:\s*([0-9A-F:]{95})/i)?.[1];
if (!fingerprint) fail("No se pudo leer la huella SHA-256 de la llave.");
mkdirSync(join(root, "public", ".well-known"), { recursive: true });
writeFileSync(
  join(root, "public", ".well-known", "assetlinks.json"),
  JSON.stringify(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "hn.inversam.manager", sha256_cert_fingerprints: [fingerprint.toUpperCase()] },
      },
    ],
    null,
    2,
  ) + "\n",
);
console.log(`✔ assetlinks.json (huella ${fingerprint.slice(0, 11)}…)`);

// 4. Compilar
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const [maj, min, pat] = String(pkg.version).split(".").map(Number);
const versionCode = maj * 10000 + min * 100 + pat;
console.log(`… Compilando APK v${pkg.version}${url ? ` para ${url}` : " (pedirá la dirección al abrir)"}`);
try {
  run(
    gradleBin,
    ["--no-daemon", "-p", androidDir, "assembleRelease", `-PinversamUrl=${url}`, `-PversionName=${pkg.version}`, `-PversionCode=${versionCode}`],
    { stdio: "inherit" },
  );
} catch {
  fail("La compilación de Gradle falló (ver mensajes arriba).");
}

const apk = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(apk)) fail("No se encontró el APK generado.");
mkdirSync(join(root, "public", "descargas"), { recursive: true });
copyFileSync(apk, join(root, "public", "descargas", "inversam-manager.apk"));
console.log("✔ APK listo: public/descargas/inversam-manager.apk (se descarga desde /instalar)");
