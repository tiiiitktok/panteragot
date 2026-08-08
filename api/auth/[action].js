const crypto = require("crypto");
const { getUsers, setUsers, getAvatarForUser } = require("../../lib/store");
const {
  verifyPassword,
  hashPassword,
  signToken,
  setSessionCookie,
  clearSessionCookie,
  isAdminEmail,
  getUserFromReq,
} = require("../../lib/auth");
const { slugify } = require("../../lib/detect");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleLogin(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, erro: "informe e-mail e senha" });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const users = await getUsers();
  const user = users.find((u) => u.email === emailNorm);

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ ok: false, erro: "e-mail ou senha incorretos" });
  }

  const token = await signToken({ uid: user.id });
  setSessionCookie(req, res, token);

  const avatar = await getAvatarForUser(user.id);
  res.status(200).json({ ok: true, email: user.email, nome: user.nome, isAdmin: isAdminEmail(user.email), avatar });
}

async function handleLogout(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  clearSessionCookie(req, res);
  res.status(200).json({ ok: true });
}

async function handleMe(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ ok: false });
  const avatar = await getAvatarForUser(user.id);
  res.status(200).json({ ok: true, email: user.email, nome: user.nome, isAdmin: isAdminEmail(user.email), avatar });
}

async function handleSignup(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const { nome, email, password } = req.body || {};

  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo || nomeLimpo.length < 2) {
    return res.status(400).json({ ok: false, erro: "digite seu nome" });
  }
  if (!email || !isValidEmail(String(email))) {
    return res.status(400).json({ ok: false, erro: "digite um e-mail válido" });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ ok: false, erro: "a senha precisa ter pelo menos 6 caracteres" });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const users = await getUsers();

  if (users.some((u) => u.email === emailNorm)) {
    return res.status(409).json({ ok: false, erro: "já existe uma conta com esse e-mail" });
  }

  // nome precisa ser único entre todas as contas — é o que vira o prefixo do webhook,
  // então duas contas com o mesmo nome gerariam URLs conflitantes.
  const nomeSlug = slugify(nomeLimpo, []);
  if (users.some((u) => u.nomeSlug === nomeSlug)) {
    return res.status(409).json({ ok: false, erro: "já existe uma conta com esse nome. Tente outro (ex: adicione um sobrenome)." });
  }

  const user = {
    id: crypto.randomUUID(),
    nome: nomeLimpo,
    nomeSlug,
    email: emailNorm,
    passwordHash: hashPassword(String(password)),
    criadoEm: new Date().toISOString(),
  };
  users.push(user);
  await setUsers(users);

  const token = await signToken({ uid: user.id });
  setSessionCookie(req, res, token);

  res.status(200).json({ ok: true, email: user.email, nome: user.nome, isAdmin: isAdminEmail(user.email) });
}

module.exports = async (req, res) => {
  const { action } = req.query;

  switch (action) {
    case "login":
      return handleLogin(req, res);
    case "logout":
      return handleLogout(req, res);
    case "me":
      return handleMe(req, res);
    case "signup":
      return handleSignup(req, res);
    default:
      return res.status(404).json({ ok: false, erro: "rota não encontrada" });
  }
};
