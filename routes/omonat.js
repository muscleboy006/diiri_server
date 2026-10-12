const router = require("express").Router();
const requireAuth = require("../middleware/requireAuth");
const upload = require("../middleware/upload");
const c = require("../controllers/omonatController");

// Обёртка, чтобы ошибки async попадали в обработчик
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: "server error" });
  });

router.use(requireAuth);

router.get("/my", wrap(c.mine));        // до "/:id"
router.get("/cities", wrap(c.cities));
router.get("/by-ids", wrap(c.byIds));
router.get("/", wrap(c.list));
router.get("/:id", wrap(c.getOne));
router.post("/", upload, wrap(c.create));
router.patch("/:id", wrap(c.setStatus));
router.delete("/:id", wrap(c.remove));

module.exports = router;