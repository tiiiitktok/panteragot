const { getAvatarForUser } = require("../../lib/store");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const userId = req.query.userId;
  const avatar = await getAvatarForUser(userId);
  if (!avatar) {
    return res.status(404).end();
  }

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(avatar);
  if (!match) {
    return res.status(404).end();
  }

  const [, mime, base64Data] = match;
  const buffer = Buffer.from(base64Data, "base64");

  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(buffer);
};
