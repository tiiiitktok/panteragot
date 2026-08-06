const { getGatewaysForUser, setGatewaysForUser, getGatewayIndex, setGatewayIndex } = require("../../lib/store");
const { requireAuth } = require("../../lib/auth");

module.exports = requireAuth(async (req, res) => {
  if (req.method !== "DELETE") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  const userId = req.user.id;
  const slug = req.query.slug;

  const gateways = await getGatewaysForUser(userId);
  const filtered = gateways.filter((g) => g.slug !== slug);
  await setGatewaysForUser(userId, filtered);

  // só remove do índice global se o gateway realmente pertencer a este usuário
  const index = await getGatewayIndex();
  if (index[slug] === userId) {
    delete index[slug];
    await setGatewayIndex(index);
  }

  res.status(200).json({ ok: true });
});
