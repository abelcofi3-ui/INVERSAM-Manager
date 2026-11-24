#!/usr/bin/env node
/** Une las migraciones en supabase/setup.sql para pegarlas en el SQL Editor de Supabase. */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const out = [
  "-- INVERSAM MANAGER — script de instalación completo (generado por scripts/bundle-sql.mjs).",
  "-- Ejecútelo UNA sola vez en un proyecto de Supabase nuevo (SQL Editor → New query → Run).",
  "begin;",
  ...files.map((f) => `\n-- >>> ${f}\n${readFileSync(join(dir, f), "utf8")}`),
  "commit;",
  "",
].join("\n");
writeFileSync("supabase/setup.sql", out);
console.log(`supabase/setup.sql generado con ${files.length} migraciones.`);
