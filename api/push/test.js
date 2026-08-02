const { sendPushToUser } = require("../../lib/push");
const { requireAuth } = require("../../lib/auth");

module.exports = requireAuth(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  try {
    const result = await sendPushToUser(req.user.id, {
      title: "Sales Radar",
      body: "Notificações ativadas! Você vai receber um aviso aqui a cada venda gerada ou aprovada.",
      tag: "sales-radar-teste",
      url: "/",
    });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "não foi possível enviar a notificação de teste" });
  }
});
