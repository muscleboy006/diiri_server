const TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

async function notifyAdmin(text) {
  if (!ADMIN_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      console.error("Telegram notify failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Telegram notify error:", err.message);
  }
}

module.exports = { notifyAdmin };