// In-memory OTP store for email authentication
// In production, use Redis or a database

interface OTPEntry {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OTPEntry>();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOtpCode(code: string): string {
  return code.trim();
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOTP(email: string, code: string): void {
  const normalizedEmail = normalizeEmail(email);
  otpStore.set(normalizedEmail, {
    code: normalizeOtpCode(code),
    email: normalizedEmail,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });
}

export function verifyOTP(email: string, code: string): { valid: boolean; error?: string } {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = normalizeOtpCode(code);
  const entry = otpStore.get(normalizedEmail);

  if (!entry) {
    return { valid: false, error: "Код не найден. Запросите новый." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: "Код истёк. Запросите новый." };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: "Слишком много попыток. Запросите новый код." };
  }

  entry.attempts++;

  if (entry.code !== normalizedCode) {
    return { valid: false, error: "Неверный код." };
  }

  // Valid — clean up
  otpStore.delete(normalizedEmail);
  return { valid: true };
}

// Session token generation
export function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simple session store
const sessionStore = new Map<string, { email: string; isGuest: boolean; createdAt: number }>();

export function createSession(email: string, isGuest: boolean): string {
  const token = generateSessionToken();
  sessionStore.set(token, {
    email,
    isGuest,
    createdAt: Date.now(),
  });
  return token;
}

export function validateSession(token: string): { valid: boolean; email?: string; isGuest?: boolean } {
  const session = sessionStore.get(token);
  if (!session) {
    return { valid: false };
  }
  return { valid: true, email: session.email, isGuest: session.isGuest };
}

export function destroySession(token: string): void {
  sessionStore.delete(token);
}
