const { validateInitData } = require("../auth");

module.exports = function requireAuth(req, res, next) {
  const initData = (req.headers.authorization || "").replace(/^tma /, "");
  const tgUser = validateInitData(initData, process.env.BOT_TOKEN);
  if (!tgUser) return res.status(401).json({ error: "invalid initData" });

  req.tgUser = tgUser;
  next();
};