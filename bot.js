// const path = require("path");
// require("dotenv").config({ path: path.join(__dirname, ".env") });
// const { Bot, InlineKeyboard } = require("grammy");
// const { initDb, saveUser } = require("./db");

// const TOKEN = process.env.BOT_TOKEN;
// const MINI_APP_URL = process.env.MINI_APP_URL;

// if (!TOKEN || !MINI_APP_URL || !process.env.DATABASE_URL) {
//     console.error("Заполни BOT_TOKEN, MINI_APP_URL и DATABASE_URL в .env");
//     process.exit(1);
// }

// const bot = new Bot(TOKEN);

// bot.command("start", async (ctx) => {
//     try {
//         await saveUser(ctx.from);
//     } catch (e) {
//         console.error("Foydalanuvchini saqlab bolmadi.", e);
//     }

//     const keyboard = new InlineKeyboard().webApp("🚀 Ilovani ochish", MINI_APP_URL);
//     await ctx.reply("Salom! 👋\nPastdagi tugmani bosing!", { reply_markup: keyboard });
// });

// bot.catch((err) => console.error("Xato:", err.error));

// (async () => {
//     await initDb();
//     bot.start({ onStart: (info) => console.log(`Bot @${info.username} is running...`) });
// })();

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Bot, InlineKeyboard } = require("grammy");
const { initDb, saveUser } = require("./db");

const TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!TOKEN || !MINI_APP_URL || !process.env.DATABASE_URL) {
    console.error("Заполни BOT_TOKEN, MINI_APP_URL и DATABASE_URL в .env");
    process.exit(1);
}

if (!ADMIN_CHAT_ID) {
    console.warn("ADMIN_CHAT_ID не задан, уведомления о новых пользователях отключены");
}

const bot = new Bot(TOKEN);

const escapeHtml = (s = "") =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function notifyNewUser(from) {
    if (!ADMIN_CHAT_ID) return;
    try {
        await bot.api.sendMessage(
            ADMIN_CHAT_ID,
            `🆕 Новый пользователь\n` +
            `Имя: ${escapeHtml(from.first_name)}\n` +
            `Username: @${escapeHtml(from.username ?? "нет")}\n` +
            `ID: <code>${from.id}</code>`,
            { parse_mode: "HTML" }
        );
    } catch (e) {
        console.error("Admin notify failed:", e.description ?? e.message);
    }
}

bot.command("start", async (ctx) => {
    try {
        const isNew = await saveUser(ctx.from);
        if (isNew) {
            // без await, чтобы не задерживать ответ пользователю
            notifyNewUser(ctx.from);
        }
    } catch (e) {
        console.error("Foydalanuvchini saqlab bolmadi.", e);
    }

    const keyboard = new InlineKeyboard().webApp("🚀 Ilovani ochish", MINI_APP_URL);
    await ctx.reply("Salom! 👋\nPastdagi tugmani bosing!", { reply_markup: keyboard });
});

bot.catch((err) => console.error("Xato:", err.error));

(async () => {
    await initDb();
    bot.start({ onStart: (info) => console.log(`Bot @${info.username} is running...`) });
})();