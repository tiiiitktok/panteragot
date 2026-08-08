const { getPublicKey } = require("../../lib/push");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  try {
    const publicKey = await getPublicKey();
    res.status(200).json({ publicKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "não foi possível gerar/obter a chave VAPID" });
  }
};
