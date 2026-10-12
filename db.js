const path = require("path");
const fs = require('fs')
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            telegram_id   BIGINT PRIMARY KEY,
            first_name    TEXT,
            last_name     TEXT,
            username      TEXT,
            language_code TEXT,
            created_at    TIMESTAMPTZ DEFAULT NOW(),
            last_start_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    const sql = fs.readFileSync(path.join(__dirname, "schema/omonat.sql"), "utf8");
    await pool.query(sql);
}

async function saveUser(u) {
    // first_name/last_name из Telegram пишем только при первом создании,
    // потом их перезаписывает регистрация в боте
    await pool.query(
        `INSERT INTO users (telegram_id, first_name, last_name, username, language_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (telegram_id) DO UPDATE SET
            username      = EXCLUDED.username,
            language_code = EXCLUDED.language_code,
            last_start_at = NOW()`,
        [u.id, u.first_name || null, u.last_name || null, u.username || null, u.language_code || null]
    );
}

async function getUser(telegramId) {
    const { rows } = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [telegramId]);
    return rows[0] || null;
}

module.exports = { pool, initDb, saveUser, getUser };