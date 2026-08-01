// Armazenamento de dados.
//
// Este projeto foi conectado a um banco Postgres (via integração Supabase
// no Marketplace da Vercel). Em vez de depender de um nome de variável de
// ambiente fixo, o código procura automaticamente por QUALQUER variável de
// ambiente que termine em "_POSTGRES_URL" (ou "_DATABASE_URL"), porque a
// Vercel costuma prefixar essas variáveis com o nome do recurso conectado
// (ex: "Roicher_POSTGRES_URL"), que varia de projeto para projeto.
//
// Sem nenhum banco conectado (ex: rodando localmente sem essas variáveis),
// cai para um arquivo JSON local — só para facilitar testes, não funciona
// em produção na Vercel porque lá o sistema de arquivos é somente leitura.

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function findConnectionString() {
  const keys = Object.keys(process.env);
  // prioridade 1: variável "*_POSTGRES_URL" (conexão via pooler, ideal para serverless)
  const pooled = keys.find((k) => /(^|_)POSTGRES_URL$/.test(k));
  if (pooled) return process.env[pooled];
  // prioridade 2: "*_POSTGRES_URL_NON_POOLING"
  const nonPooling = keys.find((k) => /POSTGRES_URL_NON_POOLING$/.test(k));
  if (nonPooling) return process.env[nonPooling];
  // prioridade 3: qualquer "*_DATABASE_URL" genérica
  const database = keys.find((k) => /(^|_)DATABASE_URL$/.test(k));
  if (database) return process.env[database];
  return null;
}

const connectionStringRaw = findConnectionString();
const usePostgres = !!connectionStringRaw;

// A URL de conexão do Supabase costuma vir com "?sslmode=require" embutido.
// Quando isso está presente junto com uma configuração ssl explícita, o
// driver "pg" pode tentar validar o certificado contra a cadeia de CAs
// padrão do Node (que não conhece a CA do Supabase/pgbouncer), causando
// "self-signed certificate in certificate chain" mesmo com
// rejectUnauthorized: false. Removemos o parâmetro da URL e controlamos o
// SSL só pelo objeto `ssl` abaixo, que é o jeito que realmente funciona.
function stripSslMode(connStr) {
  if (!connStr) return connStr;
  try {
    const url = new URL(connStr);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch (_) {
    return connStr.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
  }
}

const connectionString = stripSslMode(connectionStringRaw);

let pool = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

let tableReady = null;
async function ensureTable() {
  if (!tableReady) {
    const p = getPool();
    tableReady = p.query(
      `CREATE TABLE IF NOT EXISTS sales_radar_kv (
         key TEXT PRIMARY KEY,
         value JSONB NOT NULL
       )`
    );
  }
  await tableReady;
}

async function pgGet(key, fallback) {
  await ensureTable();
  const p = getPool();
  const res = await p.query("SELECT value FROM sales_radar_kv WHERE key = $1", [key]);
  if (res.rows.length === 0) return fallback;
  return res.rows[0].value;
}

async function pgSet(key, value) {
  await ensureTable();
  const p = getPool();
  await p.query(
    `INSERT INTO sales_radar_kv (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb`,
    [key, JSON.stringify(value)]
  );
}

// ---------- fallback local (só para desenvolvimento sem banco conectado) ----------
const DATA_DIR = path.join(process.cwd(), "data");
const NOTIF_FILE = path.join(DATA_DIR, "notifications.json");
const GATEWAYS_FILE = path.join(DATA_DIR, "gateways.json");

function readLocal(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (_) {
    return [];
  }
}

function writeLocal(file, data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch (_) {
    // sistema de arquivos somente leitura (produção na Vercel sem banco) — ignora
  }
}

async function getGateways() {
  if (usePostgres) return pgGet("gateways", []);
  return readLocal(GATEWAYS_FILE);
}

async function setGateways(list) {
  if (usePostgres) return pgSet("gateways", list);
  return writeLocal(GATEWAYS_FILE, list);
}

async function getNotifications() {
  if (usePostgres) return pgGet("notifications", []);
  return readLocal(NOTIF_FILE);
}

async function setNotifications(list) {
  if (usePostgres) return pgSet("notifications", list);
  return writeLocal(NOTIF_FILE, list);
}

const SUBS_FILE = path.join(DATA_DIR, "push_subscriptions.json");
const VAPID_FILE = path.join(DATA_DIR, "vapid_keys.json");

async function getPushSubscriptions() {
  if (usePostgres) return pgGet("push_subscriptions", []);
  return readLocal(SUBS_FILE);
}

async function setPushSubscriptions(list) {
  if (usePostgres) return pgSet("push_subscriptions", list);
  return writeLocal(SUBS_FILE, list);
}

async function getVapidKeys() {
  if (usePostgres) return pgGet("vapid_keys", null);
  try {
    return JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
  } catch (_) {
    return null;
  }
}

async function setVapidKeys(keys) {
  if (usePostgres) return pgSet("vapid_keys", keys);
  return writeLocal(VAPID_FILE, keys);
}

module.exports = {
  getGateways,
  setGateways,
  getNotifications,
  setNotifications,
  getPushSubscriptions,
  setPushSubscriptions,
  getVapidKeys,
  setVapidKeys,
  usePostgres,
};
