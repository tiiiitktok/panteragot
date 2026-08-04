const feed = document.getElementById("feed");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const periodLabel = document.getElementById("periodLabel");
const offlineBanner = document.getElementById("offlineBanner");
const gatewayMsg = document.getElementById("gatewayMsg");

const POLL_MS = 5000; // painel se atualiza sozinho a cada 5s (sem SSE, adaptado para Vercel)

const fmt = (n) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const tipoTitulo = { gerada: "Venda gerada", aprovada: "Venda aprovada", cancelada: "Venda cancelada", reembolso: "Venda reembolsada", outro: "Notificação" };
const tipoBadge = { gerada: "VENDA GERADA", aprovada: "VENDA APROVADA", cancelada: "CANCELADA", reembolso: "REEMBOLSO", outro: "EVENTO" };

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
    if (res.status === 401) {
      // sessão expirou ou foi encerrada em outro lugar — volta pra tela de login
      if (typeof showAuthScreen === "function") showAuthScreen();
    } else {
      offlineBanner.classList.add("show");
      connDot.classList.remove("live");
      connText.textContent = "erro ao falar com o servidor";
    }
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
document.querySelectorAll(".side-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side-nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "admin") loadAdmin();
  });
});

/* ============================= PERÍODO ============================= */
let currentRange = null;
let currentGatewayFilter = "";

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

document.getElementById("gatewayFilterSelect").addEventListener("change", (e) => {
  currentGatewayFilter = e.target.value;
  loadDashboard();
});

function populateGatewayFilter(gateways) {
  const select = document.getElementById("gatewayFilterSelect");
  const valorAtual = select.value;
  select.innerHTML = `<option value="">Todos os gateways</option>`;
  gateways.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.slug;
    opt.textContent = g.nome;
    select.appendChild(opt);
  });
  // mantém a seleção atual se o gateway escolhido ainda existir na lista
  if (gateways.some((g) => g.slug === valorAtual)) select.value = valorAtual;
  else { select.value = ""; currentGatewayFilter = ""; }
}

/* ============================= DASHBOARD DATA ============================= */
async function loadDashboard() {
  if (!currentRange) return;
  const inicio = currentRange.inicio.toISOString();
  const fim = currentRange.fim.toISOString();
  const gatewayParam = currentGatewayFilter ? `&gateway=${encodeURIComponent(currentGatewayFilter)}` : "";

  let stats, list;
  try {
    [stats, list] = await Promise.all([
      apiFetch(`/api/stats?inicio=${inicio}&fim=${fim}${gatewayParam}`),
      apiFetch(`/api/notifications?inicio=${inicio}&fim=${fim}${gatewayParam}`),
    ]);
  } catch (_) {
    return;
  }

  renderStats(stats);

  feed.innerHTML = "";
  if (list.length === 0) {
    feed.innerHTML = `<div class="empty-state">Nenhum sinal neste período${currentGatewayFilter ? " para este gateway" : ""}.</div>`;
  } else {
    list.forEach((n) => renderCard(n));
  }
}

function renderStats(stats) {
  document.getElementById("qtdGerada").textContent = stats.gerada.qtd;
  document.getElementById("valorGerada").textContent = fmt(stats.gerada.valor);
  document.getElementById("qtdAprovada").textContent = stats.aprovada.qtd;
  document.getElementById("valorAprovada").textContent = fmt(stats.aprovada.valor);
  document.getElementById("qtdReembolso").textContent = stats.reembolso.qtd;
  document.getElementById("valorReembolso").textContent = fmt(stats.reembolso.valor);

  const taxaEl = document.getElementById("taxaConversao");
  const detalheEl = document.getElementById("detalheConversao");
  if (stats.gerada.qtd > 0) {
    const pct = (stats.aprovada.qtd / stats.gerada.qtd) * 100;
    const pctTxt = pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    taxaEl.textContent = `${pctTxt}%`;
    detalheEl.textContent = `${fmt(stats.aprovada.valor)} pagos de ${fmt(stats.gerada.valor)} gerados`;
  } else {
    taxaEl.textContent = "—";
    detalheEl.textContent = "sem vendas geradas no período";
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
  populateGatewayFilter(list);
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
        <label>URL única do webhook <span class="tag tag-unica">identifica sozinha</span></label>
        <div class="url-row"><code>${g.urls.unica}</code><button class="copy-btn" data-value="${g.urls.unica}">copiar</button></div>
        <p class="url-field-hint">Cadastre essa única URL na sua plataforma. O sistema identifica sozinho se é venda gerada, aprovada ou reembolsada, olhando o conteúdo de cada notificação.</p>
      </div>
      <div class="gateway-test-row">
        <button class="test-btn test-gerada" data-slug="${g.slug}" data-tipo="gerada">testar venda gerada</button>
        <button class="test-btn test-aprovada" data-slug="${g.slug}" data-tipo="aprovada">testar venda aprovada</button>
        <button class="test-btn test-reembolso" data-slug="${g.slug}" data-tipo="reembolso">testar reembolso</button>
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
      if (!confirm("Remover este gateway? A URL dele deixará de funcionar.")) return;
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

// status "genérico" que representa cada tipo, usado só pra testar se a
// detecção automática (sem ?tipo= forçado) classifica certo
const STATUS_DE_TESTE = { gerada: "pending", aprovada: "paid", reembolso: "refunded" };

async function testGateway(slug, tipoEsperado, btn) {
  const resultEl = gatewayList.querySelector(`.test-result[data-result-for="${slug}"]`);
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "enviando...";
  try {
    const res = await fetch(`/api/webhook/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: STATUS_DE_TESTE[tipoEsperado], valor: 97, cliente: "Teste do painel", produto: "Produto de teste" }),
    });
    const data = await res.json();
    if (res.ok && data.ok && data.classificado_como === tipoEsperado) {
      resultEl.textContent = "✓ enviado e identificado certo — confira na aba Dashboard";
      resultEl.className = "test-result success";
    } else if (res.ok && data.ok) {
      resultEl.textContent = `⚠ chegou, mas foi identificado como "${data.classificado_como}" em vez de "${tipoEsperado}"`;
      resultEl.className = "test-result error";
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
    setTimeout(() => { resultEl.textContent = ""; resultEl.className = "test-result"; }, 7000);
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
const pushToggleBtn = document.getElementById("pushToggleBtn");
const pushTestBtn = document.getElementById("pushTestBtn");
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
function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function pushMsgShow(text, type) {
  pushMsg.textContent = text;
  pushMsg.className = `form-msg ${type}`;
  if (type === "success") setTimeout(() => { pushMsg.textContent = ""; pushMsg.className = "form-msg"; }, 5000);
}

let swRegistration = null;
let pushState = "checking"; // checking | unsupported | ios-precisa-instalar | bloqueado | desativado | ativado

function renderPushUI() {
  pushTestBtn.style.display = pushState === "ativado" ? "inline-block" : "none";
  pushToggleBtn.disabled = false;

  const map = {
    checking: { dot: "", text: "Verificando status…", detail: "", btn: "ativar notificações" },
    unsupported: { dot: "error", text: "Não suportado neste navegador", detail: "Tente em um navegador mais recente, como Chrome ou Safari atualizado.", btn: "ativar notificações" },
    "ios-precisa-instalar": { dot: "warn", text: "Ainda não dá pra ativar neste navegador", detail: "No iPhone, o Safari sozinho não permite notificações. Adicione o site à Tela de Início primeiro (veja as instruções abaixo).", btn: "ativar notificações" },
    bloqueado: { dot: "error", text: "Notificações bloqueadas", detail: "Você negou a permissão antes. Ative de novo nas configurações do site, dentro das configurações do navegador.", btn: "ativar notificações" },
    desativado: { dot: "warn", text: "Notificações desativadas", detail: "Ative pra receber um aviso no celular a cada venda gerada ou aprovada.", btn: "ativar notificações" },
    ativado: { dot: "ok", text: "Notificações ativadas", detail: "Você vai receber um aviso a cada venda gerada ou aprovada.", btn: "desativar notificações" },
  };
  const s = map[pushState] || map.checking;
  pushStatusDot.className = `push-status-dot ${s.dot}`;
  pushStatusText.textContent = s.text;
  pushStatusDetail.textContent = s.detail;
  pushToggleBtn.textContent = s.btn;
}

async function refreshPushStatus() {
  if (!pushSupported()) {
    pushState = isIos() && !isStandalone() ? "ios-precisa-instalar" : "unsupported";
    renderPushUI();
    return;
  }

  swRegistration = await navigator.serviceWorker.register("/sw.js");

  if (isIos() && !isStandalone()) {
    pushState = "ios-precisa-instalar";
    renderPushUI();
    return;
  }

  if (Notification.permission === "denied") {
    pushState = "bloqueado";
    renderPushUI();
    return;
  }

  const existing = await swRegistration.pushManager.getSubscription();
  pushState = existing ? "ativado" : "desativado";
  renderPushUI();
}

async function togglePush() {
  if (pushState === "ativado") return deactivatePush();

  if (pushState === "unsupported") {
    pushMsgShow("Este navegador não tem suporte a notificações push.", "error");
    return;
  }
  if (pushState === "ios-precisa-instalar") {
    pushMsgShow("Primeiro adicione o site à Tela de Início (veja as instruções abaixo), depois abra por lá.", "error");
    return;
  }
  if (pushState === "bloqueado") {
    pushMsgShow("As notificações estão bloqueadas nas configurações do navegador para este site. Ative por lá primeiro.", "error");
    return;
  }

  pushToggleBtn.disabled = true;
  pushToggleBtn.textContent = "ativando...";
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
    await refreshPushStatus();
  }
}

async function deactivatePush() {
  pushToggleBtn.disabled = true;
  pushToggleBtn.textContent = "desativando...";
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

pushToggleBtn.addEventListener("click", togglePush);
pushTestBtn.addEventListener("click", testPush);

/* ============================= AUTENTICAÇÃO ============================= */
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const authMsg = document.getElementById("authMsg");
const sideUserEmail = document.getElementById("sideUserEmail");
const adminNavBtn = document.getElementById("adminNavBtn");
const sideAvatarImg = document.getElementById("sideAvatarImg");
const sideAvatarPlaceholder = document.getElementById("sideAvatarPlaceholder");

let appStarted = false;
let currentUser = { nome: "", email: "", avatar: null };

function showAuthScreen() {
  appShell.style.display = "none";
  authScreen.style.display = "flex";
}

function renderAvatarEls(dataUrl) {
  [
    [sideAvatarImg, sideAvatarPlaceholder],
    [document.getElementById("profileAvatarImg"), document.getElementById("profileAvatarPlaceholder")],
  ].forEach(([img, placeholder]) => {
    if (!img || !placeholder) return;
    if (dataUrl) {
      img.src = dataUrl;
      img.style.display = "block";
      placeholder.style.display = "none";
    } else {
      img.style.display = "none";
      placeholder.style.display = "block";
    }
  });
}

function showApp(nome, email, isAdmin, avatar) {
  authScreen.style.display = "none";
  appShell.style.display = "flex";
  currentUser = { nome: nome || "", email: email || "", avatar: avatar || null };
  if (sideUserEmail) sideUserEmail.textContent = nome || email || "";
  if (adminNavBtn) adminNavBtn.style.display = isAdmin ? "flex" : "none";
  renderAvatarEls(currentUser.avatar);
  const nomeInput = document.getElementById("profileNomeInput");
  if (nomeInput) nomeInput.value = currentUser.nome;
  if (!appStarted) {
    appStarted = true;
    startApp();
  }
}

function authMsgShow(text, type) {
  authMsg.textContent = text;
  authMsg.className = `form-msg ${type}`;
}

document.querySelectorAll(".auth-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.authtab}Form`).classList.add("active");
    authMsg.textContent = "";
    authMsg.className = "form-msg";
  });
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn = e.target.querySelector(".auth-submit");
  btn.disabled = true;
  btn.textContent = "entrando...";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      authMsg.textContent = "";
      showApp(data.nome, data.email, data.isAdmin, data.avatar);
    } else {
      authMsgShow(data.erro || "Não foi possível entrar.", "error");
    }
  } catch (err) {
    console.error(err);
    authMsgShow("Não foi possível falar com o servidor.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("signupNome").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const btn = e.target.querySelector(".auth-submit");
  btn.disabled = true;
  btn.textContent = "criando conta...";
  try {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, password }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      authMsg.textContent = "";
      showApp(data.nome, data.email, data.isAdmin, data.avatar);
    } else {
      authMsgShow(data.erro || "Não foi possível criar a conta.", "error");
    }
  } catch (err) {
    console.error(err);
    authMsgShow("Não foi possível falar com o servidor.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Criar conta";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (_) {}
  window.location.reload();
});

async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      showApp(data.nome, data.email, data.isAdmin, data.avatar);
    } else {
      showAuthScreen();
    }
  } catch (_) {
    showAuthScreen();
  }
}

/* ============================= ADMIN ============================= */
const adminList = document.getElementById("adminList");

async function loadAdmin() {
  let list;
  try {
    list = await apiFetch("/api/admin/users");
  } catch (err) {
    adminList.innerHTML = `<div class="empty-gateways">Não foi possível carregar as contas${err.status === 403 ? " (acesso restrito ao administrador)" : ""}.</div>`;
    return;
  }
  if (list.length === 0) {
    adminList.innerHTML = `<div class="empty-gateways">Nenhuma conta encontrada.</div>`;
    return;
  }
  adminList.innerHTML = "";
  list.forEach((u) => {
    const card = document.createElement("div");
    card.className = "gateway-card";
    card.innerHTML = `
      <div class="gateway-card-head">
        <span class="gateway-card-name">${u.nome}<span class="admin-email">${u.email}</span></span>
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="gateway-card-date">desde ${new Date(u.criadoEm).toLocaleDateString("pt-BR")}</span>
          <button class="remove-btn" data-id="${u.id}">excluir conta</button>
        </div>
      </div>
      <div class="admin-stats-row">
        <span>${u.totalGateways} gateway(s)</span>
        <span>${u.totalNotificacoes} notificação(ões)</span>
      </div>
    `;
    adminList.appendChild(card);
  });

  adminList.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir esta conta e todos os dados dela (gateways, notificações, inscrições push)? Isso não pode ser desfeito.")) return;
      btn.disabled = true;
      btn.textContent = "excluindo...";
      try {
        await apiFetch(`/api/admin/users/${btn.dataset.id}`, { method: "DELETE" });
        loadAdmin();
      } catch (err) {
        alert("Não foi possível excluir: " + err.message);
        btn.disabled = false;
        btn.textContent = "excluir conta";
      }
    });
  });
}

/* ============================= PERFIL ============================= */
function resizeImageToDataUrl(file, maxSize = 240, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("não foi possível ler o arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("arquivo não é uma imagem válida"));
      img.onload = () => {
        // corta em quadrado (cover) e reduz pro tamanho máximo, pra manter o
        // arquivo pequeno o suficiente pra guardar no banco sem problema
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function avatarMsgShow(text, type) {
  const el = document.getElementById("avatarMsg");
  el.textContent = text;
  el.className = `form-msg ${type}`;
  if (type === "success") setTimeout(() => { el.textContent = ""; el.className = "form-msg"; }, 4000);
}

document.getElementById("avatarInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImageToDataUrl(file);
    await apiFetch("/api/account/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    currentUser.avatar = dataUrl;
    renderAvatarEls(dataUrl);
    avatarMsgShow("Foto atualizada.", "success");
  } catch (err) {
    console.error(err);
    avatarMsgShow(err.message || "Não foi possível enviar a foto.", "error");
  } finally {
    e.target.value = "";
  }
});

document.getElementById("removeAvatarBtn").addEventListener("click", async () => {
  try {
    await apiFetch("/api/account/avatar", { method: "DELETE" });
    currentUser.avatar = null;
    renderAvatarEls(null);
    avatarMsgShow("Foto removida.", "success");
  } catch (err) {
    avatarMsgShow(err.message || "Não foi possível remover a foto.", "error");
  }
});

function profileNomeMsgShow(text, type) {
  const el = document.getElementById("profileNomeMsg");
  el.textContent = text;
  el.className = `form-msg ${type}`;
  if (type === "success") setTimeout(() => { el.textContent = ""; el.className = "form-msg"; }, 4000);
}

document.getElementById("profileNomeBtn").addEventListener("click", async () => {
  const input = document.getElementById("profileNomeInput");
  const novoNome = input.value.trim();
  if (!novoNome) {
    profileNomeMsgShow("Digite um nome.", "error");
    return;
  }
  const btn = document.getElementById("profileNomeBtn");
  btn.disabled = true;
  btn.textContent = "salvando...";
  try {
    await apiFetch("/api/account/nome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome }),
    });
    currentUser.nome = novoNome;
    if (sideUserEmail) sideUserEmail.textContent = novoNome;
    profileNomeMsgShow("Nome atualizado.", "success");
  } catch (err) {
    profileNomeMsgShow(err.message || "Não foi possível salvar.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "salvar";
  }
});

function deleteMsgShow(text, type) {
  const el = document.getElementById("deleteMsg");
  el.textContent = text;
  el.className = `form-msg ${type}`;
}

document.getElementById("startDeleteBtn").addEventListener("click", () => {
  document.getElementById("deleteAccountForm").style.display = "block";
  document.getElementById("startDeleteBtn").style.display = "none";
  document.getElementById("deletePasswordInput").focus();
});

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  const password = document.getElementById("deletePasswordInput").value;
  if (!password) {
    deleteMsgShow("Digite sua senha pra confirmar.", "error");
    return;
  }
  if (!confirm("Tem certeza? Sua conta e todos os seus dados serão apagados PERMANENTEMENTE.")) return;

  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true;
  btn.textContent = "excluindo...";
  try {
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      window.location.reload();
    } else {
      deleteMsgShow(data.erro || "Não foi possível excluir.", "error");
      btn.disabled = false;
      btn.textContent = "excluir minha conta";
    }
  } catch (err) {
    console.error(err);
    deleteMsgShow("Não foi possível falar com o servidor.", "error");
    btn.disabled = false;
    btn.textContent = "excluir minha conta";
  }
});

/* ============================= INIT ============================= */
function startApp() {
  applyRange(computeRange("hoje"));
  loadGateways();
  startPolling();
  refreshPushStatus();
}

checkAuth();
