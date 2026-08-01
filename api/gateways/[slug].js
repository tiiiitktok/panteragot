const { getGateways, setGateways } = require("../../lib/store");

module.exports = async (req, res) => {
  if (req.method !== "DELETE") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  const gateways = await getGateways();
  const filtered = gateways.filter((g) => g.slug !== req.query.slug);
  await setGateways(filtered);
  res.status(200).json({ ok: true });
};
