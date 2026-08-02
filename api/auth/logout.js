const { clearSessionCookie } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  clearSessionCookie(req, res);
  res.status(200).json({ ok: true });
};
