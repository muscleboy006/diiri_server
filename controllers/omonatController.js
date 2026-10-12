const { pool } = require("../db");
const uploadDir = require("../middleware/upload").dir;
const fs = require("fs");
const path = require("path");

const removeFiles = (urls = []) =>
  urls.forEach((u) => fs.unlink(path.join(uploadDir, path.basename(u)), () => {}))

const PAGE_SIZE = 50;

const ORDERS = {
  new: "o.created_at DESC, o.id DESC",
  cheap: "o.price ASC, o.id DESC",
  expensive: "o.price DESC, o.id DESC",
};

// Все активные, с пагинацией и фильтрами
exports.list = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const { q, from, to, min, max, sort } = req.query;

  const where = ["o.status = 'active'"];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (q && q.trim()) add("o.title ILIKE ?", `%${q.trim().replace(/[%_\\]/g, "\\$&")}%`);
  if (from) add("o.from_city = ?", from);
  if (to) add("o.to_city = ?", to);
  if (min !== undefined && min !== "" && !isNaN(min)) add("o.price >= ?", Number(min));
  if (max !== undefined && max !== "" && !isNaN(max)) add("o.price <= ?", Number(max));

  const order = ORDERS[sort] || ORDERS.new;

  params.push(PAGE_SIZE + 1, (page - 1) * PAGE_SIZE); // берём на 1 больше, чтобы понять, есть ли следующая страница
  const { rows } = await pool.query(
    `SELECT o.*, u.first_name, u.username
       FROM omonat o
       JOIN users u ON u.telegram_id = o.owner_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const hasMore = rows.length > PAGE_SIZE;
  res.json({ items: rows.slice(0, PAGE_SIZE), page, hasMore });
};

// Города для фильтров (раньше брались из загруженных объявлений)
exports.cities = async (req, res) => {
  const [from, to] = await Promise.all([
    pool.query("SELECT DISTINCT from_city AS c FROM omonat WHERE status = 'active' ORDER BY 1"),
    pool.query("SELECT DISTINCT to_city AS c FROM omonat WHERE status = 'active' ORDER BY 1"),
  ]);
  res.json({ from: from.rows.map((r) => r.c), to: to.rows.map((r) => r.c) });
};

// Объявления по списку id (для страницы "Сохранённые")
exports.byIds = async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map(Number)
    .filter(Number.isInteger)
    .slice(0, 200);

  if (ids.length === 0) return res.json({ items: [] });

  const { rows } = await pool.query(
    `SELECT o.*, u.first_name, u.username
       FROM omonat o
       JOIN users u ON u.telegram_id = o.owner_id
      WHERE o.id = ANY($1::bigint[]) AND o.status = 'active'
      ORDER BY o.created_at DESC`,
    [ids]
  );
  res.json({ items: rows });
};

// Одно объявление
exports.getOne = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, u.first_name, u.username
         FROM omonat o
         JOIN users u ON u.telegram_id = o.owner_id
        WHERE o.id = $1
          AND (o.status = 'active' OR o.owner_id = $2)`,
      [req.params.id, req.tgUser.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ item: rows[0] });
  } catch (e) {
    res.status(400).json({ error: "bad id" });
  }
};


// Мои
exports.mine = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM omonat WHERE owner_id = $1 ORDER BY created_at DESC`,
    [req.tgUser.id]
  );
  res.json({ items: rows });
};

exports.create = async (req, res) => {
  const files = req.files || [];
  const images = files.map((f) => `/uploads/${f.filename}`);
  const fail = (msg) => {
    removeFiles(images); // не оставляем мусор, если валидация не прошла
    return res.status(400).json({ error: msg });
  };
const { title, description, from_city, to_city, price } = req.body || {};
const t = String(title || "").trim();
const from = String(from_city || "").trim();
const to = String(to_city || "").trim();
const p = price === "" || price == null ? 0 : Number(price);

if (t.length < 3 || t.length > 100) return fail("Название: 3–100 символов");
if (!from || !to) return fail("Выбери города отправления и назначения");
if (from === to) return fail("Города должны быть разными");
if (!Number.isInteger(p) || p < 0) return fail("Неверная цена");

const { rows } = await pool.query(
`INSERT INTO omonat (owner_id, title, description, from_city, to_city, price, images)
VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
[req.tgUser.id, t, (description || "").trim() || null, from, to, p, images]
);
res.status(201).json({ item: rows[0] });
};

// Закрыть / открыть
exports.setStatus = async (req, res) => {
  const { status } = req.body || {};
  if (!["active", "closed"].includes(status)) return res.status(400).json({ error: "bad status" });

  const { rows } = await pool.query(
    `UPDATE omonat SET status = $1 WHERE id = $2 AND owner_id = $3 RETURNING *`,
    [status, req.params.id, req.tgUser.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "not found" });
  res.json({ item: rows[0] });
};

exports.remove = async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM omonat WHERE id = $1 AND owner_id = $2 RETURNING images`,
    [req.params.id, req.tgUser.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "not found" });
  removeFiles(rows[0].images);
  res.json({ ok: true });
};