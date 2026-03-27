// In-memory store for auth codes (demo purposes)
// In production, use Redis or a database

interface AuthCode {
  code: string;
  verified: boolean;
  telegramUsername?: string;
  telegramId?: number;
  createdAt: number;
}

const AUTH_CODES = new Map<string, AuthCode>();
const CODE_TTL = 5 * 60 * 1000; // 5 minutes

export function generateAuthCode(): string {
  // Clean expired codes
  const now = Date.now();
  for (const [key, value] of AUTH_CODES.entries()) {
    if (now - value.createdAt > CODE_TTL) {
      AUTH_CODES.delete(key);
    }
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  AUTH_CODES.set(code, {
    code,
    verified: false,
    createdAt: Date.now(),
  });
  return code;
}

export function verifyAuthCode(code: string, telegramUsername?: string, telegramId?: number): boolean {
  const entry = AUTH_CODES.get(code);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > CODE_TTL) {
    AUTH_CODES.delete(code);
    return false;
  }
  entry.verified = true;
  entry.telegramUsername = telegramUsername;
  entry.telegramId = telegramId;
  return true;
}

export function checkAuthCode(code: string): { verified: boolean; telegramUsername?: string; telegramId?: number } {
  const entry = AUTH_CODES.get(code);
  if (!entry) return { verified: false };
  if (Date.now() - entry.createdAt > CODE_TTL) {
    AUTH_CODES.delete(code);
    return { verified: false };
  }
  return { verified: entry.verified, telegramUsername: entry.telegramUsername, telegramId: entry.telegramId };
}
