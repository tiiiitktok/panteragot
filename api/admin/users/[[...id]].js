const {
  getUsers,
  setUsers,
  getGatewaysForUser,
  setGatewaysForUser,
  getNotificationsForUser,
  setNotificationsForUser,
  setPushSubscriptionsForUser,
  getGatewayIndex,
  setGatewayIndex,
} = require("../../../lib/store");
const { requireAdmin } = require("../../../lib/auth");

async function handleList(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const users = await getUsers();
  const list = await Promise.all(
    users.map(async (u) => {
      const [gateways, notifications] = await Promise.all([
        getGatewaysForUser(u.id),
        getNotificationsForUser(u.id),
      ]);
      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        criadoEm: u.criadoEm,
        totalGateways: gateways.length,
        totalNotificacoes: notifications.length,
      };
    })
  );

  // mais recente primeiro
  list.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));

  res.status(200).json(list);
}

async function handleDelete(req, res, targetId) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  if (targetId === req.user.id) {
    return res.status(400).json({ ok: false, erro: "você não pode excluir a própria conta de admin por aqui" });
  }

  const users = await getUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) {
    return res.status(404).json({ ok: false, erro: "conta não encontrada" });
  }

  // libera os slugs de webhook que essa pessoa estava usando
  const gateways = await getGatewaysForUser(targetId);
  const index = await getGatewayIndex();
  gateways.forEach((g) => {
    if (index[g.slug] === targetId) delete index[g.slug];
  });
  await setGatewayIndex(index);

  // apaga os dados da pessoa
  await setGatewaysForUser(targetId, []);
  await setNotificationsForUser(targetId, []);
  await setPushSubscriptionsForUser(targetId, []);

  // remove a conta
  const filtered = users.filter((u) => u.id !== targetId);
  await setUsers(filtered);

  res.status(200).json({ ok: true });
}

module.exports = requireAdmin(async (req, res) => {
  const idParts = req.query.id; // undefined em /api/admin/users, array em /api/admin/users/:id

  if (!idParts || idParts.length === 0) {
    return handleList(req, res);
  }

  const targetId = idParts[0];
  return handleDelete(req, res, targetId);
});
