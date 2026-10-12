const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const dir = path.join(__dirname, "../uploads");
fs.mkdirSync(dir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => {
      const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype];
      cb(null, crypto.randomBytes(16).toString("hex") + ext);
    },
  }),
  fileFilter: (req, file, cb) =>
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).array("images", 5);

// Ошибки multer -> нормальный JSON
module.exports = (req, res, next) =>
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: "Ошибка загрузки фото (макс. 5 шт, до 5 МБ)" });
    next();
  });

module.exports.dir = dir;