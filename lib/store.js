// Armazenamento de dados. Na Vercel (produção) usa Redis via @vercel/kv,
// que precisa de uma integração Upstash for Redis conectada ao projeto
// (variáveis KV_REST_API_URL e KV_REST_API_TOKEN). Sem essas variáveis
// (ex: rodando localmente com `vercel dev` sem Redis configurado), cai
// para um arquivo JSON local — só para facilitar testes, não funciona
// em produção na Vercel porque o sistema de arquivos lá é somente leitura.

const fs = require("fs");
const path = require("path");

const useKV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

let kv = null;
if (useKV) {
  // require tardio: só carrega o pacote se for realmente usar Redis
  kv = require("@vercel/kv").kv;
}

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
    // sistema de arquivos somente leitura (ex: produção na Vercel sem KV) — ignora
  }
}

async function getGateways() {
  if (useKV) return (await kv.get("gateways")) || [];
  return readLocal(GATEWAYS_FILE);
}

async function setGateways(list) {
  if (useKV) return kv.set("gateways", list);
  return writeLocal(GATEWAYS_FILE, list);
}

async function getNotifications() {
  if (useKV) return (await kv.get("notifications")) || [];
  return readLocal(NOTIF_FILE);
}

async function setNotifications(list) {
  if (useKV) return kv.set("notifications", list);
  return writeLocal(NOTIF_FILE, list);
}

module.exports = { getGateways, setGateways, getNotifications, setNotifications, useKV };
