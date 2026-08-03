const { getUserFromReq, isAdminEmail } = require("../../lib/auth");
const { getAvatarForUser } = require("../../lib/store");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ ok: false });
  const avatar = await getAvatarForUser(user.id);
  res.status(200).json({ ok: true, email: user.email, nome: user.nome, isAdmin: isAdminEmail(user.email), avatar });
};
