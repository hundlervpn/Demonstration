// Telegram bot for Smart Home login verification
// Uses only built-in Node.js fetch (Node 18+)
//
// Environment variables:
//   TELEGRAM_BOT_TOKEN  — token from @BotFather
//   SMART_HOME_URL      — base URL of the app (e.g. https://your-domain.com)
//   TELEGRAM_BOT_SECRET — must match TELEGRAM_BOT_SECRET in .env (optional)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = (process.env.SMART_HOME_URL || "http://localhost:3000").replace(/\/$/, "");
const BOT_SECRET = process.env.TELEGRAM_BOT_SECRET || "";

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
let offset = 0;

async function sendMessage(chatId, text, opts = {}) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...opts }),
  });
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  const user = msg.from;

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Привет! Отправь мне код с экрана входа в Умный дом."
    );
    return;
  }

  // Expect a 6-character code
  const code = text.toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    await sendMessage(chatId, "Отправь 6-значный код с экрана входа.");
    return;
  }

  try {
    const headers = { "Content-Type": "application/json" };
    if (BOT_SECRET) {
      headers["Authorization"] = `Bearer ${BOT_SECRET}`;
    }

    const res = await fetch(`${APP_URL}/api/auth/telegram/callback`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code,
        telegram_user: user.first_name + (user.last_name ? ` ${user.last_name}` : ""),
        telegram_id: user.id,
      }),
    });

    const data = await res.json();

    if (data.success) {
      await sendMessage(chatId, "Вход выполнен. Можешь вернуться в браузер.");
    } else {
      await sendMessage(chatId, "Код неверный или истёк. Попробуй ещё раз.");
    }
  } catch (err) {
    console.error("Callback error:", err.message);
    await sendMessage(chatId, "Ошибка связи с сервером. Попробуй позже.");
  }
}

async function poll() {
  while (true) {
    try {
      const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message) {
            await handleMessage(update.message);
          }
        }
      }
    } catch (err) {
      console.error("Poll error:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

console.log("[TelegramBot] Starting...");
console.log(`[TelegramBot] App URL: ${APP_URL}`);
poll();
