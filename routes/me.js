const router = require("express").Router();
const requireAuth = require("../middleware/requireAuth");
const { getUser } = require("../db");

router.get("/", requireAuth, async (req, res) => {
  try {
    res.json({ user: await getUser(req.tgUser.id) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

module.exports = router;