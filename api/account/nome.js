const { getUsers, setUsers } = require("../../lib/store");
const { requireAuth } = require("../../lib/auth");
const { slugify } = require("../../lib/detect");

module.exports = requireAuth(async (req, res) => {
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
});
