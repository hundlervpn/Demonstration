const TELEGRAM_API_BASE = "https://api.telegram.org";

export async function sendTelegramMessage(
  message: string,
  chatId?: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId ?? process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN is not set — skipping alert");
    return;
  }

  if (!targetChatId) {
    console.warn("[Telegram] TELEGRAM_CHAT_ID is not set — skipping alert");
    return;
  }

  try {
    const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChatId, text: message }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[Telegram] Failed to send message: ${response.status} ${body}`,
      );
    }
  } catch (error) {
    console.error("[Telegram] Error sending message:", error);
  }
}

export async function sendAlert(
  type: "gas" | "water_leak" | "unknown_face",
  details?: string,
): Promise<void> {
  let message: string;

  switch (type) {
    case "gas":
      message = details
        ? `Внимание! Обнаружена утечка газа. ${details}`
        : "Внимание! Обнаружена утечка газа.";
      break;
    case "water_leak":
      message = details
        ? `Внимание! Обнаружена утечка воды. ${details}`
        : "Внимание! Обнаружена утечка воды.";
      break;
    case "unknown_face":
      message = details
        ? `Внимание! Обнаружено неизвестное лицо. ${details}`
        : "Внимание! Обнаружено неизвестное лицо.";
      break;
    default:
      message = details ? `Уведомление: ${details}` : "Уведомление от умного дома.";
  }

  await sendTelegramMessage(message);
}
