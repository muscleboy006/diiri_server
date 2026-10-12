const router = require("express").Router();
const requireAuth = require("../middleware/requireAuth");
const c = require("../controllers/chatController");

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: "server error" });
  });

router.use(requireAuth);

router.get("/unread", wrap(c.unread)); // до "/:id"
router.get("/", wrap(c.list));
router.post("/", wrap(c.start));
router.get("/:id/messages", wrap(c.messages));
router.post("/:id/messages", wrap(c.send));

module.exports = router;