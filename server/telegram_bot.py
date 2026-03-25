#!/usr/bin/env python3
"""Telegram bot for Smart Home login verification.

Environment variables:
  TELEGRAM_BOT_TOKEN   — token from @BotFather
  SMART_HOME_URL       — base URL of the app (e.g. https://your-domain.com)
  TELEGRAM_BOT_SECRET  — must match TELEGRAM_BOT_SECRET in app env (optional)
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
import urllib.parse

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
APP_URL = os.environ.get("SMART_HOME_URL", "http://localhost:3000").rstrip("/")
BOT_SECRET = os.environ.get("TELEGRAM_BOT_SECRET", "")

if not BOT_TOKEN:
    print("TELEGRAM_BOT_TOKEN is not set")
    sys.exit(1)

API = f"https://api.telegram.org/bot{BOT_TOKEN}"


def send_message(chat_id, text):
    data = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(
        f"{API}/sendMessage",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[Bot] Send error: {e}")


def verify_code(code, user):
    url = f"{APP_URL}/api/auth/telegram/callback"
    payload = json.dumps({
        "code": code,
        "telegram_user": user.get("first_name", "") + (" " + user["last_name"] if user.get("last_name") else ""),
        "telegram_id": user["id"],
    }).encode()

    headers = {"Content-Type": "application/json"}
    if BOT_SECRET:
        headers["Authorization"] = f"Bearer {BOT_SECRET}"

    req = urllib.request.Request(url, data=payload, headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        return result.get("success", False)
    except Exception as e:
        print(f"[Bot] Callback error: {e}")
        return False


def handle_message(msg):
    chat_id = msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    user = msg.get("from", {})

    if text == "/start":
        send_message(chat_id, "Привет! Отправь мне код с экрана входа в Умный дом.")
        return

    code = text.upper().replace(" ", "")
    if len(code) != 6 or not code.isalnum():
        send_message(chat_id, "Отправь 6-значный код с экрана входа.")
        return

    if verify_code(code, user):
        send_message(chat_id, "Вход выполнен. Можешь вернуться в браузер.")
    else:
        send_message(chat_id, "Код неверный или истёк. Попробуй ещё раз.")


def poll():
    offset = 0
    print("[TelegramBot] Starting...")
    print(f"[TelegramBot] App URL: {APP_URL}")

    while True:
        try:
            url = f"{API}/getUpdates?offset={offset}&timeout=30"
            resp = urllib.request.urlopen(url, timeout=35)
            data = json.loads(resp.read())

            if data.get("ok") and data.get("result"):
                for update in data["result"]:
                    offset = update["update_id"] + 1
                    if "message" in update:
                        handle_message(update["message"])
        except KeyboardInterrupt:
            print("\n[TelegramBot] Stopped.")
            break
        except Exception as e:
            print(f"[Bot] Poll error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    poll()
