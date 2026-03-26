import os
import logging
import requests
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
BOT_SECRET = os.environ.get("TELEGRAM_BOT_SECRET", "mySecretKey123")
APP_URL = os.environ.get("APP_URL", "https://hundlervpn-demonstration-ea0a.twc1.net")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Привет! Я бот авторизации для Умного дома.\n\n"
        "Отправьте мне код, который отображается на странице входа."
    )


async def handle_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip().upper()
    username = update.effective_user.username or update.effective_user.first_name or "user"

    if not text or len(text) < 4 or len(text) > 10:
        await update.message.reply_text("Отправьте код со страницы входа (например: ABC123)")
        return

    verify_url = f"{APP_URL.rstrip('/')}/api/auth/verify"
    logger.info(f"Verifying code '{text}' for user @{username} at {verify_url}")

    try:
        resp = requests.post(
            verify_url,
            json={"code": text, "secret": BOT_SECRET, "username": username},
            timeout=10,
        )
        logger.info(f"Response: {resp.status_code} {resp.text}")

        if resp.status_code == 200:
            await update.message.reply_text(f"Код принят! Авторизация успешна, {username}.")
        elif resp.status_code == 404:
            await update.message.reply_text(
                "Код неверный или истёк.\n"
                "Убедитесь, что вы отправляете актуальный код со страницы входа."
            )
        elif resp.status_code == 401:
            await update.message.reply_text("Ошибка конфигурации бота (неверный секрет).")
            logger.error("Bot secret mismatch!")
        else:
            await update.message.reply_text(f"Ошибка сервера: {resp.status_code}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {e}")
        await update.message.reply_text("Не удалось связаться с сервером. Попробуйте позже.")


def main():
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set!")
        return

    logger.info(f"Starting bot, APP_URL={APP_URL}")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_code))
    app.run_polling()


if __name__ == "__main__":
    main()
