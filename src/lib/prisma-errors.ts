// Prisma / libSQL error classification helpers.
//
// The unique-constraint error shape differs by transport. Against a local
// file: database the Prisma runtime raises PrismaClientKnownRequestError with
// code "P2002". Against the production remote Turso instance the violation
// travels over the Hrana protocol, which never transmits the numeric SQLite
// extended code, so @prisma/adapter-libsql cannot map it to P2002 and the
// runtime rethrows a raw DriverAdapterError whose message contains
// "UNIQUE constraint failed" and which carries no `code` property at all.
// Callers must recognize both, or duplicate-key handling that works in dev
// silently 500s in production.

export function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  if ("code" in error && (error as { code?: unknown }).code === "P2002") {
    return true;
  }

  const err = error as {
    message?: unknown;
    cause?: { message?: unknown; originalMessage?: unknown } | null;
  };
  const parts: string[] = [];
  if (typeof err.message === "string") parts.push(err.message);
  if (err.cause && typeof err.cause === "object") {
    if (typeof err.cause.message === "string") parts.push(err.cause.message);
    if (typeof err.cause.originalMessage === "string") parts.push(err.cause.originalMessage);
  }

  return /unique constraint failed/i.test(parts.join(" "));
}
