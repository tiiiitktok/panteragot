const crypto = require("crypto");
const { getNotificationsForUser, setNotificationsForUser, getGatewaysForUser, getGatewayIndex } = require("../../lib/store");
const { detectTipo, detectValor, detectExtra, checkSecret } = require("../../lib/detect");
const { sendPushToUser, buildPushPayload } = require("../../lib/push");

module.exports = async (req, res) => {
  const slug = req.query.gateway;

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, info: "Use POST para enviar um webhook." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  if (!checkSecret(req, res)) return;

  const index = await getGatewayIndex();
  const userId = index[slug];
  if (!userId) {
    return res.status(404).json({ ok: false, erro: "gateway não encontrado" });
  }

  const body = req.body || {};
  const tipo = detectTipo(body, req.query.tipo);
  const valor = detectValor(body);
  const { cliente, produto } = detectExtra(body);

  const gateways = await getGatewaysForUser(userId);
  const g = gateways.find((x) => x.slug === slug);

  const notif = {
    id: crypto.randomUUID(),
    tipo,
    gateway: slug,
    gatewayNome: g ? g.nome : slug,
    valor,
    cliente,
    produto,
    recebidoEm: new Date().toISOString(),
    payload: body,
  };

  const list = await getNotificationsForUser(userId);
  list.push(notif);
  if (list.length > 2000) list.splice(0, list.length - 2000);
  await setNotificationsForUser(userId, list);

  try {
    await sendPushToUser(userId, buildPushPayload(notif));
  } catch (err) {
    console.error("Falha ao enviar push:", err);
  }

  res.status(200).json({ ok: true, classificado_como: tipo, valor_detectado: valor, gateway: slug });
};
