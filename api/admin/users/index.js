const { getUsers, getGatewaysForUser, getNotificationsForUser } = require("../../../lib/store");
const { requireAdmin } = require("../../../lib/auth");

module.exports = requireAdmin(async (req, res) => {
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
});
