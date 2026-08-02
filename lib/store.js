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
  const pooled = keys.find((k) => /(^|_)POSTGRES_URL$/.test(k));
  if (pooled) return process.env[pooled];
  const nonPooling = keys.find((k) => /POSTGRES_URL_NON_POOLING$/.test(k));
  if (nonPooling) return process.env[nonPooling];
  const database = keys.find((k) => /(^|_)DATABASE_URL$/.test(k));
  if (database) return process.env[database];
  return null;
}

const connectionStringRaw = findConnectionString();
const usePostgres = !!connectionStringRaw;

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

function localFile(key) {
  // troca caracteres não seguros pra virar nome de arquivo válido
  return path.join(DATA_DIR, key.replace(/[^a-z0-9_.-]/gi, "_") + ".json");
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(fs.readFileSync(localFile(key), "utf-8"));
  } catch (_) {
    return fallback;
  }
}

function writeLocal(key, data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(localFile(key), JSON.stringify(data));
  } catch (_) {
    // sistema de arquivos somente leitura (produção na Vercel sem banco) — ignora
  }
}

// ---------- chave-valor genérico, usado por todo o resto do arquivo ----------
async function getValue(key, fallback) {
  if (usePostgres) return pgGet(key, fallback);
  return readLocal(key, fallback);
}

async function setValue(key, value) {
  if (usePostgres) return pgSet(key, value);
  return writeLocal(key, value);
}

// ---------- usuários (contas) ----------
async function getUsers() {
  return getValue("users", []);
}
async function setUsers(list) {
  return setValue("users", list);
}

// ---------- segredo usado para assinar os tokens de sessão (gerado sozinho) ----------
async function getJwtSecret() {
  return getValue("jwt_secret", null);
}
async function setJwtSecret(secret) {
  return setValue("jwt_secret", secret);
}

// ---------- chaves VAPID (identidade do servidor para push, compartilhada) ----------
async function getVapidKeys() {
  return getValue("vapid_keys", null);
}
async function setVapidKeys(keys) {
  return setValue("vapid_keys", keys);
}

// ---------- índice global: slug do gateway -> dono (userId) ----------
// precisa ser global porque o webhook chega sem autenticação; é assim que
// descobrimos de qual usuário é aquela notificação.
async function getGatewayIndex() {
  return getValue("gateway_owner_index", {});
}
async function setGatewayIndex(index) {
  return setValue("gateway_owner_index", index);
}

// ---------- dados por usuário (gateways, notificações, inscrições push) ----------
async function getGatewaysForUser(userId) {
  return getValue(`gateways:${userId}`, []);
}
async function setGatewaysForUser(userId, list) {
  return setValue(`gateways:${userId}`, list);
}

async function getNotificationsForUser(userId) {
  return getValue(`notifications:${userId}`, []);
}
async function setNotificationsForUser(userId, list) {
  return setValue(`notifications:${userId}`, list);
}

async function getPushSubscriptionsForUser(userId) {
  return getValue(`push_subscriptions:${userId}`, []);
}
async function setPushSubscriptionsForUser(userId, list) {
  return setValue(`push_subscriptions:${userId}`, list);
}

module.exports = {
  usePostgres,
  getUsers,
  setUsers,
  getJwtSecret,
  setJwtSecret,
  getVapidKeys,
  setVapidKeys,
  getGatewayIndex,
  setGatewayIndex,
  getGatewaysForUser,
  setGatewaysForUser,
  getNotificationsForUser,
  setNotificationsForUser,
  getPushSubscriptionsForUser,
  setPushSubscriptionsForUser,
};
