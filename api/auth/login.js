const { getUsers } = require("../../lib/store");
const { verifyPassword, signToken, setSessionCookie, isAdminEmail } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "método não permitido" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, erro: "informe e-mail e senha" });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const users = await getUsers();
  const user = users.find((u) => u.email === emailNorm);

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ ok: false, erro: "e-mail ou senha incorretos" });
  }

  const token = await signToken({ uid: user.id });
  setSessionCookie(req, res, token);

  res.status(200).json({ ok: true, email: user.email, nome: user.nome, isAdmin: isAdminEmail(user.email) });
};
