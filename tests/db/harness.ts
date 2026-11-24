import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Levanta un Postgres en memoria (PGlite) con un esquema `auth` mínimo que imita a Supabase
 * y aplica las migraciones reales del proyecto (excepto la de Storage, que depende de Supabase).
 */
const SUPABASE_STUB = `
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(__dirname, "..", "..", "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !f.includes("storage"))
    .sort();
  for (const f of files) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Crea un usuario en auth.users (dispara el alta de perfil). */
export async function createUser(db: Db, email: string, role?: string, fullName?: string) {
  const app = role ? JSON.stringify({ role }) : "{}";
  const meta = JSON.stringify({ full_name: fullName ?? email.split("@")[0] });
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2::jsonb, $3::jsonb) returning id`,
    [email, app, meta],
  );
  return res.rows[0].id;
}

/** Ejecuta una función como un usuario autenticado concreto (RLS activo). */
export async function asUser<T>(db: Db, userId: string | null, fn: (q: Db["query"]) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    return fn(tx.query.bind(tx) as Db["query"]);
  });
}
