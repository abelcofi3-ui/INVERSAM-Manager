#!/usr/bin/env node
/**
 * Crea un usuario administrador en Supabase Auth.
 * Uso: npm run create-admin -- correo@dominio.com "ContraseñaSegura" "Nombre Completo"
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const [email, password, fullName = "Administrador"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password) {
  console.error('Uso: npm run create-admin -- correo@dominio.com "Contraseña" "Nombre Completo"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "admin" },
  user_metadata: { full_name: fullName },
});
if (error) {
  console.error("No se pudo crear el usuario:", error.message);
  process.exit(1);
}

const { data: profile, error: pErr } = await supabase
  .from("profiles")
  .select("role, active")
  .eq("id", data.user.id)
  .single();
if (pErr) {
  console.error("Usuario creado, pero no se encontró su perfil. ¿Aplicó las migraciones?", pErr.message);
  process.exit(1);
}
console.log(`✔ Administrador creado: ${email} (rol: ${profile.role}, activo: ${profile.active})`);
