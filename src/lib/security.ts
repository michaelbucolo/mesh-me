// ─── Security Utilities for mesh.me ─────────────────────────

// ─── Rate Limiter (in-memory, per-IP) ───────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remainingAttempts: number; resetIn: number } {
  // Lazily clean up expired entries on each call
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remainingAttempts: maxAttempts - 1, resetIn: windowMs };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remainingAttempts: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remainingAttempts: maxAttempts - entry.count, resetIn: entry.resetAt - now };
}

// Clean up expired entries lazily during rate limit checks
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Account lockout moved to durable-rate-limit.ts (cross-instance, DB-backed) —
// the in-memory version reset on every serverless cold start.

// ─── Input Sanitization ─────────────────────────────────────

export function sanitizeForDisplay(input: string): string {
  // React auto-escapes JSX output, so aggressive regex sanitization is unnecessary
  // and would corrupt legitimate user content (e.g. "one = two", "javascript:" discussions).
  // We only trim whitespace here. XSS prevention is handled by React's rendering layer.
  return input.trim();
}

// ─── Content Validation ─────────────────────────────────────
export function validatePostContent(content: string): { valid: boolean; error?: string } {
  if (!content || !content.trim()) {
    return { valid: false, error: "Content cannot be empty" };
  }
  if (content.length > 500) {
    return { valid: false, error: "Content exceeds maximum length of 500 characters" };
  }
  return { valid: true };
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters" };
  }
  if (password.length > 128) {
    return { valid: false, error: "Password is too long" };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must include uppercase, lowercase, number, and symbol characters" };
  }
  const normalized = password.toLowerCase();
  const weakFragments = ["password", "meshme", "qwerty", "letmein", "admin", "welcome", "123456"];
  if (weakFragments.some((fragment) => normalized.includes(fragment))) {
    return { valid: false, error: "Password contains a common weak phrase" };
  }
  return { valid: true };
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ─── Security Headers ───────────────────────────────────────
