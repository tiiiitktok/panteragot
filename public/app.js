const feed = document.getElementById("feed");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const periodLabel = document.getElementById("periodLabel");
const offlineBanner = document.getElementById("offlineBanner");
const gatewayMsg = document.getElementById("gatewayMsg");

const POLL_MS = 5000; // painel se atualiza sozinho a cada 5s (sem SSE, adaptado para Vercel)

const fmt = (n) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const tipoTitulo = { gerada: "Venda gerada", aprovada: "Venda aprovada", cancelada: "Venda cancelada", outro: "Notificação" };
const tipoBadge = { gerada: "VENDA GERADA", aprovada: "VENDA APROVADA", cancelada: "CANCELADA", outro: "EVENTO" };

function timeAgo(iso) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function apiFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    console.error("Falha de rede em", url, err);
    offlineBanner.classList.add("show");
    connDot.classList.remove("live");
    connText.textContent = "sem conexão com o servidor";
    throw err;
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const j = await res.json(); if (j.erro) msg = j.erro; } catch (_) {}
    offlineBanner.classList.add("show");
    connDot.classList.remove("live");
    connText.textContent = "erro ao falar com o servidor";
    const err = new Error(msg);
    err.status = res.status;
    console.error("Erro na API", url, msg);
    throw err;
  }
  offlineBanner.classList.remove("show");
  connDot.classList.add("live");
  connText.textContent = `atualizando a cada ${POLL_MS / 1000}s`;
  return res.json();
}

/* ============================= ABAS ============================= */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

/* ============================= PERÍODO ============================= */
let currentRange = null;

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function computeRange(period) {
  const now = new Date();
  if (period === "hoje") return { inicio: startOfDay(now), fim: endOfDay(now), label: "hoje" };
  if (period === "ontem") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { inicio: startOfDay(y), fim: endOfDay(y), label: "ontem" };
  }
  if (period === "semana") {
    const start = new Date(now); start.setDate(start.getDate() - 6);
    return { inicio: startOfDay(start), fim: endOfDay(now), label: "últimos 7 dias" };
  }
  if (period === "mes") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { inicio: startOfDay(start), fim: endOfDay(now), label: `mês atual (${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})` };
  }
  return null;
}

function applyRange(range) {
  currentRange = range;
  periodLabel.textContent = `Mostrando: ${range.label}`;
  loadDashboard();
}

document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("datePick").value = "";
    applyRange(computeRange(btn.dataset.period));
  });
});

document.getElementById("datePick").addEventListener("change", (e) => {
  if (!e.target.value) return;
  document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
  const [y, m, d] = e.target.value.split("-").map(Number);
  const chosen = new Date(y, m - 1, d);
  const label = chosen.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  applyRange({ inicio: startOfDay(chosen), fim: endOfDay(chosen), label });
});

/* ============================= DASHBOARD DATA ============================= */
async function loadDashboard() {
  if (!currentRange) return;
  const inicio = currentRange.inicio.toISOString();
  const fim = currentRange.fim.toISOString();

  let stats, list;
  try {
    [stats, list] = await Promise.all([
      apiFetch(`/api/stats?inicio=${inicio}&fim=${fim}`),
      apiFetch(`/api/notifications?inicio=${inicio}&fim=${fim}`),
    ]);
  } catch (_) {
    return;
  }

  document.getElementById("qtdGerada").textContent = stats.gerada.qtd;
  document.getElementById("valorGerada").textContent = fmt(stats.gerada.valor);
  document.getElementById("qtdAprovada").textContent = stats.aprovada.qtd;
  document.getElementById("valorAprovada").textContent = fmt(stats.aprovada.valor);
  document.getElementById("qtdCancelada").textContent = stats.cancelada.qtd;
  document.getElementById("valorCancelada").textContent = fmt(stats.cancelada.valor);

  feed.innerHTML = "";
  if (list.length === 0) {
    feed.innerHTML = `<div class="empty-state">Nenhum sinal neste período.</div>`;
  } else {
    list.forEach((n) => renderCard(n));
  }
}

function renderCard(notif) {
  const empty = feed.querySelector(".empty-state");
  if (empty) empty.remove();

  const card = document.createElement("div");
  card.className = `card ${notif.tipo}`;
  const sub = [notif.produto, notif.cliente].filter(Boolean).join(" · ") || "sem detalhes adicionais";

  card.innerHTML = `
    <span class="card-badge">${tipoBadge[notif.tipo] || "EVENTO"}</span>
    <div class="card-body">
      <div class="card-title">${tipoTitulo[notif.tipo] || "Notificação"}<span class="card-gateway">${notif.gatewayNome || "Genérico"}</span></div>
      <div class="card-sub">${sub}</div>
    </div>
    <div class="card-value">${notif.valor != null ? fmt(notif.valor) : "—"}</div>
    <div class="card-time">${timeAgo(notif.recebidoEm)}</div>
  `;
  feed.appendChild(card);
}

document.getElementById("clearBtn").addEventListener("click", async () => {
  if (!confirm("Limpar todo o histórico de notificações? Isso não pode ser desfeito.")) return;
  try {
    await apiFetch("/api/notifications", { method: "DELETE" });
    loadDashboard();
  } catch (_) {}
});

/* ============================= GATEWAYS ============================= */
const gatewayList = document.getElementById("gatewayList");
document.getElementById("urlAuto").textContent = `${window.location.origin}/api/webhook`;

function showGatewayMsg(text, type) {
  gatewayMsg.textContent = text;
  gatewayMsg.className = `form-msg ${type}`;
  if (type === "success") setTimeout(() => { gatewayMsg.textContent = ""; gatewayMsg.className = "form-msg"; }, 2500);
}

async function loadGateways() {
  let list;
  try {
    list = await apiFetch("/api/gateways");
  } catch (_) {
    gatewayList.innerHTML = `<div class="empty-gateways">Não foi possível carregar os gateways. Veja o aviso no topo da página.</div>`;
    return;
  }
  if (list.length === 0) {
    gatewayList.innerHTML = `<div class="empty-gateways">Nenhum gateway cadastrado ainda. Adicione um acima (ex: Hotmart, Kiwify, Stripe) para gerar as URLs de webhook dele.</div>`;
    return;
  }
  gatewayList.innerHTML = "";
  list.forEach((g) => {
    const card = document.createElement("div");
    card.className = "gateway-card";
    card.innerHTML = `
      <div class="gateway-card-head">
        <span class="gateway-card-name">${g.nome}</span>
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="gateway-card-date">desde ${new Date(g.criadoEm).toLocaleDateString("pt-BR")}</span>
          <button class="remove-btn" data-slug="${g.slug}">remover</button>
        </div>
      </div>
      <div class="url-field">
        <label>Venda gerada <span class="tag tag-gerada">pendente</span></label>
        <div class="url-row"><code>${g.urls.gerada}</code><button class="copy-btn" data-value="${g.urls.gerada}">copiar</button></div>
      </div>
      <div class="url-field">
        <label>Venda aprovada <span class="tag tag-aprovada">pago</span></label>
        <div class="url-row"><code>${g.urls.aprovada}</code><button class="copy-btn" data-value="${g.urls.aprovada}">copiar</button></div>
      </div>
      <div class="gateway-test-row">
        <button class="test-btn test-gerada" data-slug="${g.slug}" data-tipo="gerada">testar venda gerada</button>
        <button class="test-btn test-aprovada" data-slug="${g.slug}" data-tipo="aprovada">testar venda aprovada</button>
        <span class="test-result" data-result-for="${g.slug}"></span>
      </div>
    `;
    gatewayList.appendChild(card);
  });

  gatewayList.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.dataset.value, btn));
  });
  gatewayList.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remover este gateway? As URLs dele deixarão de funcionar.")) return;
      try {
        await apiFetch(`/api/gateways/${btn.dataset.slug}`, { method: "DELETE" });
        loadGateways();
      } catch (_) {}
    });
  });
  gatewayList.querySelectorAll(".test-btn").forEach((btn) => {
    btn.addEventListener("click", () => testGateway(btn.dataset.slug, btn.dataset.tipo, btn));
  });
}

async function testGateway(slug, tipo, btn) {
  const resultEl = gatewayList.querySelector(`.test-result[data-result-for="${slug}"]`);
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "enviando...";
  try {
    const res = await fetch(`/api/webhook/${slug}?tipo=${tipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: 97, cliente: "Teste do painel", produto: "Produto de teste" }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      resultEl.textContent = "✓ enviado — confira na aba Dashboard";
      resultEl.className = "test-result success";
    } else {
      resultEl.textContent = `✗ erro: ${data.erro || res.status}`;
      resultEl.className = "test-result error";
    }
  } catch (err) {
    resultEl.textContent = "✗ não foi possível enviar (veja o console)";
    resultEl.className = "test-result error";
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    setTimeout(() => { resultEl.textContent = ""; resultEl.className = "test-result"; }, 6000);
  }
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    window.prompt("Copie manualmente (Ctrl+C):", text);
    return;
  }
  const original = btn.textContent;
  btn.textContent = "copiado";
  btn.classList.add("copied");
  setTimeout(() => { btn.textContent = original; btn.classList.remove("copied"); }, 1500);
}

document.getElementById("addGatewayBtn").addEventListener("click", addGateway);
document.getElementById("gatewayNameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addGateway(); });

async function addGateway() {
  const input = document.getElementById("gatewayNameInput");
  const nome = input.value.trim();
  if (!nome) {
    showGatewayMsg("Digite um nome para o gateway antes de adicionar.", "error");
    return;
  }
  const btn = document.getElementById("addGatewayBtn");
  btn.disabled = true;
  btn.textContent = "adicionando…";
  try {
    await apiFetch("/api/gateways", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    input.value = "";
    showGatewayMsg(`Gateway "${nome}" adicionado.`, "success");
    await loadGateways();
  } catch (err) {
    showGatewayMsg(`Não foi possível adicionar: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "adicionar gateway";
  }
}

document.querySelectorAll(".advanced .copy-btn[data-target]").forEach((btn) => {
  btn.addEventListener("click", () => copyText(document.getElementById(btn.dataset.target).textContent, btn));
});

/* ============================= ATUALIZAÇÃO AUTOMÁTICA ============================= */
// A Vercel não mantém conexões abertas (sem SSE/WebSocket em funções serverless),
// então o painel se atualiza sozinho a cada POLL_MS, buscando os dados mais recentes.
function startPolling() {
  setInterval(() => {
    if (document.hidden) return; // não gasta requisições com a aba em segundo plano
    loadDashboard();
    if (document.getElementById("tab-webhooks").classList.contains("active")) loadGateways();
  }, POLL_MS);
}

/* ============================= NOTIFICAÇÕES NO CELULAR (PUSH) ============================= */
const pushStatusDot = document.getElementById("pushStatusDot");
const pushStatusText = document.getElementById("pushStatusText");
const pushStatusDetail = document.getElementById("pushStatusDetail");
const pushActivateBtn = document.getElementById("pushActivateBtn");
const pushTestBtn = document.getElementById("pushTestBtn");
const pushDeactivateBtn = document.getElementById("pushDeactivateBtn");
const pushMsg = document.getElementById("pushMsg");

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

function setPushStatus(state, text, detail) {
  pushStatusDot.className = `push-status-dot ${state}`;
  pushStatusText.textContent = text;
  pushStatusDetail.textContent = detail || "";
  pushActivateBtn.style.display = "none";
  pushTestBtn.style.display = "none";
  pushDeactivateBtn.style.display = "none";
}

function pushMsgShow(text, type) {
  pushMsg.textContent = text;
  pushMsg.className = `form-msg ${type}`;
  if (type === "success") setTimeout(() => { pushMsg.textContent = ""; pushMsg.className = "form-msg"; }, 5000);
}

let swRegistration = null;

async function refreshPushStatus() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    if (isIos() && !isStandalone()) {
      setPushStatus("warn", "Ainda não dá pra ativar neste navegador",
        "No iPhone, o Safari sozinho não permite notificações. Adicione o site à Tela de Início primeiro (veja as instruções abaixo).");
    } else {
      setPushStatus("error", "Não suportado neste navegador",
        "Tente em um navegador mais recente, como Chrome ou Safari atualizado.");
    }
    return;
  }

  swRegistration = await navigator.serviceWorker.register("/sw.js");

  if (isIos() && !isStandalone()) {
    setPushStatus("warn", "Adicione à Tela de Início primeiro",
      "Você está no Safari normal. Siga as instruções abaixo pra instalar o app e então ativar as notificações.");
    return;
  }

  if (Notification.permission === "denied") {
    setPushStatus("error", "Notificações bloqueadas",
      "Você negou a permissão antes. Ative de novo nas configurações do site, dentro das configurações do navegador.");
    return;
  }

  const existing = await swRegistration.pushManager.getSubscription();
  if (existing) {
    setPushStatus("ok", "Notificações ativadas", "Você vai receber um aviso a cada venda gerada ou aprovada.");
    pushTestBtn.style.display = "inline-block";
    pushDeactivateBtn.style.display = "inline-block";
    return;
  }

  setPushStatus("warn", "Notificações desativadas", "Ative pra receber um aviso no celular a cada venda gerada ou aprovada.");
  pushActivateBtn.style.display = "inline-block";
}

async function activatePush() {
  pushActivateBtn.disabled = true;
  pushActivateBtn.textContent = "ativando...";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      pushMsgShow("Permissão não concedida pelo navegador.", "error");
      await refreshPushStatus();
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await apiFetch("/api/push/vapid-public-key");
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await apiFetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    await apiFetch("/api/push/test", { method: "POST" });
    pushMsgShow("Ativado! Uma notificação de teste foi enviada — confira seu celular.", "success");
  } catch (err) {
    console.error(err);
    pushMsgShow("Não foi possível ativar. Tenta de novo em alguns instantes.", "error");
  } finally {
    pushActivateBtn.disabled = false;
    pushActivateBtn.textContent = "ativar notificações";
    await refreshPushStatus();
  }
}

async function testPush() {
  pushTestBtn.disabled = true;
  pushTestBtn.textContent = "enviando...";
  try {
    const result = await apiFetch("/api/push/test", { method: "POST" });
    if (result.enviados > 0) {
      pushMsgShow("Notificação de teste enviada — confira seu celular.", "success");
    } else {
      pushMsgShow("O servidor não encontrou nenhuma inscrição ativa. Tente desativar e ativar de novo.", "error");
    }
  } catch (err) {
    console.error(err);
    pushMsgShow("Não foi possível enviar o teste agora.", "error");
  } finally {
    pushTestBtn.disabled = false;
    pushTestBtn.textContent = "enviar notificação de teste";
  }
}

async function deactivatePush() {
  pushDeactivateBtn.disabled = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiFetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    pushMsgShow("Notificações desativadas.", "success");
  } catch (err) {
    console.error(err);
    pushMsgShow("Não foi possível desativar agora.", "error");
  } finally {
    pushDeactivateBtn.disabled = false;
    await refreshPushStatus();
  }
}

pushActivateBtn.addEventListener("click", activatePush);
pushTestBtn.addEventListener("click", testPush);
pushDeactivateBtn.addEventListener("click", deactivatePush);

/* ============================= INIT ============================= */
applyRange(computeRange("hoje"));
loadGateways();
startPolling();
refreshPushStatus();
