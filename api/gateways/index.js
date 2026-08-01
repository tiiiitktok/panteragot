const { getGateways, setGateways } = require("../../lib/store");
const { slugify } = require("../../lib/detect");

function urlsFor(req, slug) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${req.headers.host}`;
  return {
    gerada: `${base}/api/webhook/${slug}?tipo=gerada`,
    aprovada: `${base}/api/webhook/${slug}?tipo=aprovada`,
  };
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const gateways = await getGateways();
    return res.status(200).json(gateways.map((g) => ({ ...g, urls: urlsFor(req, g.slug) })));
  }

  if (req.method === "POST") {
    const nome = ((req.body && req.body.nome) || "").trim();
    if (!nome) return res.status(400).json({ ok: false, erro: "informe um nome para o gateway" });

    const gateways = await getGateways();
    const slug = slugify(nome, gateways);
    const gw = { slug, nome, criadoEm: new Date().toISOString() };
    gateways.push(gw);
    await setGateways(gateways);

    return res.status(200).json({ ...gw, urls: urlsFor(req, slug) });
  }

  res.status(405).json({ ok: false, erro: "método não permitido" });
};
