const { getNotifications, setNotifications } = require("../../lib/store");
const { filterByRange } = require("../../lib/detect");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const { inicio, fim } = req.query;
    const list = await getNotifications();
    const filtered = filterByRange(list, inicio, fim);
    return res.status(200).json(filtered.slice(-500).reverse());
  }

  if (req.method === "DELETE") {
    await setNotifications([]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ ok: false, erro: "método não permitido" });
};
