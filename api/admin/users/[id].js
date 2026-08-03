const {
  getUsers,
  setUsers,
  getGatewaysForUser,
  setGatewaysForUser,
  setNotificationsForUser,
  setPushSubscriptionsForUser,
  getGatewayIndex,
  setGatewayIndex,
} = require("../../../lib/store");
const { requireAdmin } = require("../../../lib/auth");

module.exports = requireAdmin(async (req, res) => {
  if (req.method !== "DELETE") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const targetId = req.query.id;

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
});
