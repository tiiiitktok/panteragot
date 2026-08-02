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

    // O slug já começa com o nome (único) da conta, então nunca colide com o
    // gateway de outra pessoa — só precisa desambiguar dentro dos gateways
    // deste mesmo usuário, caso ele repita o nome de um gateway já existente.
    const gateways = await getGatewaysForUser(userId);
    const parteDoGateway = slugify(nome, []);
    const base = `${req.user.nomeSlug}-${parteDoGateway}`;
    let slug = base;
    let i = 2;
    while (gateways.some((g) => g.slug === slug)) slug = `${base}-${i++}`;

    const index = await getGatewayIndex();
    index[slug] = userId;
    await setGatewayIndex(index);

    const gw = { slug, nome, criadoEm: new Date().toISOString() };
    gateways.push(gw);
    await setGatewaysForUser(userId, gateways);

    return res.status(200).json({ ...gw, urls: urlsFor(req, slug) });
  }

  res.status(405).json({ ok: false, erro: "método não permitido" });
});
