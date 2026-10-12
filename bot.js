const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Bot, InlineKeyboard } = require("grammy");
const { initDb, saveUser } = require("./db");

const TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL;

if (!TOKEN || !MINI_APP_URL || !process.env.DATABASE_URL) {
    console.error("Заполни BOT_TOKEN, MINI_APP_URL и DATABASE_URL в .env");
    process.exit(1);
}

const bot = new Bot(TOKEN);

bot.command("start", async (ctx) => {
    try {
        await saveUser(ctx.from);
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