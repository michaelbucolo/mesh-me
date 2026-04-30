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
const loginAttempts = new Map<string, { count: number; lockCount: number; lockedUntil: number | null }>();

export function checkAccountLockout(email: string): { locked: boolean; lockedUntilMs: number } {
  const entry = loginAttempts.get(email);
  if (!entry) return { locked: false, lockedUntilMs: 0 };

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, lockedUntilMs: entry.lockedUntil - Date.now() };
  }

  // Lockout expired — reset count for next cycle but keep lockCount for escalation
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    entry.lockedUntil = null;
    entry.count = 0;
    loginAttempts.set(email, entry);
    return { locked: false, lockedUntilMs: 0 };
  }

  return { locked: false, lockedUntilMs: 0 };
}

// Escalating lockout durations: 15min, 30min, 1hr, 24hr
const LOCKOUT_DURATIONS = [
  15 * 60 * 1000,      // 15 minutes
  30 * 60 * 1000,      // 30 minutes
  60 * 60 * 1000,      // 1 hour
  24 * 60 * 60 * 1000, // 24 hours
];

export function recordFailedLogin(email: string): void {
  const entry = loginAttempts.get(email) || { count: 0, lockCount: 0, lockedUntil: null };
  entry.count++;

  // Lock after 5 failed attempts with escalating duration
  if (entry.count >= 5) {
    const durationIndex = Math.min(entry.lockCount, LOCKOUT_DURATIONS.length - 1);
    entry.lockedUntil = Date.now() + LOCKOUT_DURATIONS[durationIndex];
    entry.lockCount++;
    // Don't reset count — it resets when lockout expires in checkAccountLockout
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
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "accelerometer=(), autoplay=(), bluetooth=(), browsing-topics=(), camera=(), clipboard-read=(), display-capture=(), encrypted-media=(), geolocation=(), gyroscope=(), hid=(), interest-cohort=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(self), screen-wake-lock=(), serial=(), sync-xhr=(), usb=(), xr-spatial-tracking=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Permitted-Cross-Domain-Policies": "none",
};
