const { getNotificationsForUser, setNotificationsForUser } = require("../../lib/store");
const { filterByRange } = require("../../lib/detect");
const { requireAuth } = require("../../lib/auth");

module.exports = requireAuth(async (req, res) => {
  const userId = req.user.id;

  if (req.method === "GET") {
    const { inicio, fim, gateway } = req.query;
    const list = await getNotificationsForUser(userId);
    let filtered = filterByRange(list, inicio, fim);
    if (gateway) filtered = filtered.filter((n) => n.gateway === gateway);
    return res.status(200).json(filtered.slice(-500).reverse());
  }

  if (req.method === "DELETE") {
    await setNotificationsForUser(userId, []);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ ok: false, erro: "método não permitido" });
});
