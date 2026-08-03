const {
  getUsers,
  setUsers,
  getGatewaysForUser,
  setGatewaysForUser,
  getGatewayIndex,
  setGatewayIndex,
  getNotificationsForUser,
  setNotificationsForUser,
  getPushSubscriptionsForUser,
  setPushSubscriptionsForUser,
  deleteAvatarForUser,
} = require("../../lib/store");
const { requireAuth, verifyPassword, clearSessionCookie } = require("../../lib/auth");

module.exports = requireAuth(async (req, res) => {
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
});
