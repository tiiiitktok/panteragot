const webpush = require("web-push");
const { getVapidKeys, setVapidKeys, getPushSubscriptionsForUser, setPushSubscriptionsForUser, getAvatarForUser } = require("./store");

let vapidReady = null;

async function ensureVapid() {
  if (!vapidReady) {
    vapidReady = (async () => {
      let keys = await getVapidKeys();
      if (!keys || !keys.publicKey || !keys.privateKey) {
        keys = webpush.generateVAPIDKeys();
        await setVapidKeys(keys);
      }
      webpush.setVapidDetails("mailto:contato@noxion.app", keys.publicKey, keys.privateKey);
      return keys;
    })();
  }
  return vapidReady;
}

async function getPublicKey() {
  const keys = await ensureVapid();
  return keys.publicKey;
}

async function addSubscription(userId, subscription) {
  const subs = await getPushSubscriptionsForUser(userId);
  const exists = subs.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs.push(subscription);
    await setPushSubscriptionsForUser(userId, subs);
  }
}

async function removeSubscription(userId, endpoint) {
  const subs = await getPushSubscriptionsForUser(userId);
  const filtered = subs.filter((s) => s.endpoint !== endpoint);
  if (filtered.length !== subs.length) await setPushSubscriptionsForUser(userId, filtered);
}

async function sendPushToUser(userId, payload) {
  await ensureVapid();
  const subs = await getPushSubscriptionsForUser(userId);
  if (subs.length === 0) return { enviados: 0, removidos: 0 };

  // Manda só a URL da foto (não a foto em si) — o payload do push tem limite
  // de tamanho bem pequeno (poucos KB), então a imagem precisa ser buscada
  // separadamente pelo navegador na hora de mostrar a notificação.
  const temAvatar = await getAvatarForUser(userId);
  const finalPayload = temAvatar ? { ...payload, icon: `/api/avatar/${userId}` } : payload;

  const body = JSON.stringify(finalPayload);
  const results = await Promise.allSettled(subs.map((sub) => webpush.sendNotification(sub, body)));

  const stillValid = [];
  let enviados = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      stillValid.push(subs[i]);
      enviados++;
    } else {
      const statusCode = r.reason && r.reason.statusCode;
      // 404/410 = inscrição não existe mais (usuário desinstalou, trocou de navegador, etc) — remove
      if (statusCode !== 404 && statusCode !== 410) stillValid.push(subs[i]);
    }
  });

  if (stillValid.length !== subs.length) await setPushSubscriptionsForUser(userId, stillValid);
  return { enviados, removidos: subs.length - stillValid.length };
}

function formatMoeda(valor) {
  if (valor == null) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildPushPayload(notif) {
  const valorTxt = formatMoeda(notif.valor);
  const titulos = {
    gerada: "Venda gerada",
    aprovada: "Venda aprovada 🎉",
    cancelada: "Venda cancelada",
    reembolso: "Venda reembolsada ↩️",
    outro: "Notificação de venda",
  };
  const partes = [notif.gatewayNome, valorTxt].filter(Boolean);
  return {
    title: titulos[notif.tipo] || "Noxion",
    body: partes.join(" — ") || "Nova notificação recebida.",
    tag: `noxion-${notif.tipo}`,
    url: "/",
  };
}

module.exports = { ensureVapid, getPublicKey, addSubscription, removeSubscription, sendPushToUser, buildPushPayload };
