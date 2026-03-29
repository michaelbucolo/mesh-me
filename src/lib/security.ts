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

// ─── Account Lockout ────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

export function checkAccountLockout(email: string): { locked: boolean; lockedUntilMs: number } {
  const entry = loginAttempts.get(email);
  if (!entry) return { locked: false, lockedUntilMs: 0 };

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, lockedUntilMs: entry.lockedUntil - Date.now() };
  }

  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(email);
    return { locked: false, lockedUntilMs: 0 };
  }

  return { locked: false, lockedUntilMs: 0 };
}

export function recordFailedLogin(email: string): void {
  const entry = loginAttempts.get(email) || { count: 0, lockedUntil: null };
  entry.count++;

  // Lock after 5 failed attempts for 15 minutes
  if (entry.count >= 5) {
    entry.lockedUntil = Date.now() + 15 * 60 * 1000;
    entry.count = 0;
  }

  loginAttempts.set(email, entry);
}

export function clearFailedLogins(email: string): void {
  loginAttempts.delete(email);
}

// ─── Input Sanitization ─────────────────────────────────────
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

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
  if (content.length > 5000) {
    return { valid: false, error: "Content exceeds maximum length of 5000 characters" };
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
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
