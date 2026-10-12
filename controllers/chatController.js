const { pool } = require("../db");

const PAGE = 50;
const me = (req) => Number(req.tgUser.id);

// Находим диалог и проверяем, что пользователь в нём участвует
async function getConv(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM conversations
      WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
    [id, userId]
  );
  return rows[0] || null;
}

// Уведомление в Telegram (не ждём результата, ошибки игнорируем)
function notify(chatId, text) {
  fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: process.env.MINI_APP_URL
        ? { inline_keyboard: [[{ text: "Ochish", web_app: { url: process.env.MINI_APP_URL } }]] }
        : undefined,
    }),
  }).catch(() => {});
}

// курсор = "время|id" в base64url
const encodeCursor = (at, id) => Buffer.from(`${at}|${id}`).toString("base64url");
function decodeCursor(raw) {
  if (!raw) return [null, null];
  try {
    const [at, id] = Buffer.from(String(raw), "base64url").toString().split("|");
    return at && id ? [at, id] : [null, null];
  } catch {
    return [null, null];
  }
}

// Создать диалог по объявлению или вернуть существующий
exports.start = async (req, res) => {
  const omonatId = Number(req.body?.omonat_id);
  if (!Number.isInteger(omonatId)) return res.status(400).json({ error: "bad id" });

  const o = await pool.query("SELECT owner_id FROM omonat WHERE id = $1", [omonatId]);
  if (!o.rows[0]) return res.status(404).json({ error: "not found" });

  const sellerId = Number(o.rows[0].owner_id);
  if (sellerId === me(req)) return res.status(400).json({ error: "Bu sizni elonigiz!" });

  const { rows } = await pool.query(
    `INSERT INTO conversations (omonat_id, buyer_id, seller_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (omonat_id, buyer_id) DO UPDATE SET omonat_id = EXCLUDED.omonat_id
     RETURNING *`,
    [omonatId, me(req), sellerId]
  );
  res.json({ conversation: rows[0] });
};

// Мои диалоги по 50 штук. ?cursor=... отдаёт следующую порцию
exports.list = async (req, res) => {
  const [curAt, curId] = decodeCursor(req.query.cursor);

  const { rows } = await pool.query(
    `SELECT c.id, c.omonat_id, c.last_message_at,
            c.last_message_at::text AS cursor_at,
            o.title, o.images[1] AS photo,
            u.first_name, u.last_name, u.username,
            (SELECT text FROM messages m
              WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_text,
            (SELECT COUNT(*) FROM messages m
              WHERE m.conversation_id = c.id
                AND m.sender_id <> $1 AND m.read_at IS NULL)::int AS unread
       FROM conversations c
       JOIN omonat o ON o.id = c.omonat_id
       JOIN users u ON u.telegram_id = CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
      WHERE (c.buyer_id = $1 OR c.seller_id = $1)
        AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
        AND ($2::timestamptz IS NULL
             OR (c.last_message_at, c.id) < ($2::timestamptz, $3::bigint))
      ORDER BY c.last_message_at DESC, c.id DESC
      LIMIT $4`,
    [me(req), curAt, curId, PAGE + 1]
  );

  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const last = page[page.length - 1];

  res.json({
    items: page.map(({ cursor_at, ...rest }) => rest),
    next_cursor: hasMore && last ? encodeCursor(last.cursor_at, last.id) : null,
  });
};

// Сообщения диалога.
//   без параметров  → последние 50
//   ?before=ID      → 50 сообщений старше ID (подгрузка вверх)
//   ?after=ID       → только новые (для polling)
exports.messages = async (req, res) => {
  const conv = await getConv(req.params.id, me(req));
  if (!conv) return res.status(404).json({ error: "not found" });

  const after = Number(req.query.after) || 0;
  const before = Number(req.query.before) || 0;

  // помечаем чужие сообщения прочитанными (при подгрузке старых не нужно)
  if (!before) {
    await pool.query(
      `UPDATE messages SET read_at = NOW()
        WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
      [conv.id, me(req)]
    );
  }

  let rows;
  let hasMore = false;

  if (after) {
    // polling: всё новое по возрастанию
    ({ rows } = await pool.query(
      `SELECT id, sender_id, text, read_at, created_at
         FROM messages
        WHERE conversation_id = $1 AND id > $2
        ORDER BY id ASC
        LIMIT 200`,
      [conv.id, after]
    ));
  } else {
    // страница истории: берём на 1 больше, чтобы понять, есть ли ещё
    const r = await pool.query(
      `SELECT id, sender_id, text, read_at, created_at
         FROM messages
        WHERE conversation_id = $1 AND ($2::bigint = 0 OR id < $2)
        ORDER BY id DESC
        LIMIT $3`,
      [conv.id, before, PAGE + 1]
    );
    hasMore = r.rows.length > PAGE;
    rows = r.rows.slice(0, PAGE).reverse(); // отдаём по возрастанию
  }

  const items = rows.map((m) => ({
    ...m,
    sender_id: Number(m.sender_id),
    mine: Number(m.sender_id) === me(req),
  }));

  // подгрузка старых: инфо о диалоге не нужна
  if (before) return res.json({ items, has_more: hasMore });

  const otherId = Number(conv.buyer_id) === me(req) ? conv.seller_id : conv.buyer_id;
  const info = await pool.query(
    `SELECT o.title, o.images[1] AS photo, u.first_name, u.last_name, u.username
       FROM omonat o, users u
      WHERE o.id = $1 AND u.telegram_id = $2`,
    [conv.omonat_id, otherId]
  );

  res.json({
    items,
    has_more: hasMore,
    conversation: { id: conv.id, omonat_id: conv.omonat_id, ...info.rows[0] },
  });
};

// Отправить сообщение
exports.send = async (req, res) => {
  const conv = await getConv(req.params.id, me(req));
  if (!conv) return res.status(404).json({ error: "not found" });

  const text = String(req.body?.text || "").trim();
  if (!text || text.length > 1000) return res.status(400).json({ error: "Habar eng kami 1–1000 belgi bolishi kera." });

  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, text)
     VALUES ($1, $2, $3) RETURNING id, sender_id, text, read_at, created_at`,
    [conv.id, me(req), text]
  );
  await pool.query("UPDATE conversations SET last_message_at = NOW() WHERE id = $1", [conv.id]);

  const otherId = Number(conv.buyer_id) === me(req) ? conv.seller_id : conv.buyer_id;
  notify(otherId, `💬 Yangi habar:\n${text.slice(0, 200)}`);

  res.status(201).json({
    item: { ...rows[0], sender_id: Number(rows[0].sender_id), mine: true },
  });
};

// Общее число непрочитанных (для бейджа на вкладке)
exports.unread = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.buyer_id = $1 OR c.seller_id = $1)
        AND m.sender_id <> $1 AND m.read_at IS NULL`,
    [me(req)]
  );
  res.json({ unread: rows[0].n });
};
