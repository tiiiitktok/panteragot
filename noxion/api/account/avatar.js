const { setAvatarForUser, deleteAvatarForUser } = require("../../lib/store");
const { requireAuth } = require("../../lib/auth");

const TAMANHO_MAXIMO = 700 * 1024; // ~700KB de texto base64 — a imagem já vem reduzida do navegador

module.exports = requireAuth(async (req, res) => {
  if (req.method === "POST") {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ ok: false, erro: "imagem inválida" });
    }
    if (dataUrl.length > TAMANHO_MAXIMO) {
      return res.status(400).json({ ok: false, erro: "imagem muito grande, tente outra" });
    }
    await setAvatarForUser(req.user.id, dataUrl);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await deleteAvatarForUser(req.user.id);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ ok: false, erro: "método não permitido" });
});
