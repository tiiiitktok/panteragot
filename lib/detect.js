// Funções compartilhadas por todas as rotas: detectam o tipo de evento,
// o valor da venda e outros dados a partir de qualquer formato de payload.

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(str, existing = []) {
  const base = normalize(str).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "gateway";
  let slug = base;
  let i = 2;
  while (existing.some((g) => g.slug === slug)) slug = `${base}-${i++}`;
  return slug;
}

const GENERATED_WORDS = ["gerad", "pending", "pendente", "waiting", "aguardando", "created", "checkout", "boleto_gerado", "pix_gerado", "order_created", "billet", "open", "process"];
const APPROVED_WORDS = ["aprovad", "approved", "paid", "pago", "completed", "complete", "confirmed", "confirmad", "succeeded", "success", "captured"];
const REFUNDED_WORDS = ["reembols", "refund", "chargeback", "estornad", "estorno"];
const CANCELLED_WORDS = ["cancel", "expired", "expirad", "recus", "denied", "declined", "failed"];

function findFirst(obj, keyRegex, seen = new Set()) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return undefined;
  seen.add(obj);
  for (const [key, val] of Object.entries(obj)) {
    if (keyRegex.test(key)) {
      if (typeof val === "string" || typeof val === "number") return val;
    }
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      const found = findFirst(val, keyRegex, seen);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

const TIPOS_VALIDOS = ["gerada", "aprovada", "cancelada", "reembolso"];

function detectTipo(body, queryTipo) {
  if (TIPOS_VALIDOS.includes(queryTipo)) return queryTipo;
  const statusVal = findFirst(body, /status|event|evento|tipo|situacao/i);
  const n = normalize(statusVal);
  if (n) {
    if (REFUNDED_WORDS.some((w) => n.includes(w))) return "reembolso";
    if (CANCELLED_WORDS.some((w) => n.includes(w))) return "cancelada";
    if (APPROVED_WORDS.some((w) => n.includes(w))) return "aprovada";
    if (GENERATED_WORDS.some((w) => n.includes(w))) return "gerada";
  }
  return "outro";
}

function detectValor(body) {
  const raw = findFirst(body, /valor|amount|price|preco|total/i);
  if (raw === undefined) return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function detectExtra(body) {
  const cliente = findFirst(body, /customer_?name|buyer_?name|cliente|nome|first_name/i);
  const sobrenome = findFirst(body, /last_name/i);
  const produto = findFirst(body, /product_?name|produto|item_?name|plano|plan_name/i);
  const clienteCompleto = cliente && sobrenome ? `${cliente} ${sobrenome}` : cliente;
  return { cliente: clienteCompleto ? String(clienteCompleto) : null, produto: produto ? String(produto) : null };
}

function checkSecret(req, res) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  const token = (req.query && req.query.token) || req.headers["x-webhook-token"];
  if (token === secret) return true;
  res.status(401).json({ ok: false, erro: "token inválido" });
  return false;
}

function filterByRange(list, inicio, fim) {
  let out = list;
  if (inicio) out = out.filter((n) => n.recebidoEm >= inicio);
  if (fim) out = out.filter((n) => n.recebidoEm <= fim);
  return out;
}

module.exports = { normalize, slugify, findFirst, detectTipo, detectValor, detectExtra, checkSecret, filterByRange };
