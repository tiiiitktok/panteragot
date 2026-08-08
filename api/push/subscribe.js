const { addSubscription } = require("../../lib/push");
const { requireAuth } = require("../../lib/auth");

module.exports = requireAuth(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ ok: false, erro: "inscrição inválida" });
  }
  try {
    await addSubscription(req.user.id, subscription);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "não foi possível salvar a inscrição" });
  }
});
