// Telegram login code store + session management

interface TelegramLoginEntry {
  code: string;
  verified: boolean;
  telegramUser?: string;
  telegramId?: number;
  createdAt: number;
}

const telegramCodeStore = new Map<string, TelegramLoginEntry>();
const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function generateLoginCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createTelegramLogin(): { code: string } {
  // Clean up expired codes
  const now = Date.now();
  for (const [key, entry] of telegramCodeStore.entries()) {
    if (now - entry.createdAt > CODE_EXPIRY_MS) {
      telegramCodeStore.delete(key);
    }
  }

  const code = generateLoginCode();
  telegramCodeStore.set(code, {
    code,
    verified: false,
    createdAt: Date.now(),
  });
  return { code };
}

export function verifyTelegramCode(
  code: string,
  telegramUser: string,
  telegramId: number
): boolean {
  const entry = telegramCodeStore.get(code.toUpperCase());
  if (!entry) return false;
  if (Date.now() - entry.createdAt > CODE_EXPIRY_MS) {
    telegramCodeStore.delete(code.toUpperCase());
    return false;
  }
  entry.verified = true;
  entry.telegramUser = telegramUser;
  entry.telegramId = telegramId;
  return true;
}

export function checkTelegramCode(code: string): {
  verified: boolean;
  telegramUser?: string;
  expired?: boolean;
} {
  const entry = telegramCodeStore.get(code.toUpperCase());
  if (!entry) return { verified: false, expired: true };
  if (Date.now() - entry.createdAt > CODE_EXPIRY_MS) {
    telegramCodeStore.delete(code.toUpperCase());
    return { verified: false, expired: true };
  }
  if (entry.verified) {
    telegramCodeStore.delete(code.toUpperCase());
    return { verified: true, telegramUser: entry.telegramUser };
  }
  return { verified: false };
}

// Session token generation
export function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simple session store
const sessionStore = new Map<string, { user: string; isGuest: boolean; createdAt: number }>();

export function createSession(user: string, isGuest: boolean): string {
  const token = generateSessionToken();
  sessionStore.set(token, {
    user,
    isGuest,
    createdAt: Date.now(),
  });
  return token;
}

export function validateSession(token: string): { valid: boolean; user?: string; isGuest?: boolean } {
  const session = sessionStore.get(token);
  if (!session) {
    return { valid: false };
  }
  return { valid: true, user: session.user, isGuest: session.isGuest };
}

export function destroySession(token: string): void {
  sessionStore.delete(token);
}
