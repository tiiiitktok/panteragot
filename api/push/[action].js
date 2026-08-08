const { addSubscription, sendPushToUser, removeSubscription, getPublicKey } = require("../../lib/push");
const { requireAuth } = require("../../lib/auth");

async function handleSubscribe(req, res) {
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
}

async function handleTest(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  try {
    const result = await sendPushToUser(req.user.id, {
      title: "Noxion",
      body: "Notificações ativadas! Você vai receber um aviso aqui a cada venda gerada ou aprovada.",
      tag: "noxion-teste",
      url: "/",
    });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "não foi possível enviar a notificação de teste" });
  }
}

async function handleUnsubscribe(req, res) {
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
}

// vapid-public-key não exige login (o app precisa dela antes do usuário logar)
async function handleVapidPublicKey(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  try {
    const publicKey = await getPublicKey();
    res.status(200).json({ publicKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "não foi possível gerar/obter a chave VAPID" });
  }
}

module.exports = async (req, res) => {
  const { action } = req.query;

  if (action === "vapid-public-key") {
    return handleVapidPublicKey(req, res);
  }

  if (action === "subscribe") {
    return requireAuth(handleSubscribe)(req, res);
  }
  if (action === "test") {
    return requireAuth(handleTest)(req, res);
  }
  if (action === "unsubscribe") {
    return requireAuth(handleUnsubscribe)(req, res);
  }

  return res.status(404).json({ ok: false, erro: "rota não encontrada" });
};
