const { removeSubscription } = require("../../lib/push");
const { requireAuth } = require("../../lib/auth");

module.exports = requireAuth(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ ok: false, erro: "endpoint não informado" });
  }
  try {
    await removeSubscription(req.user.id, endpoint);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "não foi possível remover a inscrição" });
  }
});
