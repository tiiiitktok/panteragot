const { getNotifications } = require("../lib/store");
const { filterByRange } = require("../lib/detect");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const { inicio, fim } = req.query;
  const list = await getNotifications();
  const filtered = filterByRange(list, inicio, fim);

  const stats = {
    gerada: { qtd: 0, valor: 0 },
    aprovada: { qtd: 0, valor: 0 },
    cancelada: { qtd: 0, valor: 0 },
    outro: { qtd: 0, valor: 0 },
  };

  for (const n of filtered) {
    const bucket = stats[n.tipo] || stats.outro;
    bucket.qtd += 1;
    bucket.valor += n.valor || 0;
  }

  res.status(200).json(stats);
};
