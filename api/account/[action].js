const {
  setAvatarForUser,
  deleteAvatarForUser,
  getUsers,
  setUsers,
  getGatewaysForUser,
  setGatewaysForUser,
  getGatewayIndex,
  setGatewayIndex,
  setNotificationsForUser,
  setPushSubscriptionsForUser,
} = require("../../lib/store");
const { requireAuth, verifyPassword, clearSessionCookie } = require("../../lib/auth");
const { slugify } = require("../../lib/detect");

const TAMANHO_MAXIMO = 700 * 1024; // ~700KB de texto base64 — a imagem já vem reduzida do navegador

async function handleAvatar(req, res) {
  if (req.method === "POST") {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ ok: false, erro: "imagem inválida" });
    }
    if (dataUrl.length > TAMANHO_MAXIMO) {
      return res.status(400).json({ ok: false, erro: "imagem muito grande, tente outra" });
    }
    await setAvatarForUser(req.user.id, dataUrl);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await deleteAvatarForUser(req.user.id);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ ok: false, erro: "método não permitido" });
}

async function handleDelete(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ ok: false, erro: "digite sua senha pra confirmar" });
  }

  const users = await getUsers();
  const me = users.find((u) => u.id === req.user.id);
  if (!me || !verifyPassword(String(password), me.passwordHash)) {
    return res.status(401).json({ ok: false, erro: "senha incorreta" });
  }

  const userId = req.user.id;

  // remove os gateways dela do índice global (senão as URLs continuariam
  // "vivas" apontando pra uma conta que não existe mais)
  const gateways = await getGatewaysForUser(userId);
  const index = await getGatewayIndex();
  let mudou = false;
  for (const g of gateways) {
    if (index[g.slug] === userId) {
      delete index[g.slug];
      mudou = true;
    }
  }
  if (mudou) await setGatewayIndex(index);

  await setGatewaysForUser(userId, []);
  await setNotificationsForUser(userId, []);
  await setPushSubscriptionsForUser(userId, []);
  await deleteAvatarForUser(userId);

  const restantes = users.filter((u) => u.id !== userId);
  await setUsers(restantes);

  clearSessionCookie(req, res);
  res.status(200).json({ ok: true });
}

async function handleNome(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const nome = ((req.body && req.body.nome) || "").trim();
  if (!nome || nome.length < 2) {
    return res.status(400).json({ ok: false, erro: "digite um nome válido" });
  }

  // continua exigindo nome único (mesma regra do cadastro), mas o slug usado
  // nas URLs de webhook (nomeSlug) NÃO muda — assim integrações já
  // configuradas em plataformas de venda continuam funcionando.
  const novoSlugCheck = slugify(nome, []);
  const users = await getUsers();
  const conflita = users.some((u) => u.id !== req.user.id && u.nomeSlug === novoSlugCheck);
  if (conflita) {
    return res.status(409).json({ ok: false, erro: "já existe uma conta com esse nome" });
  }

  const idx = users.findIndex((u) => u.id === req.user.id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, erro: "conta não encontrada" });
  }

  users[idx].nome = nome;
  await setUsers(users);

  res.status(200).json({ ok: true, nome: users[idx].nome });
}

module.exports = requireAuth(async (req, res) => {
  const { action } = req.query;

  switch (action) {
    case "avatar":
      return handleAvatar(req, res);
    case "delete":
      return handleDelete(req, res);
    case "nome":
      return handleNome(req, res);
    default:
      return res.status(404).json({ ok: false, erro: "rota não encontrada" });
  }
});
