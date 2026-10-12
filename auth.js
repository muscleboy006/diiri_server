const crypto = require("crypto");

// Проверяет подпись initData от Telegram. Возвращает объект user или null.
function validateInitData(initData, botToken) {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");

    const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
    if (calculated !== hash) return null;

    const age = Date.now() / 1000 - Number(params.get("auth_date"));
    if (age > 86400) return null;

    try {
        return JSON.parse(params.get("user"));
    } catch {
        return null;
    }
}

module.exports = { validateInitData };