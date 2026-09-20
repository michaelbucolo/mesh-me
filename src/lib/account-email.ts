import "server-only";

type AccountEmailKind = "password-reset" | "email-verification";
type AccountEmail = { to: string; subject: string; text: string; html: string };

async function sendAccountEmail(kind: AccountEmailKind, message: AccountEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const resetFrom = process.env.PASSWORD_RESET_FROM_EMAIL?.trim();
  const defaultFrom = process.env.RESEND_FROM_EMAIL?.trim();
  const from = kind === "password-reset"
    ? resetFrom || defaultFrom
    : process.env.EMAIL_VERIFICATION_FROM_EMAIL?.trim() || defaultFrom || resetFrom;
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, ...message }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      // Provider bodies can contain addresses, links, or other private data.
      console.error("Account email provider rejected the request", { kind, status: response.status });
      return false;
    }
    return true;
  } catch {
    // Public recovery keeps the same response during provider outages.
    console.error("Account email delivery unavailable", { kind });
    return false;
  }
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

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const safeResetUrl = escapeEmailHtml(resetUrl);
  return sendAccountEmail("password-reset", {
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
  });
}

export async function sendEmailVerificationEmail(to: string, verificationUrl: string) {
  const safeVerificationUrl = escapeEmailHtml(verificationUrl);
  return sendAccountEmail("email-verification", {
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
  });
}
