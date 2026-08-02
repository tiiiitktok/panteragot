const crypto = require("crypto");
const { getUsers, getJwtSecret, setJwtSecret } = require("./store");

/* ============================= SENHA ============================= */
// scrypt é nativo do Node (sem dependência externa) e seguro pra hash de senha.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ============================= TOKEN DE SESSÃO (HMAC) ============================= */
let jwtSecretCache = null;
async function ensureJwtSecret() {
  if (jwtSecretCache) return jwtSecretCache;
  let secret = await getJwtSecret();
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    await setJwtSecret(secret);
  }
  jwtSecretCache = secret;
  return secret;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString();
}

const SESSAO_DURACAO_SEG = 60 * 60 * 24 * 30; // 30 dias

async function signToken(payload) {
  const secret = await ensureJwtSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + SESSAO_DURACAO_SEG };
  const headerB64 = base64url(JSON.stringify(header));
  const bodyB64 = base64url(JSON.stringify(body));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${bodyB64}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${headerB64}.${bodyB64}.${sig}`;
}

async function verifyToken(token) {
  try {
    const secret = await ensureJwtSecret();
    const [headerB64, bodyB64, sig] = token.split(".");
    if (!headerB64 || !bodyB64 || !sig) return null;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${bodyB64}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    if (sig !== expected) return null;
    const body = JSON.parse(base64urlDecode(bodyB64));
    if (body.exp && Date.now() / 1000 > body.exp) return null;
    return body;
  } catch (_) {
    return null;
  }
}

/* ============================= COOKIE ============================= */
const COOKIE_NAME = "sr_session";

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function isLocalhost(req) {
  const host = req.headers.host || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function setSessionCookie(req, res, token) {
  const parts = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, "Path=/", `Max-Age=${SESSAO_DURACAO_SEG}`, "HttpOnly", "SameSite=Lax"];
  if (!isLocalhost(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (!isLocalhost(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/* ============================= HELPERS DE ROTA ============================= */
async function getUserFromReq(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || !payload.uid) return null;
  const users = await getUsers();
  const user = users.find((u) => u.id === payload.uid);
  if (!user) return null;
  return { id: user.id, email: user.email };
}

function requireAuth(handler) {
  return async (req, res) => {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ ok: false, erro: "não autenticado" });
    req.user = user;
    return handler(req, res);
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  getUserFromReq,
  requireAuth,
};
