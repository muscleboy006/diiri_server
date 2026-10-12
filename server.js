const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const { initDb } = require("./db");
const compression = require("compression");


const TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !process.env.DATABASE_URL) {
    console.error("Заполни BOT_TOKEN и DATABASE_URL в .env");
    process.exit(1);
}

const app = express();
app.use(compression());
app.use(express.json());

app.use("/api/me", require("./routes/me"));
app.use("/api/chats", require("./routes/chats"));
app.use("/api/omonat", require("./routes/omonat"));
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "30d",
    immutable: true,
  })
);

const dist = path.join(__dirname, "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

(async () => {
  await initDb();
  app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
})();