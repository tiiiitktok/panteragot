const { getGatewaysForUser, setGatewaysForUser, getGatewayIndex, setGatewayIndex } = require("../../lib/store");
const { slugify } = require("../../lib/detect");
const { requireAuth } = require("../../lib/auth");

function urlsFor(req, slug) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${req.headers.host}`;
  return { unica: `${base}/api/webhook/${slug}` };
}

module.exports = requireAuth(async (req, res) => {
  const userId = req.user.id;

  if (req.method === "GET") {
    const gateways = await getGatewaysForUser(userId);
    return res.status(200).json(gateways.map((g) => ({ ...g, urls: urlsFor(req, g.slug) })));
  }

  if (req.method === "POST") {
    const nome = ((req.body && req.body.nome) || "").trim();
    if (!nome) return res.status(400).json({ ok: false, erro: "informe um nome para o gateway" });

    // slug precisa ser único entre TODOS os usuários (é a chave pública na URL do webhook)
    const index = await getGatewayIndex();
    const existingSlugs = Object.keys(index).map((s) => ({ slug: s }));
    const slug = slugify(nome, existingSlugs);

    index[slug] = userId;
    await setGatewayIndex(index);

    const gateways = await getGatewaysForUser(userId);
    const gw = { slug, nome, criadoEm: new Date().toISOString() };
    gateways.push(gw);
    await setGatewaysForUser(userId, gateways);

    return res.status(200).json({ ...gw, urls: urlsFor(req, slug) });
  }

  res.status(405).json({ ok: false, erro: "método não permitido" });
});
