"use server";

import { prisma } from "./prisma";
import { getCurrentUser, hashPassword, createSession, destroySession, verifyPassword, invalidateAllUserSessions } from "./auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { slugify } from "./utils";
import { getBaseUrl, isSupportedPlatform } from "./oauth";
import { FREE_MESHI_OPTIONS, isFreeMeshiOption } from "./mesh-pro";
import { clearMeshCache } from "./mesh-cache";
import { rateLimit, checkAccountLockout, recordFailedLogin, clearFailedLogins, sanitizeForDisplay, validatePasswordStrength, validatePostContent, validateUrl } from "./security";
import { classifyContentSafety, getNsfwPolicyForRegion, isAdultVerificationActive, normalizeUsState, nsfwHiddenWhere } from "./content-safety";
import { communityThreadTitle } from "./community-constants";

async function hashAuthTokenValue(token: string) {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] || character);
}

async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const safeResetUrl = escapeEmailHtml(resetUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Reset your Mesh.me password",
      text: `Use this secure link to reset your Mesh.me password. The link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a">
          <h1 style="font-size:22px;margin:0 0 12px">Reset your Mesh.me password</h1>
          <p>Use this secure link to reset your password. The link expires in 1 hour.</p>
          <p><a href="${safeResetUrl}" style="display:inline-block;border-radius:999px;background:#2563eb;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">Reset password</a></p>
          <p style="font-size:13px;color:#64748b">If you did not request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error("Password reset email failed", await response.text().catch(() => response.statusText));
    return false;
  }

  return true;
}

async function sendEmailVerificationEmail(to: string, verificationUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_VERIFICATION_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || process.env.PASSWORD_RESET_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const safeVerificationUrl = escapeEmailHtml(verificationUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Verify your Mesh.me email",
      text: `Verify this email address for your Mesh.me account. The link expires in 24 hours.\n\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`,
      html: `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a">
          <h1 style="font-size:22px;margin:0 0 12px">Verify your Mesh.me email</h1>
          <p>Confirm this email address for your Mesh.me account. The link expires in 24 hours.</p>
          <p><a href="${safeVerificationUrl}" style="display:inline-block;border-radius:999px;background:#2563eb;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">Verify email</a></p>
          <p style="font-size:13px;color:#64748b">If you did not create this account, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error("Email verification delivery failed", await response.text().catch(() => response.statusText));
    return false;
  }

  return true;
}

async function issueEmailVerificationToken(userId: string, email: string) {
  const crypto = await import("crypto");
  const normalizedEmail = email.trim().toLowerCase();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = await hashAuthTokenValue(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: {
        userId,
        email: normalizedEmail,
        consumedAt: null,
      },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        email: normalizedEmail,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return {
    token,
    verificationUrl: `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`,
  };
}

function getSafePostLoginPath(value: FormDataEntryValue | string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  try {
    const parsed = new URL(trimmed, "https://mesh.me");
    if (parsed.origin !== "https://mesh.me") return null;
    if (parsed.pathname === "/login" || parsed.pathname === "/signup" || parsed.pathname === "/reset-password") {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

// ─── Auth Actions ────────────────────────────────────────────

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function normalizeUsernameSuggestion(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const fallback = base || "mesh_user";
  return fallback.length < 3 ? `${fallback}_me` : fallback.slice(0, 24);
}

function isAccountStorageUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /HTTP status 401|SERVER_ERROR|Unauthorized|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message);
}

function accountStorageUnavailableMessage() {
  return "Mesh.me can't reach secure account storage right now. Please try again shortly.";
}

export async function resolveEntryIdentity(rawIdentifier: string) {
  const identifier = rawIdentifier.trim();
  if (!identifier) return { error: "Enter your username, email, or phone number." };

  const lowered = identifier.toLowerCase();
  const normalizedPhone = normalizePhone(identifier);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowered);
  const isPhone = normalizedPhone.length >= 7 && !lowered.includes("@");
  const identifierKey = isPhone ? normalizedPhone : lowered;

  const rl = rateLimit(`entry-identity:${identifierKey}`, 12, 15 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  try {
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: lowered },
          { username: lowered },
        ],
      },
      select: { id: true },
    });

    if (!user && isEmail) {
      const emailRecord = await prisma.userEmail.findUnique({
        where: { email: lowered },
        select: { userId: true, isVerified: true },
      });
      if (emailRecord && !emailRecord.isVerified) {
        return { error: "This email isn't verified yet. Sign in with your username and password first, then verify it in Settings." };
      }
      user = emailRecord ? { id: emailRecord.userId } : null;
    }

    if (!user && isPhone) {
      const phoneRecord = await prisma.userPhone.findFirst({
        where: { phone: { in: Array.from(new Set([normalizedPhone, identifier])) } },
        select: { userId: true, isVerified: true },
      });
      if (phoneRecord && !phoneRecord.isVerified) {
        return { error: "This phone number isn't verified yet. Sign in with your username and password first, then verify it in Settings." };
      }
      user = phoneRecord ? { id: phoneRecord.userId } : null;
    }

    if (user) {
      return { mode: "sign-in" as const, identifier };
    }
  } catch (error) {
    if (isAccountStorageUnavailable(error)) {
      return { error: accountStorageUnavailableMessage() };
    }
    throw error;
  }

  return {
    mode: "sign-up" as const,
    identifier,
    prefill: {
      email: isEmail ? lowered : "",
      username: isEmail ? normalizeUsernameSuggestion(lowered) : isPhone ? "" : normalizeUsernameSuggestion(lowered),
      phone: isPhone ? normalizedPhone : "",
    },
  };
}

export async function signUp(formData: FormData) {
  const rawEmail = formData.get("email") as string;
  const password = formData.get("password") as string;
  const rawUsername = formData.get("username") as string;
  const rawDisplayName = formData.get("displayName") as string;
  const rawPhone = formData.get("phone") as string | null;

  if (!rawEmail || !password || !rawUsername || !rawDisplayName) {
    return { error: "All fields are required" };
  }

  // Rate limit signups
  const rl = rateLimit(`signup:${rawEmail.trim().toLowerCase()}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many signup attempts. Please try again later." };
  }

  // Sanitize inputs
  const email = rawEmail.trim().toLowerCase();
  const username = rawUsername.trim().toLowerCase();
  const displayName = rawDisplayName.trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : "";

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) return { error: passwordValidation.error };

  if (phone && phone.length < 7) {
    return { error: "Please enter a valid phone number" };
  }

  // Validate username format and length
  if (username.length < 3 || username.length > 30) {
    return { error: "Username must be between 3 and 30 characters" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: "Username can only contain letters, numbers, and underscores" };
  }

  // Validate display name length
  if (displayName.length < 1 || displayName.length > 50) {
    return { error: "Display name must be between 1 and 50 characters" };
  }

  let existing;
  try {
    existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
  } catch (error) {
    if (isAccountStorageUnavailable(error)) {
      return { error: accountStorageUnavailableMessage() };
    }
    throw error;
  }

  if (existing) {
    return { error: existing.email === email ? "Email already in use" : "Username already taken" };
  }

  if (phone) {
    let existingPhone;
    try {
      existingPhone = await prisma.userPhone.findUnique({ where: { phone } });
    } catch (error) {
      if (isAccountStorageUnavailable(error)) {
        return { error: accountStorageUnavailableMessage() };
      }
      throw error;
    }
    if (existingPhone) return { error: "Phone already in use" };
  }

  const passwordHash = await hashPassword(password);

  let userId: string | null = null;
  try {
    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        isPublic: false,
        // Findable by default (you can appear as a suggestion and approve
        // followers) while your content stays private via isPublic. Users can
        // opt out of discovery in settings.
        showInDiscovery: true,
        hideActivityStatus: true,
        readReceipts: false,
        nsfwEnabled: false,
        adultVerificationStatus: "unverified",
        emails: {
          create: {
            email,
            isPrimary: true,
            isVerified: false,
          },
        },
        meshPrivacy: {
          create: {
            meshVisibility: "private",
            showConnections: false,
            showStats: false,
          },
        },
        phones: phone ? {
          create: {
            phone,
            isPrimary: true,
            isVerified: false,
          },
        } : undefined,
      },
    });
    userId = user.id;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "Email, username, or phone already taken" };
    }
    if (isAccountStorageUnavailable(e)) {
      return { error: accountStorageUnavailableMessage() };
    }
    throw e;
  }

  try {
    const { verificationUrl } = await issueEmailVerificationToken(userId, email);
    await sendEmailVerificationEmail(email, verificationUrl);
  } catch (error) {
    console.error("Email verification setup failed", error);
  }

  // Create session and redirect OUTSIDE try/catch
  // (Next.js redirect throws internally and must not be caught)
  await createSession(userId);
  redirect("/onboarding");
}

async function completeSignIn(formData: FormData, options: { createSessionCookie?: boolean } = {}) {
  const shouldCreateSession = options.createSessionCookie ?? true;
  const rawIdentifier = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nextPath = getSafePostLoginPath(formData.get("next"));

  if (!rawIdentifier || !password) {
    return { error: "Identity and password are required" };
  }

  const identifier = rawIdentifier.trim();
  const email = identifier.toLowerCase();
  const normalizedPhone = identifier.replace(/[^\d+]/g, "");
  const identifierKey = normalizedPhone.length >= 7 && !email.includes("@") ? normalizedPhone : email;

  // Pre-lookup rate limit to prevent DB spam from automated scanners
  const preRl = rateLimit(`login-input:${identifierKey}`, 10, 15 * 60 * 1000);
  if (!preRl.allowed) {
    return { error: "Too many login attempts. Please try again later." };
  }

  let user;
  let unverifiedIdentifier = false;
  try {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: email },
        ],
      },
    });

    if (!user && email.includes("@")) {
      const emailRecord = await prisma.userEmail.findUnique({
        where: { email },
        include: { user: true },
      });
      if (emailRecord && !emailRecord.isVerified) {
        unverifiedIdentifier = true;
        user = null;
      } else {
        user = emailRecord?.user ?? null;
      }
    }

    if (!user && normalizedPhone.length >= 7) {
      const phoneCandidates = Array.from(new Set([normalizedPhone, identifier]));
      const phoneRecord = await prisma.userPhone.findFirst({
        where: {
          phone: { in: phoneCandidates },
        },
        include: { user: true },
      });
      if (phoneRecord && !phoneRecord.isVerified) {
        unverifiedIdentifier = true;
        user = null;
      } else {
        user = phoneRecord?.user ?? null;
      }
    }
  } catch (error) {
    if (isAccountStorageUnavailable(error)) {
      return { error: accountStorageUnavailableMessage() };
    }
    throw error;
  }

  // Key lockout by resolved user ID to prevent bypass via alternative identifiers
  const lockoutKey = user ? user.id : identifierKey;

  // Post-lookup rate limit keyed by user ID — prevents bypass via email/username alternation
  if (user) {
    const userRl = rateLimit(`login-user:${user.id}`, 10, 15 * 60 * 1000);
    if (!userRl.allowed) {
      return { error: "Too many login attempts. Please try again later." };
    }
  }

  // Check account lockout
  const lockout = checkAccountLockout(lockoutKey);
  if (lockout.locked) {
    const minutes = Math.ceil(lockout.lockedUntilMs / 60000);
    return { error: `Account temporarily locked. Try again in ${minutes} minutes.` };
  }

  if (!user) {
    if (!unverifiedIdentifier) {
      recordFailedLogin(lockoutKey);
    }
    return { error: "Invalid email or password" };
  }

  // Check suspension — return generic error to prevent user enumeration,
  // but do NOT record a failed login (this isn't a credential failure,
  // and recording it would let attackers build lockout state for the real user)
  if (user.isSuspended) {
    return { error: "Invalid email or password" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    recordFailedLogin(user.id);
    return { error: "Invalid email or password" };
  }

  // Clear lockout state for both user.id and the raw email/username input
  // to avoid stale entries from pre-lookup failed attempts
  clearFailedLogins(user.id);
  clearFailedLogins(identifierKey);
  if (shouldCreateSession) {
    await createSession(user.id);
  }

  return { success: true, redirectTo: user.onboarded ? (nextPath || "/mesh") : "/onboarding" };
}

export async function signInForEntry(formData: FormData) {
  return completeSignIn(formData, { createSessionCookie: true });
}

export async function signIn(formData: FormData) {
  const result = await completeSignIn(formData);
  if ("error" in result) return result;
  redirect(result.redirectTo);
}

export async function signOut() {
  await destroySession();
  redirect("/login?signedOut=1");
}

// ─── Password Reset ─────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const rl = rateLimit(`reset:${normalizedEmail}`, 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many reset requests. Please try again later." };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Always return success to prevent email enumeration
  if (!user) return { success: true };

  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = await hashAuthTokenValue(token);
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: tokenHash, resetTokenExpiry: expiry },
  });

  const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  await sendPasswordResetEmail(normalizedEmail, resetUrl);

  // In development, return the link to speed up local/staging testing.
  if (process.env.NODE_ENV !== "production") {
    return { success: true, resetUrl };
  }

  return { success: true };
}

export async function requestEmailVerification(formData?: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const rawEmail = formData?.get("email");
  const normalizedEmail = (typeof rawEmail === "string" && rawEmail.trim() ? rawEmail : user.email).trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: "Please enter a valid email address" };
  }

  const rl = rateLimit(`email-verification:${user.id}:${normalizedEmail}`, 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many verification emails requested. Please try again later." };
  }

  if (normalizedEmail === user.email.toLowerCase() && user.emailVerified) {
    return { success: true, alreadyVerified: true };
  }

  if (normalizedEmail !== user.email.toLowerCase()) {
    const emailRecord = await prisma.userEmail.findUnique({ where: { email: normalizedEmail } });
    if (!emailRecord || emailRecord.userId !== user.id) {
      return { error: "That email is not connected to your account." };
    }
    if (emailRecord.isVerified) return { success: true, alreadyVerified: true };
  }

  const { verificationUrl } = await issueEmailVerificationToken(user.id, normalizedEmail);
  await sendEmailVerificationEmail(normalizedEmail, verificationUrl);

  if (process.env.NODE_ENV !== "production") {
    return { success: true, verificationUrl };
  }

  return { success: true };
}

export async function verifyEmailToken(token: string) {
  const trimmedToken = token.trim();
  if (!trimmedToken || trimmedToken.length < 32) {
    return { error: "Invalid verification link. Please request a new one." };
  }

  const rl = rateLimit(`email-token:${trimmedToken.slice(0, 16)}`, 8, 15 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many verification attempts. Please try again later." };
  }

  const tokenHash = await hashAuthTokenValue(trimmedToken);
  const verificationToken = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!verificationToken) {
    return { error: "Invalid or expired verification link. Please request a new one." };
  }

  const normalizedEmail = verificationToken.email.trim().toLowerCase();
  const isPrimaryEmail = verificationToken.user.email.toLowerCase() === normalizedEmail;
  const existingEmailRecord = await prisma.userEmail.findUnique({ where: { email: normalizedEmail } });
  if (existingEmailRecord && existingEmailRecord.userId !== verificationToken.userId) {
    return { error: "This email is already connected to another account." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { consumedAt: new Date() },
    });

    if (isPrimaryEmail) {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      });
    }

    if (existingEmailRecord) {
      await tx.userEmail.update({
        where: { id: existingEmailRecord.id },
        data: {
          isVerified: true,
          isPrimary: existingEmailRecord.isPrimary || isPrimaryEmail,
        },
      });
    } else {
      await tx.userEmail.create({
        data: {
          userId: verificationToken.userId,
          email: normalizedEmail,
          isPrimary: isPrimaryEmail,
          isVerified: true,
        },
      });
    }
  });

  return { success: true, email: normalizedEmail };
}

export async function resetPassword(token: string, newPassword: string) {
  if (!token || !newPassword) {
    return { error: "Invalid request" };
  }

  const rl = rateLimit(`reset-verify:${token.slice(0, 16)}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) return { error: passwordValidation.error };

  const tokenHash = await hashAuthTokenValue(token);

  const user = await prisma.user.findFirst({
    where: {
      resetToken: tokenHash,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return { error: "Invalid or expired reset link. Please request a new one." };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  // Invalidate all existing sessions for security
  await invalidateAllUserSessions(user.id);

  return { success: true };
}

// ─── Onboarding Actions ──────────────────────────────────────

export async function completeOnboarding(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rl = rateLimit(`onboarding:${user.id}`, 12, 15 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many setup attempts. Please try again later." };
  }

  const username = String(formData.get("username") || user.username).trim().toLowerCase();
  const displayName = sanitizeForDisplay(String(formData.get("displayName") || user.displayName).trim());
  const bio = sanitizeForDisplay(String(formData.get("bio") || "").trim()).slice(0, 160);
  const location = sanitizeForDisplay(String(formData.get("location") || "").trim()).slice(0, 80);
  const phone = formData.get("phone") as string | null;
  const interests = Array.from(
    new Set(formData.getAll("interests").map((value) => sanitizeForDisplay(String(value).trim())).filter(Boolean)),
  ).slice(0, 12);
  const interfaceStyle = String(formData.get("interfaceStyle") || "balanced");
  const quickMerge = formData.get("quickMerge") === "true";
  const rawPlatforms = formData.getAll("platforms").map((value) => String(value).trim().toLowerCase()).filter(Boolean);
  const platforms = Array.from(new Set(rawPlatforms)).filter(isSupportedPlatform).slice(0, 24);
  const meshVisibility = ["private", "friends", "public"].includes(String(formData.get("meshVisibility")))
    ? String(formData.get("meshVisibility"))
    : "private";
  const emailDigest = ["off", "daily", "weekly"].includes(String(formData.get("emailDigest")))
    ? String(formData.get("emailDigest"))
    : "weekly";
  const bool = (name: string, fallback = false) => {
    const value = formData.get(name);
    if (value === null) return fallback;
    return value === "true" || value === "on" || value === "1";
  };
  const meshiUpdate = {
    colorTheme: cleanMeshiOption(String(formData.get("meshiColor") || ""), MESHI_OPTION_VALUES.colors, "blue") ?? "blue",
    hatStyle: cleanMeshiOption(String(formData.get("meshiHat") || ""), MESHI_OPTION_VALUES.hats, "none") ?? "none",
    faceStyle: cleanMeshiOption(String(formData.get("meshiFace") || ""), MESHI_OPTION_VALUES.faces, "happy") ?? "happy",
    hairStyle: cleanMeshiOption(String(formData.get("meshiHair") || ""), MESHI_OPTION_VALUES.hairs, "none") ?? "none",
    accessoryStyle: cleanMeshiOption(String(formData.get("meshiAccessory") || ""), MESHI_OPTION_VALUES.accessories, "none") ?? "none",
    eyeStyle: cleanMeshiOption(String(formData.get("meshiEyes") || ""), MESHI_OPTION_VALUES.eyes, "regular") ?? "regular",
    badgeStyle: cleanMeshiOption(String(formData.get("meshiBadge") || ""), MESHI_OPTION_VALUES.badges, "none") ?? "none",
    outfitStyle: cleanMeshiOption(String(formData.get("meshiOutfit") || ""), MESHI_OPTION_VALUES.outfits, "none") ?? "none",
  };

  if (username.length < 3 || username.length > 30 || !/^[a-z0-9_]+$/.test(username)) {
    return { error: "Username must be 3-30 characters and use letters, numbers, or underscores." };
  }

  if (displayName.length < 1 || displayName.length > 50) {
    return { error: "Display name must be between 1 and 50 characters." };
  }

  if (username !== user.username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existingUsername && existingUsername.id !== user.id) {
      return { error: "That username is already taken." };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      displayName,
      bio: bio || null,
      location: location || null,
      isPublic: meshVisibility === "public",
      showInDiscovery: bool("showInDiscovery", true) && meshVisibility !== "private",
      hideActivityStatus: bool("hideActivityStatus", true),
      readReceipts: bool("readReceipts", false),
      onboarded: true,
    },
  });

  await prisma.userInterest.deleteMany({ where: { userId: user.id } });
  if (interests.length > 0) {
    await prisma.userInterest.createMany({
      data: interests.map((tag) => ({ userId: user.id, tag })),
    });
  }

  await prisma.meshiPreference.upsert({
    where: { userId: user.id },
    update: {
      colorTheme: meshiUpdate.colorTheme,
      hatStyle: meshiUpdate.hatStyle,
      faceStyle: meshiUpdate.faceStyle,
      hairStyle: meshiUpdate.hairStyle,
      accessoryStyle: meshiUpdate.accessoryStyle,
      eyeStyle: meshiUpdate.eyeStyle,
      badgeStyle: meshiUpdate.badgeStyle,
      outfitStyle: meshiUpdate.outfitStyle,
    },
    create: {
      userId: user.id,
      colorTheme: meshiUpdate.colorTheme,
      hatStyle: meshiUpdate.hatStyle,
      faceStyle: meshiUpdate.faceStyle,
      hairStyle: meshiUpdate.hairStyle,
      accessoryStyle: meshiUpdate.accessoryStyle,
      eyeStyle: meshiUpdate.eyeStyle,
      badgeStyle: meshiUpdate.badgeStyle,
      outfitStyle: meshiUpdate.outfitStyle,
    },
  });

  await prisma.meshPrivacy.upsert({
    where: { userId: user.id },
    update: {
      meshVisibility,
      branchOverrides: JSON.stringify({
        people: meshVisibility,
        content: meshVisibility,
        platforms: meshVisibility === "public" ? "friends" : meshVisibility,
      }),
      showConnections: bool("showConnections", false),
      showStats: bool("showStats", false),
    },
    create: {
      userId: user.id,
      meshVisibility,
      branchOverrides: JSON.stringify({
        people: meshVisibility,
        content: meshVisibility,
        platforms: meshVisibility === "public" ? "friends" : meshVisibility,
      }),
      showConnections: bool("showConnections", false),
      showStats: bool("showStats", false),
    },
  });

  await prisma.feedPreference.upsert({
    where: { userId: user.id },
    update: {
      layout: interfaceStyle,
      sources: "all",
    },
    create: {
      userId: user.id,
      layout: interfaceStyle,
      sources: "all",
    },
  });

  await prisma.userNotificationPreference.upsert({
    where: { userId: user.id },
    update: {
      pushEnabled: bool("pushEnabled", true),
      emailDigest,
      messages: bool("notifyMessages", true),
      mentions: bool("notifyMentions", true),
      comments: bool("notifyComments", true),
      follows: bool("notifyFollows", true),
      platformAlerts: bool("notifyPlatformAlerts", true),
      securityAlerts: true,
      productUpdates: bool("notifyProductUpdates", false),
    },
    create: {
      userId: user.id,
      pushEnabled: bool("pushEnabled", true),
      emailDigest,
      messages: bool("notifyMessages", true),
      mentions: bool("notifyMentions", true),
      comments: bool("notifyComments", true),
      follows: bool("notifyFollows", true),
      platformAlerts: bool("notifyPlatformAlerts", true),
      securityAlerts: true,
      productUpdates: bool("notifyProductUpdates", false),
    },
  });

  // Persist phone number if provided
  if (phone && phone.trim()) {
    const existing = await prisma.userPhone.findFirst({ where: { userId: user.id } });
    if (!existing) {
      try {
        await prisma.userPhone.create({
          data: {
            userId: user.id,
            phone: phone.trim(),
            isPrimary: true,
            isVerified: false,
          },
        });
      } catch (e) {
        // Skip if phone already claimed by another user (P2002 unique constraint)
        if (!(e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002")) throw e;
      }
    }
  }

  // Create pending connected-account records for selected platforms.
  if (platforms.length > 0) {
    const existingAccounts = await prisma.connectedAccount.findMany({
      where: { userId: user.id },
      select: { platform: true },
    });
    const existingPlatforms = new Set(existingAccounts.map((a) => a.platform));
    const newPlatforms = platforms.filter((p) => !existingPlatforms.has(p));
    if (newPlatforms.length > 0) {
      await prisma.connectedAccount.createMany({
        data: newPlatforms.map((platform) => ({
          userId: user.id,
          platform,
          platformId: `pending-${user.id}-${platform}`,
          isActive: false, // Marked inactive until OAuth is completed
        })),
      });
    }
  }

  if (quickMerge && platforms.length > 0) {
    redirect(`/connected-accounts?from=onboarding&preselect=${encodeURIComponent(platforms.join(","))}`);
  }

  redirect("/mesh");
}

// ─── Post Actions ────────────────────────────────────────────

const POST_VISIBILITIES = new Set(["public", "friends", "private"]);
const MAX_POST_MEDIA_FILES = 4;
const MAX_POST_MEDIA_FILE_SIZE = 4 * 1024 * 1024;
const MAX_POST_MEDIA_TOTAL_SIZE = 10 * 1024 * 1024;

type NativePostMediaInput = {
  url: string;
  type: "image" | "video" | "link";
};

function normalizePostVisibility(value: FormDataEntryValue | null) {
  const visibility = typeof value === "string" ? value.trim().toLowerCase() : "";
  return POST_VISIBILITIES.has(visibility) ? visibility : "public";
}

function normalizePostTag(value: string) {
  return sanitizeForDisplay(value)
    .replace(/^#+/, "")
    .replace(/[^\w-]/g, "")
    .trim()
    .toLowerCase()
    .slice(0, 32);
}

function inferMediaTypeFromUrl(url: string): NativePostMediaInput["type"] {
  const clean = url.split("?")[0]?.toLowerCase() || "";
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(clean)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  return "link";
}

function detectUploadedPostMediaType(bytes: Uint8Array, fileType: string): { type: "image" | "video"; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image", mime: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: "image", mime: "image/png" };
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { type: "image", mime: "image/webp" };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { type: "image", mime: "image/gif" };
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return { type: "video", mime: fileType === "video/quicktime" ? "video/quicktime" : "video/mp4" };
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { type: "video", mime: "video/webm" };
  return null;
}

function readStringArrayField(formData: FormData, key: string, maxItems: number) {
  const values = formData.getAll(key).flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const trimmed = entry.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      // Treat as comma/newline separated text below.
    }
    return trimmed.split(/[,\n]/);
  });

  return values.map((value) => value.trim()).filter(Boolean).slice(0, maxItems);
}

async function collectNativePostMedia(formData: FormData) {
  const mediaItems: NativePostMediaInput[] = [];
  let totalBytes = 0;

  const files = formData
    .getAll("mediaFiles")
    .filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File && entry.size > 0)
    .slice(0, MAX_POST_MEDIA_FILES);

  for (const file of files) {
    if (file.size > MAX_POST_MEDIA_FILE_SIZE) {
      return { error: "Each image or video must be 4MB or smaller." };
    }
    totalBytes += file.size;
    if (totalBytes > MAX_POST_MEDIA_TOTAL_SIZE) {
      return { error: "Post media is too large. Keep uploads under 10MB total." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detected = detectUploadedPostMediaType(bytes, file.type);
    if (!detected) {
      return { error: "Use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM media." };
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    mediaItems.push({
      type: detected.type,
      url: `data:${detected.mime};base64,${base64}`,
    });
  }

  const remoteUrls = readStringArrayField(formData, "mediaUrls", MAX_POST_MEDIA_FILES);
  for (const rawUrl of remoteUrls) {
    if (mediaItems.length >= MAX_POST_MEDIA_FILES) break;
    if (!validateUrl(rawUrl)) return { error: "Media URLs must start with http:// or https://." };
    mediaItems.push({ url: rawUrl, type: inferMediaTypeFromUrl(rawUrl) });
  }

  const linkUrl = String(formData.get("linkUrl") || "").trim();
  if (linkUrl) {
    if (!validateUrl(linkUrl)) return { error: "Link URL must start with http:// or https://." };
    if (!mediaItems.some((item) => item.url === linkUrl)) {
      mediaItems.push({ url: linkUrl, type: "link" });
    }
  }

  return { mediaItems: mediaItems.slice(0, MAX_POST_MEDIA_FILES) };
}

export async function createPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const rl = rateLimit(`post:${user.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return { error: "Posting too fast. Please slow down." };
  }

  const content = formData.get("content") as string;
  const communityId = formData.get("communityId") as string | null;
  const tags = formData.get("tags") as string;
  const visibility = normalizePostVisibility(formData.get("visibility"));
  const crossPostTo = formData.get("crossPostTo") as string | null;
  const crossPostAccountIds = formData.get("crossPostAccountIds") as string | null;
  const mediaResult = await collectNativePostMedia(formData);
  if ("error" in mediaResult) return { error: mediaResult.error };
  const mediaItems = mediaResult.mediaItems;

  // Validate and sanitize post content
  const contentText = content || "";
  if (contentText.trim()) {
    const validation = validatePostContent(contentText);
    if (!validation.valid) {
      return { error: validation.error };
    }
  } else if (mediaItems.length === 0) {
    return { error: "Add text, media, or a link before posting." };
  }

  const sanitizedContent = sanitizeForDisplay(contentText.trim());
  const safety = classifyContentSafety(sanitizedContent, tags, mediaItems.map((item) => item.url).join(" "));

  // Verify community membership if posting to a community
  if (communityId) {
    const membership = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
    });
    if (!membership) {
      return { error: "You must be a member of this community to post" };
    }
  }

  const post = await prisma.post.create({
    data: {
      content: sanitizedContent,
      authorId: user.id,
      communityId: communityId || undefined,
      visibility,
      isNsfw: safety.isNsfw,
      contentRating: safety.contentRating,
    },
  });

  if (tags) {
    const tagList = Array.from(new Set(tags.split(",").map(normalizePostTag).filter(Boolean))).slice(0, 12);
    if (tagList.length > 0) {
      await prisma.postTag.createMany({
        data: tagList.map((tag) => ({ postId: post.id, tag })),
      });
    }
  }

  if (mediaItems.length > 0) {
    await prisma.postMedia.createMany({
      data: mediaItems.map((item) => ({
        postId: post.id,
        url: item.url,
        type: item.type,
      })),
    });
  }

  let crossPostResults: Record<string, { success: boolean; error?: string }> | undefined;
  const parseStringArray = (value: string | null) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
    }
  };
  const targetPlatforms = parseStringArray(crossPostTo);
  const targetAccountIds = parseStringArray(crossPostAccountIds);
  if (targetPlatforms.length > 0 || targetAccountIds.length > 0) {
    const { crossPostContent } = await import("./platform-sync");
    const result = await crossPostContent(sanitizedContent, targetPlatforms, mediaItems.filter((item) => item.type !== "link").map((item) => item.url), targetAccountIds);
    if ("results" in result && result.results && typeof result.results === "object") {
      crossPostResults = result.results;
    }
  }

  const createdPost = await prisma.post.findUnique({
    where: { id: post.id },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
        },
      },
      community: {
        select: { id: true, name: true, slug: true },
      },
      media: true,
      tags: true,
      _count: {
        select: { comments: true, reactions: true, reposts: true },
      },
      reactions: {
        where: { userId: user.id },
        select: { id: true },
      },
      savedBy: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  });

  revalidatePath("/feed");
  revalidatePath(`/feed/${post.id}`);
  revalidatePath(`/profile/${user.username}`);
  if (communityId) {
    const community = await prisma.community.findUnique({ where: { id: communityId }, select: { slug: true } });
    if (community) revalidatePath(`/communities/${community.slug}`);
  }
  clearMeshCache(user.id);

  return {
    success: true,
    postId: post.id,
    post: createdPost ? { ...createdPost, platform: "meshme" } : undefined,
    crossPostResults,
  };
}

export async function createCommunityPostFromForm(formData: FormData): Promise<void> {
  await createPost(formData);
}

export async function deletePost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found" };
  if (post.authorId !== user.id && !user.isAdmin) return { error: "Unauthorized" };

  await prisma.post.delete({ where: { id: postId } });
  revalidatePath("/feed");
  revalidatePath(`/feed/${postId}`);
  revalidatePath(`/profile/${user.username}`);
  clearMeshCache(user.id);
  if (post.authorId !== user.id) {
    clearMeshCache(post.authorId);
  }
  return { success: true };
}

// ─── Reaction Actions ────────────────────────────────────────

export async function toggleReaction(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) return { error: "Post not found" };

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({
      data: { userId: user.id, postId, type: "like" },
    });

    // Create notification
    if (post.authorId !== user.id) {
      await prisma.notification.create({
        data: {
          type: "like",
          recipientId: post.authorId,
          actorId: user.id,
          postId,
          message: `${user.displayName} liked your post`,
        },
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/feed/${postId}`);
  clearMeshCache(user.id);
  if (post.authorId !== user.id) {
    clearMeshCache(post.authorId);
  }
  return { success: true, liked: !existing };
}

// ─── Comment Actions ─────────────────────────────────────────

export async function createComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const postId = formData.get("postId") as string;
  const parentId = formData.get("parentId") as string | null;

  if (!content?.trim() || !postId) {
    return { error: "Comment content is required" };
  }

  const sanitizedComment = sanitizeForDisplay(content.trim());

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) return { error: "Post not found" };

  await prisma.comment.create({
    data: {
      content: sanitizedComment,
      authorId: user.id,
      postId,
      parentId: parentId || undefined,
    },
  });

  // Create notification
  if (post.authorId !== user.id) {
    await prisma.notification.create({
      data: {
        type: "comment",
        recipientId: post.authorId,
        actorId: user.id,
        postId,
        message: `${user.displayName} commented on your post`,
      },
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/feed/${postId}`);
  clearMeshCache(user.id);
  if (post.authorId !== user.id) {
    clearMeshCache(post.authorId);
  }
  return { success: true };
}

// ─── Follow Actions ──────────────────────────────────────────

export async function toggleFollow(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === targetUserId) return { error: "Cannot follow yourself" };

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, username: true, displayName: true, isSuspended: true },
  });
  if (!targetUser || targetUser.isSuspended) return { error: "User not found" };

  // Check if either user has blocked the other
  const blockExists = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: user.id },
      ],
    },
  });
  if (blockExists) return { error: "Cannot follow this user" };

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
  });

  let isFriend = false;

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({
      data: { followerId: user.id, followingId: targetUserId },
    });

    const reciprocalFollow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: targetUserId, followingId: user.id } },
      select: { id: true },
    });
    isFriend = Boolean(reciprocalFollow);

    await prisma.notification.create({
      data: {
        type: "follow",
        recipientId: targetUserId,
        actorId: user.id,
        message: `${user.displayName} started following you`,
      },
    });

    if (isFriend) {
      await prisma.notification.createMany({
        data: [
          {
            type: "mesh_friend",
            recipientId: targetUserId,
            actorId: user.id,
            message: `${user.displayName}'s Mesh is now connected with yours`,
          },
          {
            type: "mesh_friend",
            recipientId: user.id,
            actorId: targetUserId,
            message: `Your Mesh is now connected with ${targetUser.displayName}`,
          },
        ],
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath("/mesh");
  revalidatePath("/notifications");
  revalidatePath(`/profile/${user.username}`);
  revalidatePath(`/profile/${targetUser.username}`);
  clearMeshCache(user.id);
  clearMeshCache(targetUser.id);
  return { success: true, following: !existing, isFriend };
}

// ─── Profile Actions ─────────────────────────────────────────

function normalizeProfileInterests(formData: FormData) {
  const rawValues = [
    ...formData.getAll("interests").map((value) => String(value)),
    String(formData.get("interestTags") || ""),
  ];

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => value.split(/[,\n]/))
        .map((value) =>
          sanitizeForDisplay(value)
            .replace(/^#+/, "")
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 24)
        )
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    )
  ).slice(0, 12);
}

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const displayName = sanitizeForDisplay(String(formData.get("displayName") || "")).slice(0, 80) || user.displayName;
  const bio = sanitizeForDisplay(String(formData.get("bio") || "")).slice(0, 280);
  const location = sanitizeForDisplay(String(formData.get("location") || "")).slice(0, 80);
  const rawWebsite = String(formData.get("website") || "").trim();
  const rawAccentColor = String(formData.get("accentColor") || "").trim();
  const accentColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(rawAccentColor)
    ? rawAccentColor
    : user.accentColor;
  const interests = normalizeProfileInterests(formData);

  if (rawWebsite && !validateUrl(rawWebsite)) {
    return { error: "Enter a valid website that starts with http:// or https://." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        displayName,
        bio: bio || null,
        location: location || null,
        website: rawWebsite || null,
        accentColor,
      },
    });

    if (formData.has("interests") || formData.has("interestTags")) {
      await tx.userInterest.deleteMany({ where: { userId: user.id } });
      if (interests.length > 0) {
        await tx.userInterest.createMany({
          data: interests.map((tag) => ({ userId: user.id, tag })),
        });
      }
    }
  });

  revalidatePath("/profile");
  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/settings");
  revalidatePath("/search");
  clearMeshCache(user.id);
  return { success: true };
}

// ─── Community Actions ───────────────────────────────────────

export async function createCommunity(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const rl = rateLimit(`community:${user.id}`, 6, 60 * 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many community creation attempts. Please try again later." };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const rules = formData.get("rules") as string;
  const spaceType = formData.get("spaceType") as string;
  const iconUrl = formData.get("iconUrl") as string;
  const bannerUrl = formData.get("bannerUrl") as string;
  const isPublic = formData.get("isPublic") !== "false";

  if (!name?.trim()) {
    return { error: "Community name is required" };
  }

  const slug = slugify(name.trim());

  if (!slug) {
    return { error: "Community name must contain at least one letter or number" };
  }

  const existing = await prisma.community.findFirst({
    where: { OR: [{ name: name.trim() }, { slug }] },
  });

  if (existing) {
    return { error: "A community with that name already exists" };
  }

  const community = await prisma.community.create({
    data: {
      name: sanitizeForDisplay(name.trim()).slice(0, 64),
      slug,
      description: description ? sanitizeForDisplay(description).slice(0, 240) : undefined,
      category: category ? sanitizeForDisplay(category).slice(0, 40) : spaceType ? sanitizeForDisplay(spaceType).slice(0, 40) : undefined,
      iconUrl: iconUrl && validateUrl(iconUrl) ? iconUrl : undefined,
      bannerUrl: bannerUrl && validateUrl(bannerUrl) ? bannerUrl : undefined,
      isPublic,
      rules: rules
        ? sanitizeForDisplay(rules).slice(0, 800)
        : "Respect people.\nCredit original creators.\nKeep private community content inside the community.",
    },
  });

  // Creator becomes admin
  await prisma.communityMember.create({
    data: {
      userId: user.id,
      communityId: community.id,
      role: "admin",
    },
  });

  revalidatePath("/communities");
  revalidatePath(`/communities/${community.slug}`);
  clearMeshCache(user.id);
  return { success: true, communityId: community.id, slug: community.slug };
}

export async function toggleCommunityMembership(communityId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const [community, existing] = await Promise.all([
    prisma.community.findUnique({ where: { id: communityId }, select: { id: true, slug: true, isPublic: true } }),
    prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
    }),
  ]);

  if (!community) return { error: "Community not found" };

  if (existing) {
    if (existing.role === "admin") {
      return { error: "Admins cannot leave their community" };
    }
    await prisma.communityMember.delete({ where: { id: existing.id } });
  } else {
    if (!community.isPublic) {
      return { error: "This private community requires an invite" };
    }
    await prisma.communityMember.create({
      data: { userId: user.id, communityId },
    });
  }

  revalidatePath("/communities");
  revalidatePath(`/communities/${community.slug}`);
  clearMeshCache(user.id);
  return { success: true, joined: !existing };
}

// ─── Message Actions ─────────────────────────────────────────

function cleanFormText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? sanitizeForDisplay(trimmed).slice(0, maxLength) : undefined;
}

export async function sendMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const threadId = formData.get("threadId") as string;
  const recipientId = formData.get("recipientId") as string;

  if (!content?.trim()) return { error: "Message is required" };
  const sanitizedContent = sanitizeForDisplay(content.trim());
  const messageType = cleanFormText(formData, "messageType", 40) || "text";
  const sourcePlatform = cleanFormText(formData, "sourcePlatform", 40) || "mesh";
  const sourceUrl = cleanFormText(formData, "sourceUrl", 500);
  const sourcePostId = cleanFormText(formData, "sourcePostId", 120);
  const platformPostId = cleanFormText(formData, "platformPostId", 120);
  const platformCommentId = cleanFormText(formData, "platformCommentId", 120);
  const metadata = cleanFormText(formData, "metadata", 1000);

  // Rate limit messages
  const rl = rateLimit(`msg:${user.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return { error: "Sending too fast. Please slow down." };
  }

  let finalThreadId = threadId;

  if (!finalThreadId && recipientId) {
    if (recipientId === user.id) return { error: "Cannot message yourself" };

    // Check if either user has blocked the other
    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: recipientId },
          { blockerId: recipientId, blockedId: user.id },
        ],
      },
    });
    if (blockExists) return { error: "Cannot send message to this user" };

    // Find or create thread
    const existingThread = await prisma.messageThread.findFirst({
      where: {
        threadType: "direct",
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: recipientId } } },
        ],
      },
    });

    if (existingThread) {
      finalThreadId = existingThread.id;
    } else {
      const thread = await prisma.messageThread.create({
        data: {
          threadType: "direct",
          sourcePlatform: "mesh",
          isEncrypted: true,
          members: {
            create: [
              { userId: user.id, role: "owner" },
              { userId: recipientId, role: "member" },
            ],
          },
        },
      });
      finalThreadId = thread.id;
    }
  }

  if (!finalThreadId) return { error: "No thread specified" };

  // Verify the user is a member of this thread
  const membership = await prisma.threadMember.findFirst({
    where: { threadId: finalThreadId, userId: user.id },
  });
  if (!membership) return { error: "Not a member of this thread" };

  // Check if user is blocked by or has blocked any other thread member
  const otherMembers = await prisma.threadMember.findMany({
    where: { threadId: finalThreadId, userId: { not: user.id } },
  });
  for (const member of otherMembers) {
    const threadBlockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: member.userId },
          { blockerId: member.userId, blockedId: user.id },
        ],
      },
    });
    if (threadBlockExists) return { error: "Cannot send message to this user" };
  }

  await prisma.message.create({
    data: {
      content: sanitizedContent,
      senderId: user.id,
      threadId: finalThreadId,
      messageType,
      sourcePlatform,
      sourceUrl,
      sourcePostId,
      platformPostId,
      platformCommentId,
      metadata,
    },
  });

  await prisma.messageThread.update({
    where: { id: finalThreadId },
    data: { updatedAt: new Date() },
  });

  // Create notification for recipient
  const threadMembers = await prisma.threadMember.findMany({
    where: { threadId: finalThreadId, userId: { not: user.id } },
  });

  const threadForNotification = await prisma.messageThread.findUnique({
    where: { id: finalThreadId },
    select: { title: true, threadType: true },
  });
  const isGroupThread = threadForNotification?.threadType === "group";

  for (const member of threadMembers) {
    await prisma.notification.create({
      data: {
        type: "message",
        recipientId: member.userId,
        actorId: user.id,
        message: isGroupThread
          ? `${user.displayName} sent a message in ${threadForNotification.title || "a MeChat group"}`
          : `${user.displayName} sent you a message`,
      },
    });
  }

  revalidatePath("/messages");
  clearMeshCache(user.id);
  return { success: true, threadId: finalThreadId };
}

async function sharePostViaMeChatLegacy(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const postId = (formData.get("postId") as string | null)?.trim();
  if (!postId) return { error: "postId is required" };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: { username: true, displayName: true },
      },
    },
  });
  if (!post) return { error: "Post not found" };

  const note = ((formData.get("note") as string | null) || "").trim();
  const sharedMessage = `${note ? `${note}\n\n` : ""}🔗 Shared a post by ${post.author.displayName} (@${post.author.username})\n${post.content.slice(0, 260)}${post.content.length > 260 ? "…" : ""}\n/feed/${post.id}`;

  const nextData = new FormData();
  nextData.set("content", sharedMessage);

  const threadId = (formData.get("threadId") as string | null)?.trim();
  const recipientId = (formData.get("recipientId") as string | null)?.trim();
  if (threadId) nextData.set("threadId", threadId);
  if (recipientId) nextData.set("recipientId", recipientId);

  return sendMessage(nextData);
}

// ─── Notification Actions ────────────────────────────────────

void sharePostViaMeChatLegacy;

export async function sharePostViaMeChat(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const postId = (formData.get("postId") as string | null)?.trim();
  const platformPostId = (formData.get("platformPostId") as string | null)?.trim();
  const sourceUrl = (formData.get("sourceUrl") as string | null)?.trim();
  if (!postId && !platformPostId && !sourceUrl) return { error: "A post or source URL is required" };

  const nextData = new FormData();
  let sharedMessage = "";

  if (postId) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { username: true, displayName: true },
        },
      },
    });
    if (!post) return { error: "Post not found" };

    const note = ((formData.get("note") as string | null) || "").trim();
    sharedMessage = `${note ? `${note}\n\n` : ""}Shared a Mesh.me post by ${post.author.displayName} (@${post.author.username})\n${post.content.slice(0, 260)}${post.content.length > 260 ? "..." : ""}\n/feed/${post.id}`;
    nextData.set("messageType", "shared_post");
    nextData.set("sourcePlatform", "mesh");
    nextData.set("sourcePostId", post.id);
  } else if (platformPostId) {
    const platformPost = await prisma.platformPost.findFirst({
      where: {
        id: platformPostId,
        ...nsfwHiddenWhere(user),
        OR: [
          { connectedAccount: { userId: user.id } },
          {
            visibility: { not: "private" },
            connectedAccount: {
              user: {
                isSuspended: false,
                isPublic: true,
                showInDiscovery: true,
              },
            },
          },
        ],
      },
      include: {
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
          },
        },
      },
    });
    if (!platformPost) return { error: "Platform post not found or not shareable" };

    const note = ((formData.get("note") as string | null) || "").trim();
    const preview = [platformPost.title, platformPost.content].filter(Boolean).join("\n").slice(0, 260);
    const platformName = platformPost.connectedAccount.platform;
    const author = platformPost.connectedAccount.platformUsername ? ` from @${platformPost.connectedAccount.platformUsername}` : "";
    sharedMessage = `${note ? `${note}\n\n` : ""}Shared a ${platformName} post${author}\n${preview}${preview.length >= 260 ? "..." : ""}${platformPost.url ? `\n${platformPost.url}` : ""}`;
    nextData.set("messageType", "platform_share");
    nextData.set("sourcePlatform", platformName);
    nextData.set("platformPostId", platformPost.id);
    if (platformPost.url) nextData.set("sourceUrl", platformPost.url);
  } else if (sourceUrl) {
    const note = ((formData.get("note") as string | null) || "").trim();
    const sourcePlatform = (formData.get("sourcePlatform") as string | null)?.trim() || "web";
    sharedMessage = `${note ? `${note}\n\n` : ""}Shared a ${sourcePlatform} link\n${sourceUrl}`;
    nextData.set("messageType", "platform_share");
    nextData.set("sourcePlatform", sourcePlatform);
    nextData.set("sourceUrl", sourceUrl);
  }

  nextData.set("content", sharedMessage);

  const threadId = (formData.get("threadId") as string | null)?.trim();
  const recipientId = (formData.get("recipientId") as string | null)?.trim();
  if (threadId) nextData.set("threadId", threadId);
  if (recipientId) nextData.set("recipientId", recipientId);

  return sendMessage(nextData);
}

export async function markNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  await prisma.notification.updateMany({
    where: { recipientId: user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/notifications");
  return { success: true };
}

// ─── Report Actions ──────────────────────────────────────────

export async function createReport(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const reason = formData.get("reason") as string;
  const reportedUserId = formData.get("reportedUserId") as string | null;
  const reportedPostId = formData.get("reportedPostId") as string | null;

  if (!reason?.trim()) return { error: "Reason is required" };

  await prisma.report.create({
    data: {
      reason: reason.trim(),
      reporterId: user.id,
      reportedUserId: reportedUserId || undefined,
      reportedPostId: reportedPostId || undefined,
    },
  });

  return { success: true };
}

// ─── Block/Mute Actions ─────────────────────────────────────

export async function toggleBlock(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === targetUserId) return { error: "Cannot block yourself" };

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } },
  });

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } });
  } else {
    await prisma.block.create({
      data: { blockerId: user.id, blockedId: targetUserId },
    });
    // Also unfollow
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: user.id, followingId: targetUserId },
          { followerId: targetUserId, followingId: user.id },
        ],
      },
    });
  }

  revalidatePath("/settings");
  clearMeshCache(user.id);
  clearMeshCache(targetUserId);
  return { success: true, blocked: !existing };
}

// ─── Save Post Actions ───────────────────────────────────────

export async function toggleSavePost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await prisma.savedPost.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.savedPost.delete({ where: { id: existing.id } });
  } else {
    await prisma.savedPost.create({
      data: { userId: user.id, postId },
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/feed/${postId}`);
  return { success: true, saved: !existing };
}

// ─── Admin Actions ───────────────────────────────────────────

export async function adminSuspendUser(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  if (user.id === targetUserId) return { error: "Cannot suspend yourself" };

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return { error: "User not found" };
  if (target.isAdmin) return { error: "Cannot suspend other admin users" };

  const newSuspendedState = !target.isSuspended;

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isSuspended: newSuspendedState },
  });

  // Invalidate all sessions when suspending to prevent continued access
  if (newSuspendedState) {
    await invalidateAllUserSessions(targetUserId);
  }

  await prisma.adminLog.create({
    data: {
      action: newSuspendedState ? "suspend_user" : "unsuspend_user",
      details: `User: ${target.username}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function adminResolveReport(reportId: string, status: string) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  const validStatuses = ["resolved", "dismissed"];
  if (!validStatuses.includes(status)) {
    return { error: "Invalid status" };
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { status },
  });

  await prisma.adminLog.create({
    data: {
      action: `resolve_report_${status}`,
      details: `Report: ${reportId}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function adminSetCommunityVisibility(communityId: string, isPublic: boolean) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, slug: true, isPublic: true },
  });
  if (!community) return { error: "Community not found" };

  await prisma.community.update({
    where: { id: communityId },
    data: { isPublic },
  });

  await prisma.adminLog.create({
    data: {
      action: isPublic ? "community_make_public" : "community_make_private",
      details: `Community: ${community.name}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/communities");
  revalidatePath(`/communities/${community.slug}`);
  return { success: true };
}

export async function adminResolveCommunityReports(communityId: string) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, slug: true },
  });
  if (!community) return { error: "Community not found" };

  const result = await prisma.report.updateMany({
    where: { reportedCommunityId: communityId, status: "pending" },
    data: { status: "resolved" },
  });

  await prisma.adminLog.create({
    data: {
      action: "community_reports_resolved",
      details: `${community.name}: ${result.count} report${result.count === 1 ? "" : "s"}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/communities/${community.slug}`);
  return { success: true, count: result.count };
}

export async function adminDeletePost(postId: string) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Unauthorized" };

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found" };

  await prisma.post.delete({ where: { id: postId } });
  await prisma.report.updateMany({
    where: { reportedPostId: postId, status: "pending" },
    data: { status: "resolved" },
  });

  await prisma.adminLog.create({
    data: {
      action: "delete_post",
      details: `Post: ${postId}`,
      adminId: user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/feed");
  clearMeshCache(user.id);
  clearMeshCache(post.authorId);
  return { success: true };
}

// ─── Mute Actions ───────────────────────────────────────────

export async function toggleMute(targetUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === targetUserId) return { error: "Cannot mute yourself" };

  const existing = await prisma.mute.findUnique({
    where: { muterId_mutedId: { muterId: user.id, mutedId: targetUserId } },
  });

  if (existing) {
    await prisma.mute.delete({ where: { id: existing.id } });
  } else {
    await prisma.mute.create({
      data: { muterId: user.id, mutedId: targetUserId },
    });
  }

  revalidatePath("/settings");
  return { success: true, muted: !existing };
}

// ─── Repost Actions ─────────────────────────────────────────

export async function repost(postId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const original = await prisma.post.findUnique({ where: { id: postId } });
  if (!original) return { error: "Post not found" };

  // Check if already reposted
  const existing = await prisma.post.findFirst({
    where: { authorId: user.id, repostId: postId, isRepost: true },
  });

  if (existing) {
    await prisma.post.delete({ where: { id: existing.id } });
    revalidatePath("/feed");
    revalidatePath(`/feed/${postId}`);
    return { success: true, reposted: false };
  }

  await prisma.post.create({
    data: {
      content: original.content,
      authorId: user.id,
      isRepost: true,
      repostId: postId,
    },
  });

  if (original.authorId !== user.id) {
    await prisma.notification.create({
      data: {
        type: "repost",
        recipientId: original.authorId,
        actorId: user.id,
        postId,
        message: `${user.displayName} reposted your post`,
      },
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/feed/${postId}`);
  return { success: true, reposted: true };
}

// ─── Pin Post Actions ───────────────────────────────────────

export async function togglePinPost(postId: string, communityId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || (membership.role !== "admin" && membership.role !== "moderator")) {
    return { error: "Only moderators can pin posts" };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found" };
  if (post.communityId !== communityId) return { error: "Post does not belong to this community" };

  await prisma.post.update({
    where: { id: postId },
    data: { isPinned: !post.isPinned },
  });

  const pinCommunity = await prisma.community.findUnique({ where: { id: communityId }, select: { slug: true } });
  if (pinCommunity) revalidatePath(`/communities/${pinCommunity.slug}`);
  return { success: true, pinned: !post.isPinned };
}

// ─── Password Actions ───────────────────────────────────────

export async function changePassword(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required" };
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) return { error: passwordValidation.error?.replace("Password", "New password") };

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect" };
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  // Invalidate all existing sessions and create a fresh one for the current user
  await invalidateAllUserSessions(user.id);
  await createSession(user.id);

  return { success: true };
}

// ─── Account Actions ────────────────────────────────────────

export async function deleteAccount(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");

  if (confirmation !== "DELETE") {
    return { error: "Type DELETE to confirm account deletion." };
  }

  if (!currentPassword) {
    return { error: "Enter your current password before deleting this account." };
  }

  const passwordMatches = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return { error: "Current password is incorrect." };
  }

  if (user.isAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return { error: "Cannot delete the last admin account. Transfer admin role first." };
    }
  }

  // Cancel active Stripe subscription if exists
  if (user.stripeSubscriptionId) {
    try {
      const key = process.env.STRIPE_SECRET_KEY;
      if (key) {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(key);
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      }
    } catch {
      // Continue with deletion even if Stripe cancellation fails
    }
  }

  // Clean up orphaned records that don't have cascade rules
  await prisma.accountMergeRequest.deleteMany({
    where: {
      OR: [
        { primaryUserId: user.id },
        { secondaryEmail: user.email },
      ],
    },
  });

  // Delete the user — all related records cascade automatically via schema rules
  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/login?accountDeleted=1");
}

// ─── Privacy Actions ────────────────────────────────────────

export async function updatePrivacy(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const isPublic = formData.get("isPublic") === "true";
  const showInDiscovery = formData.get("showInDiscovery") !== "false";
  const hideActivityStatus = formData.get("hideActivityStatus") === "true";
  const readReceipts = formData.get("readReceipts") !== "false";

  await prisma.user.update({
    where: { id: user.id },
    data: { isPublic, showInDiscovery, hideActivityStatus, readReceipts },
  });

  revalidatePath("/settings");
  revalidatePath("/privacy-controls");
  return { success: true };
}

export async function updateNotificationPreferences(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const emailDigest = ["off", "daily", "weekly"].includes(String(formData.get("emailDigest")))
    ? String(formData.get("emailDigest"))
    : "weekly";
  const bool = (name: string, fallback = false) => {
    const value = formData.get(name);
    if (value === null) return fallback;
    return value === "true" || value === "on" || value === "1";
  };

  await prisma.userNotificationPreference.upsert({
    where: { userId: user.id },
    update: {
      pushEnabled: bool("pushEnabled", true),
      emailDigest,
      messages: bool("messages", true),
      mentions: bool("mentions", true),
      comments: bool("comments", true),
      follows: bool("follows", true),
      platformAlerts: bool("platformAlerts", true),
      securityAlerts: true,
      productUpdates: bool("productUpdates", false),
    },
    create: {
      userId: user.id,
      pushEnabled: bool("pushEnabled", true),
      emailDigest,
      messages: bool("messages", true),
      mentions: bool("mentions", true),
      comments: bool("comments", true),
      follows: bool("follows", true),
      platformAlerts: bool("platformAlerts", true),
      securityAlerts: true,
      productUpdates: bool("productUpdates", false),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/notifications");
  return { success: true };
}

// ─── Community Moderation ───────────────────────────────────

export async function updateNsfwPreference(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const enable = formData.get("nsfwEnabled") === "true";
  const region = normalizeUsState(formData.get("adultVerificationRegion") as string | null);

  if (!enable) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nsfwEnabled: false,
        adultVerificationRegion: region || user.adultVerificationRegion,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/feed");
    revalidatePath("/search");
    revalidatePath("/mesh");
    return { success: true };
  }

  const policy = getNsfwPolicyForRegion(region || user.adultVerificationRegion);
  if (policy.requiresIdVerification && !isAdultVerificationActive(user)) {
    return {
      error: "Adult ID verification is required before NSFW content can be enabled. NSFW remains off.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      nsfwEnabled: true,
      adultVerificationRegion: region || user.adultVerificationRegion,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/privacy-controls");
  revalidatePath("/feed");
  revalidatePath("/search");
  revalidatePath("/mesh");
  return { success: true };
}

export async function requestAdultVerification(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const region = normalizeUsState(formData.get("adultVerificationRegion") as string | null);
  const policy = getNsfwPolicyForRegion(region);
  const providerUrl = process.env.ADULT_VERIFICATION_PROVIDER_URL?.trim();
  const providerName = process.env.ADULT_VERIFICATION_PROVIDER_NAME?.trim() || "external-provider";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      nsfwEnabled: false,
      adultVerificationStatus: "pending",
      adultVerificationRegion: region || null,
      adultVerificationProvider: providerName,
      adultVerificationReference: null,
    },
  });

  revalidatePath("/settings");

  if (!providerUrl) {
    return {
      error: `${policy.reason} Adult verification is not configured for this deployment yet, so NSFW remains off.`,
    };
  }

  let redirectUrl: string;
  try {
    const url = new URL(providerUrl);
    url.searchParams.set("client_reference_id", user.id);
    url.searchParams.set("minimum_age", String(policy.minAge));
    if (region) url.searchParams.set("region", region);
    url.searchParams.set("return_url", `${getBaseUrl()}/settings`);
    redirectUrl = url.toString();
  } catch {
    return { error: "Adult verification provider URL is invalid. NSFW remains off." };
  }

  return { success: true, redirectUrl };
}

export async function updateCommunity(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const communityId = formData.get("communityId") as string;
  const description = formData.get("description") as string;
  const rules = formData.get("rules") as string;
  const category = formData.get("category") as string;
  const iconUrl = formData.get("iconUrl") as string;
  const bannerUrl = formData.get("bannerUrl") as string;
  const isPublicValue = formData.get("isPublic");

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || membership.role !== "admin") {
    return { error: "Only admins can edit community settings" };
  }

  const community = await prisma.community.update({
    where: { id: communityId },
    data: {
      description: description ? sanitizeForDisplay(description).slice(0, 240) : null,
      rules: rules ? sanitizeForDisplay(rules).slice(0, 800) : null,
      category: category ? sanitizeForDisplay(category).slice(0, 40) : null,
      iconUrl: iconUrl && validateUrl(iconUrl) ? iconUrl : null,
      bannerUrl: bannerUrl && validateUrl(bannerUrl) ? bannerUrl : null,
      isPublic: isPublicValue === "true",
    },
    select: { slug: true },
  });

  revalidatePath("/communities");
  revalidatePath(`/communities/${community.slug}`);
  return { success: true };
}

export async function updateCommunityFromForm(formData: FormData): Promise<void> {
  await updateCommunity(formData);
}

export async function promoteMember(userId: string, communityId: string, role: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const validRoles = ["member", "moderator"];
  if (!validRoles.includes(role)) {
    return { error: "Invalid role" };
  }

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || membership.role !== "admin") {
    return { error: "Only admins can change roles" };
  }

  const target = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { role: true },
  });
  if (!target) return { error: "User is not a member of this community" };
  if (target.role === "admin") return { error: "Admin roles cannot be changed here" };

  await prisma.communityMember.update({
    where: { userId_communityId: { userId, communityId } },
    data: { role },
  });

  const community = await prisma.community.findUnique({ where: { id: communityId }, select: { slug: true } });
  if (community) revalidatePath(`/communities/${community.slug}`);
  return { success: true };
}

export async function removeMember(userId: string, communityId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId } },
  });

  if (!membership || (membership.role !== "admin" && membership.role !== "moderator")) {
    return { error: "Only moderators can remove members" };
  }

  const target = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });

  if (!target) {
    return { error: "User is not a member of this community" };
  }

  if (target.role === "admin" || (target.role === "moderator" && membership.role !== "admin")) {
    return { error: "Only admins can remove moderators" };
  }

  await prisma.communityMember.delete({
    where: { userId_communityId: { userId, communityId } },
  });

  const removeCommunity = await prisma.community.findUnique({ where: { id: communityId }, select: { slug: true } });
  if (removeCommunity) revalidatePath(`/communities/${removeCommunity.slug}`);
  clearMeshCache(user.id);
  clearMeshCache(userId);
  return { success: true };
}

// ─── Delete Comment ─────────────────────────────────────────

export async function updateCommunityMemberRole(formData: FormData) {
  const targetUserId = formData.get("targetUserId") as string;
  const communityId = formData.get("communityId") as string;
  const role = formData.get("role") as string;

  return promoteMember(targetUserId, communityId, role);
}

export async function updateCommunityMemberRoleFromForm(formData: FormData): Promise<void> {
  await updateCommunityMemberRole(formData);
}

export async function removeCommunityMemberFromForm(formData: FormData): Promise<void> {
  const targetUserId = formData.get("targetUserId") as string;
  const communityId = formData.get("communityId") as string;

  await removeMember(targetUserId, communityId);
}

export async function moderateCommunityPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const communityId = formData.get("communityId") as string;
  const postId = formData.get("postId") as string;
  const moderationAction = formData.get("moderationAction") as string;

  const [membership, post, community] = await Promise.all([
    prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
    }),
    prisma.post.findUnique({ where: { id: postId }, select: { id: true, communityId: true, isPinned: true, authorId: true } }),
    prisma.community.findUnique({ where: { id: communityId }, select: { slug: true } }),
  ]);

  if (!membership || (membership.role !== "admin" && membership.role !== "moderator")) {
    return { error: "Only moderators can manage community posts" };
  }
  if (!post || post.communityId !== communityId) {
    return { error: "Post does not belong to this community" };
  }

  if (moderationAction === "toggle-pin") {
    await prisma.post.update({ where: { id: postId }, data: { isPinned: !post.isPinned } });
  } else if (moderationAction === "delete") {
    await prisma.post.delete({ where: { id: postId } });
  } else {
    return { error: "Invalid moderation action" };
  }

  revalidatePath("/communities");
  revalidatePath("/feed");
  if (community) revalidatePath(`/communities/${community.slug}`);
  clearMeshCache(user.id);
  clearMeshCache(post.authorId);
  return { success: true };
}

export async function moderateCommunityPostFromForm(formData: FormData): Promise<void> {
  await moderateCommunityPost(formData);
}

export async function sendCommunityMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const communityId = formData.get("communityId") as string;
  const content = formData.get("content") as string;
  if (!content?.trim()) return { error: "Message is required" };

  const rl = rateLimit(`community-message:${user.id}:${communityId}`, 45, 60 * 1000);
  if (!rl.allowed) {
    return { error: "Sending too fast. Please slow down." };
  }

  const [membership, community, members] = await Promise.all([
    prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
    }),
    prisma.community.findUnique({ where: { id: communityId }, select: { id: true, slug: true, name: true } }),
    prisma.communityMember.findMany({ where: { communityId }, select: { userId: true, role: true } }),
  ]);

  if (!membership) return { error: "Join the community to chat" };
  if (!community) return { error: "Community not found" };

  let thread = await prisma.messageThread.findFirst({
    where: { title: communityThreadTitle(communityId), threadType: "community" },
    select: { id: true },
  });

  if (!thread) {
    thread = await prisma.messageThread.create({
      data: {
        title: communityThreadTitle(communityId),
        threadType: "community",
        sourcePlatform: "mesh",
        isEncrypted: true,
      },
      select: { id: true },
    });
  }

  for (const member of members) {
    await prisma.threadMember.upsert({
      where: { userId_threadId: { userId: member.userId, threadId: thread.id } },
      update: {},
      create: {
        userId: member.userId,
        threadId: thread.id,
        role: member.role === "admin" || member.role === "moderator" ? member.role : "member",
      },
    });
  }

  await prisma.message.create({
    data: {
      content: sanitizeForDisplay(content.trim()).slice(0, 1200),
      senderId: user.id,
      threadId: thread.id,
      sourcePlatform: "mesh",
      messageType: "community",
      metadata: JSON.stringify({ communityId, communityName: community.name }),
    },
  });

  revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/messages");
  clearMeshCache(user.id);
  return { success: true };
}

export async function sendCommunityMessageFromForm(formData: FormData): Promise<void> {
  await sendCommunityMessage(formData);
}

export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, post: { select: { authorId: true } } },
  });
  if (!comment) return { error: "Comment not found" };
  if (comment.authorId !== user.id && !user.isAdmin) return { error: "Unauthorized" };

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath("/feed");
  clearMeshCache(user.id);
  if (comment.authorId !== user.id) {
    clearMeshCache(comment.authorId);
  }
  if (comment.post.authorId !== user.id) {
    clearMeshCache(comment.post.authorId);
  }
  return { success: true };
}

// ─── User Links Actions ─────────────────────────────────────

export async function updateUserLinks(links: { label: string; url: string }[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  // Remove existing links and create new ones atomically
  const { validateUrl } = await import("./security");
  const validLinks = links.filter((link) => link.label.trim() && link.url.trim() && validateUrl(link.url));

  await prisma.$transaction(async (tx) => {
    await tx.userLink.deleteMany({ where: { userId: user.id } });
    if (validLinks.length > 0) {
      await tx.userLink.createMany({
        data: validLinks.map((link) => ({
          userId: user.id,
          label: link.label.trim(),
          url: link.url.trim(),
        })),
      });
    }
  });

  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/settings");
  clearMeshCache(user.id);
  return { success: true };
}

// ─── User Interests Actions ─────────────────────────────────

export async function updateUserInterests(interests: string[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const uniqueInterests = [...new Set(interests)];

  await prisma.$transaction(async (tx) => {
    await tx.userInterest.deleteMany({ where: { userId: user.id } });
    if (uniqueInterests.length > 0) {
      await tx.userInterest.createMany({
        data: uniqueInterests.map((tag) => ({ userId: user.id, tag })),
      });
    }
  });

  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/settings");
  clearMeshCache(user.id);
  return { success: true };
}

// ─── Achievement Actions ────────────────────────────────────

export async function checkAndAwardAchievements() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const awarded: string[] = [];

  // Get user stats
  const [postCount, followerCount, communityCount, connectedCount, reactionCount, commentCount] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.communityMember.count({ where: { userId: user.id } }),
    prisma.connectedAccount.count({ where: { userId: user.id, isActive: true } }),
    prisma.reaction.count({ where: { userId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
  ]);

  // Check if user has created any communities
  const createdCommunity = await prisma.communityMember.findFirst({
    where: { userId: user.id, role: "admin" },
  });

  // Achievement checks
  const checks: { slug: string; condition: boolean }[] = [
    { slug: "first-post", condition: postCount >= 1 },
    { slug: "ten-posts", condition: postCount >= 10 },
    { slug: "hundred-posts", condition: postCount >= 100 },
    { slug: "first-follower", condition: followerCount >= 1 },
    { slug: "ten-followers", condition: followerCount >= 10 },
    { slug: "hundred-followers", condition: followerCount >= 100 },
    { slug: "thousand-followers", condition: followerCount >= 1000 },
    { slug: "first-community", condition: communityCount >= 1 },
    { slug: "community-creator", condition: !!createdCommunity },
    { slug: "platform-linker", condition: connectedCount >= 1 },
    { slug: "mesh-master", condition: connectedCount >= 5 },
    { slug: "verified", condition: user.isVerified },
    { slug: "customizer", condition: !!(user.bio || user.avatarUrl) },
    { slug: "helper", condition: reactionCount >= 50 },
    { slug: "conversationalist", condition: commentCount >= 25 },
  ];

  // Get existing achievements
  const existing = await prisma.userAchievement.findMany({
    where: { userId: user.id },
    include: { achievement: true },
  });
  const existingSlugs = new Set(existing.map((e) => e.achievement.slug));

  for (const check of checks) {
    if (check.condition && !existingSlugs.has(check.slug)) {
      // Find or create the achievement
      let achievement = await prisma.achievement.findUnique({ where: { slug: check.slug } });
      if (!achievement) {
        // Seed the achievement on first encounter
        const defs: Record<string, { name: string; description: string; icon: string; category: string; title: string; isLimited: boolean; maxHolders: number | null }> = {
          "first-post": { name: "First Words", description: "Created your first post", icon: "zap", category: "posts", title: "Creator", isLimited: false, maxHolders: null },
          "ten-posts": { name: "Getting Started", description: "Created 10 posts", icon: "star", category: "posts", title: "Active Creator", isLimited: false, maxHolders: null },
          "hundred-posts": { name: "Prolific", description: "Created 100 posts", icon: "trophy", category: "posts", title: "Prolific Creator", isLimited: false, maxHolders: null },
          "first-follower": { name: "Connected", description: "Got your first follower", icon: "users", category: "social", title: "Connected", isLimited: false, maxHolders: null },
          "ten-followers": { name: "Growing Network", description: "Reached 10 followers", icon: "users", category: "social", title: "Networker", isLimited: false, maxHolders: null },
          "hundred-followers": { name: "Community Builder", description: "Reached 100 followers", icon: "globe", category: "social", title: "Community Builder", isLimited: false, maxHolders: null },
          "thousand-followers": { name: "Influencer", description: "Reached 1,000 followers", icon: "star", category: "social", title: "Influencer", isLimited: false, maxHolders: null },
          "first-community": { name: "Community Member", description: "Joined your first community", icon: "message-circle", category: "communities", title: "Member", isLimited: false, maxHolders: null },
          "community-creator": { name: "Community Creator", description: "Created a community", icon: "globe", category: "communities", title: "Founder", isLimited: false, maxHolders: null },
          "platform-linker": { name: "Platform Linker", description: "Connected your first external platform", icon: "globe", category: "platforms", title: "Multi-Platform", isLimited: false, maxHolders: null },
          "mesh-master": { name: "Mesh Master", description: "Connected 5+ platforms", icon: "target", category: "platforms", title: "Mesh Master", isLimited: false, maxHolders: null },
          "verified": { name: "Verified", description: "Verified your mesh.me account", icon: "shield", category: "account", title: "Verified", isLimited: false, maxHolders: null },
          "customizer": { name: "Customizer", description: "Personalized your profile", icon: "sparkles", category: "account", title: "Customizer", isLimited: false, maxHolders: null },
          "helper": { name: "Helping Hand", description: "Liked 50 posts", icon: "heart", category: "engagement", title: "Helper", isLimited: false, maxHolders: null },
          "conversationalist": { name: "Conversationalist", description: "Left 25 comments", icon: "message-circle", category: "engagement", title: "Conversationalist", isLimited: false, maxHolders: null },
        };
        const def = defs[check.slug];
        if (def) {
          achievement = await prisma.achievement.create({
            data: { slug: check.slug, ...def },
          });
        }
      }
      if (achievement) {
        await prisma.userAchievement.create({
          data: { userId: user.id, achievementId: achievement.id },
        });
        awarded.push(check.slug);
      }
    }
  }

  // Check Pioneer achievement (first 1M verified users)
  // Uses a transaction to atomically check count + insert, preventing TOCTOU race
  if (user.isVerified && !existingSlugs.has("pioneer")) {
    let pioneer = await prisma.achievement.findUnique({ where: { slug: "pioneer" } });
    if (!pioneer) {
      pioneer = await prisma.achievement.create({
        data: {
          slug: "pioneer",
          name: "Pioneer",
          description: "Among the first 1 million verified mesh.me users",
          icon: "crown",
          category: "limited",
          title: "Pioneer",
          isLimited: true,
          maxHolders: 1000000,
        },
      });
    }
    const pioneerId = pioneer.id;
    const didAward = await prisma.$transaction(async (tx) => {
      const holderCount = await tx.userAchievement.count({
        where: { achievementId: pioneerId },
      });
      if (holderCount < 1000000) {
        await tx.userAchievement.create({
          data: { userId: user.id, achievementId: pioneerId },
        });
        return true;
      }
      return false;
    });
    if (didAward) {
      awarded.push("pioneer");
    }
  }

  return { success: true, awarded };
}

export async function getUserAchievements(userId: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const achievements = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });
  return achievements.map((ua) => ({
    slug: ua.achievement.slug,
    name: ua.achievement.name,
    title: ua.achievement.title,
    isLimited: ua.achievement.isLimited,
    unlockedAt: ua.unlockedAt,
  }));
}

export async function setActiveTitle(title: string | null) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  await prisma.user.update({
    where: { id: user.id },
    data: { activeTitle: title },
  });

  revalidatePath(`/profile/${user.username}`);
  return { success: true };
}

// ─── Meshi Customization Actions ────────────────────────────

const MESHI_OPTION_VALUES = {
  hats: new Set(["none", "tophat", "beanie", "cap", "party", "crown", "flower", "headphones", "halo", "wizard", "astronaut", "pirate", "chef"]),
  faces: new Set(["happy", "excited", "thinking", "sleepy", "surprised", "love", "cool", "wink", "searching", "learning", "celebrating", "shy", "giggle", "synergy1017"]),
  colors: new Set(["blue", "purple", "pink", "green", "orange", "cyan", "gold", "rainbow", "crimson", "midnight", "rose", "emerald", "arctic", "obsidian"]),
  hairs: new Set(["none", "fluffy", "bangs", "spikes", "curls"]),
  accessories: new Set(["none", "glasses", "sunglasses", "monocle"]),
  eyes: new Set(["regular", "lashes"]),
  badges: new Set(["none", "spark", "heart", "shield", "verified", "creator", "founder"]),
  outfits: new Set(["none", "scarf", "hoodie", "jacket", "overalls", "cape", "spacesuit"]),
};

function cleanMeshiOption(value: string | undefined, allowed: Set<string>, fallback?: string) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

type MeshiPreferenceUpdate = {
  hatStyle?: string;
  faceStyle?: string;
  colorTheme?: string;
  hairStyle?: string;
  accessoryStyle?: string;
  eyeStyle?: string;
  badgeStyle?: string;
  outfitStyle?: string;
};

const DEFAULT_MESHI_PREFERENCE = {
  hatStyle: "none",
  faceStyle: "happy",
  colorTheme: "blue",
  hairStyle: "none",
  accessoryStyle: "none",
  eyeStyle: "regular",
  badgeStyle: "none",
  outfitStyle: "none",
};

function findLockedMeshiOptionForFreeUser(next: Partial<Record<keyof MeshiPreferenceUpdate, string | undefined>>) {
  const checks: Array<[keyof MeshiPreferenceUpdate, keyof typeof FREE_MESHI_OPTIONS, string]> = [
    ["hatStyle", "hats", "hat"],
    ["faceStyle", "faces", "expression"],
    ["colorTheme", "colors", "color"],
    ["hairStyle", "hairs", "hair"],
    ["accessoryStyle", "accessories", "accessory"],
    ["eyeStyle", "eyes", "eyes"],
    ["badgeStyle", "badges", "badge"],
    ["outfitStyle", "outfits", "outfit"],
  ];

  return checks.find(([field, group]) => {
    const value = next[field];
    return value ? !isFreeMeshiOption(group, value) : false;
  })?.[2];
}

export async function updateMeshiPreference(data: MeshiPreferenceUpdate) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const next = {
    hatStyle: cleanMeshiOption(data.hatStyle, MESHI_OPTION_VALUES.hats),
    faceStyle: cleanMeshiOption(data.faceStyle, MESHI_OPTION_VALUES.faces),
    colorTheme: cleanMeshiOption(data.colorTheme, MESHI_OPTION_VALUES.colors),
    hairStyle: cleanMeshiOption(data.hairStyle, MESHI_OPTION_VALUES.hairs),
    accessoryStyle: cleanMeshiOption(data.accessoryStyle, MESHI_OPTION_VALUES.accessories),
    eyeStyle: cleanMeshiOption(data.eyeStyle, MESHI_OPTION_VALUES.eyes),
    badgeStyle: cleanMeshiOption(data.badgeStyle, MESHI_OPTION_VALUES.badges),
    outfitStyle: cleanMeshiOption(data.outfitStyle, MESHI_OPTION_VALUES.outfits),
  };

  if (!user.isMeshPro) {
    const lockedOption = findLockedMeshiOptionForFreeUser(next);
    if (lockedOption) {
      return { error: `Mesh Pro is required for that Meshi ${lockedOption}.` };
    }
  }

  await prisma.meshiPreference.upsert({
    where: { userId: user.id },
    update: {
      hatStyle: next.hatStyle,
      faceStyle: next.faceStyle,
      colorTheme: next.colorTheme,
      hairStyle: next.hairStyle,
      accessoryStyle: next.accessoryStyle,
      eyeStyle: next.eyeStyle,
      badgeStyle: next.badgeStyle,
      outfitStyle: next.outfitStyle,
    },
    create: {
      userId: user.id,
      hatStyle: next.hatStyle ?? DEFAULT_MESHI_PREFERENCE.hatStyle,
      faceStyle: next.faceStyle ?? DEFAULT_MESHI_PREFERENCE.faceStyle,
      colorTheme: next.colorTheme ?? DEFAULT_MESHI_PREFERENCE.colorTheme,
      hairStyle: next.hairStyle ?? DEFAULT_MESHI_PREFERENCE.hairStyle,
      accessoryStyle: next.accessoryStyle ?? DEFAULT_MESHI_PREFERENCE.accessoryStyle,
      eyeStyle: next.eyeStyle ?? DEFAULT_MESHI_PREFERENCE.eyeStyle,
      badgeStyle: next.badgeStyle ?? DEFAULT_MESHI_PREFERENCE.badgeStyle,
      outfitStyle: next.outfitStyle ?? DEFAULT_MESHI_PREFERENCE.outfitStyle,
    },
  });

  revalidatePath("/mesh");
  revalidatePath("/settings");
  clearMeshCache(user.id);
  return { success: true };
}

export async function getMeshiPreference() {
  const user = await getCurrentUser();
  if (!user) return null;

  const pref = await prisma.meshiPreference.findUnique({
    where: { userId: user.id },
  });

  return pref || DEFAULT_MESHI_PREFERENCE;
}

// Get another user's Meshi preference (for social Meshi on their mesh nodes)
export async function getUserMeshiPreference(userId: string) {
  if (!userId) return null;

  const pref = await prisma.meshiPreference.findUnique({
    where: { userId },
  });

  return pref
    ? {
        hatStyle: pref.hatStyle,
        faceStyle: pref.faceStyle,
        colorTheme: pref.colorTheme,
        hairStyle: pref.hairStyle,
        accessoryStyle: pref.accessoryStyle,
        eyeStyle: pref.eyeStyle,
        badgeStyle: pref.badgeStyle,
        outfitStyle: pref.outfitStyle,
      }
    : null;
}

// ─── Mesh Cosmetics Actions ─────────────────────────────────

export async function updateMeshCosmetics(cosmetics: { type: string; value: string; isActive: boolean }[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!user.isMeshPro) return { error: "Mesh Pro is required for custom Mesh visuals." };

  await prisma.$transaction(async (tx) => {
    await tx.meshCosmetic.deleteMany({ where: { userId: user.id } });
    if (cosmetics.length > 0) {
      await tx.meshCosmetic.createMany({
        data: cosmetics.map((c) => ({ userId: user.id, type: c.type, value: c.value, isActive: c.isActive })),
      });
    }
  });

  revalidatePath("/mesh");
  revalidatePath("/settings");
  clearMeshCache(user.id);
  return { success: true };
}

export async function getMeshCosmetics(userId?: string) {
  const user = userId ? { id: userId } : await getCurrentUser();
  if (!user) return [];

  return prisma.meshCosmetic.findMany({
    where: { userId: user.id, isActive: true },
  });
}

// ─── Mesh Privacy Actions ───────────────────────────────────

export async function updateMeshPrivacy(data: {
  meshVisibility: string;
  branchOverrides?: Record<string, string>;
  showConnections?: boolean;
  showStats?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const validVisibilities = ["private", "friends", "public", "partial"];
  if (!validVisibilities.includes(data.meshVisibility)) {
    return { error: "Invalid visibility setting" };
  }

  await prisma.meshPrivacy.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      meshVisibility: data.meshVisibility,
      branchOverrides: JSON.stringify(data.branchOverrides || {}),
      showConnections: data.showConnections ?? false,
      showStats: data.showStats ?? false,
    },
    update: {
      meshVisibility: data.meshVisibility,
      branchOverrides: JSON.stringify(data.branchOverrides || {}),
      showConnections: data.showConnections ?? false,
      showStats: data.showStats ?? false,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/privacy-controls");
  revalidatePath("/mesh");
  clearMeshCache(user.id);
  return { success: true };
}

// ─── Global Mesh Actions ────────────────────────────────────

export async function optIntoGlobalMesh(sharedBranches: string[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const validBranches = ["people", "communities", "interests", "platforms"];
  const filtered = sharedBranches.filter((b) => validBranches.includes(b));

  await prisma.globalMeshMember.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      isActive: true,
      sharedBranches: JSON.stringify(filtered),
    },
    update: {
      isActive: true,
      sharedBranches: JSON.stringify(filtered),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/mesh");
  clearMeshCache(user.id);
  return { success: true };
}

export async function optOutOfGlobalMesh() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  await prisma.globalMeshMember.upsert({
    where: { userId: user.id },
    create: { userId: user.id, isActive: false, sharedBranches: "[]" },
    update: { isActive: false },
  });

  revalidatePath("/settings");
  revalidatePath("/mesh");
  clearMeshCache(user.id);
  return { success: true };
}

export async function updateGlobalMeshBranches(sharedBranches: string[]) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const validBranches = ["people", "communities", "interests", "platforms"];
  const filtered = sharedBranches.filter((b) => validBranches.includes(b));

  await prisma.globalMeshMember.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      isActive: true,
      sharedBranches: JSON.stringify(filtered),
    },
    update: { sharedBranches: JSON.stringify(filtered) },
  });

  revalidatePath("/settings");
  return { success: true };
}

// ─── Redeem Code Actions ─────────────────────────────────────

export async function redeemCode(code: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  if (!code?.trim()) return { error: "Please enter a code" };

  const trimmed = code.trim();

  // Rate limit redemption attempts
  const rl = rateLimit(`redeem:${user.id}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  // Auto-seed known codes if they don't exist yet
  const knownCodes = [
    {
      code: "Synergy1017Me",
      rewardType: "meshi-face",
      rewardValue: "synergy1017",
      rewardLabel: "Synergy1017 Wink",
    },
    {
      code: "wetrab-hIzviz-3xonju",
      rewardType: "meshpro",
      rewardValue: "free",
      rewardLabel: "MeshPro Access",
    },
  ];
  for (const known of knownCodes) {
    const exists = await prisma.redeemCode.findUnique({ where: { code: known.code } });
    if (!exists) {
      await prisma.redeemCode.create({ data: known }).catch((e) => {
        if (!(e && typeof e === "object" && "code" in e && e.code === "P2002")) throw e;
      });
    }
  }

  // Look up the code
  const redeemRecord = await prisma.redeemCode.findUnique({ where: { code: trimmed } });
  if (!redeemRecord) {
    return { error: "Invalid code" };
  }

  // Atomically claim the code so concurrent redemption attempts cannot both win.
  const claimed = await prisma.redeemCode.updateMany({
    where: { id: redeemRecord.id, redeemedBy: null },
    data: {
      redeemedBy: user.id,
      redeemedAt: new Date(),
    },
  });
  if (claimed.count !== 1) {
    return { error: "This code has already been used" };
  }

  // Grant the cosmetic reward to the user
  if (redeemRecord.rewardType === "meshi-face") {
    await prisma.meshCosmetic.create({
      data: {
        userId: user.id,
        type: "face",
        value: redeemRecord.rewardValue,
        isActive: true,
      },
    });

    // Also set it as the user's active Meshi face
    await prisma.meshiPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, faceStyle: redeemRecord.rewardValue },
      update: { faceStyle: redeemRecord.rewardValue },
    });
  }
  if (redeemRecord.rewardType === "meshpro") {
    await prisma.user.update({
      where: { id: user.id },
      data: { isMeshPro: true },
    });
  }

  revalidatePath("/settings");
  clearMeshCache(user.id);
  return {
    success: true,
    reward: {
      type: redeemRecord.rewardType,
      value: redeemRecord.rewardValue,
      label: redeemRecord.rewardLabel,
    },
  };
}

// Check if user has unlocked a specific cosmetic
export async function getUserUnlockedCosmetics() {
  const user = await getCurrentUser();
  if (!user) return { cosmetics: [] };

  const cosmetics = await prisma.meshCosmetic.findMany({
    where: { userId: user.id },
    select: { type: true, value: true, isActive: true },
  });

  return { cosmetics };
}
