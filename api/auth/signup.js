const crypto = require("crypto");
const { getUsers, setUsers } = require("../../lib/store");
const { hashPassword, signToken, setSessionCookie, isAdminEmail } = require("../../lib/auth");
const { slugify } = require("../../lib/detect");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async (req, res) => {
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
};
