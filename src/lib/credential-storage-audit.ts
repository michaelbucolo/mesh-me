import "server-only";
import { prisma } from "./prisma";

type PayloadCounts = { empty: number; ciphertext: number; otherNonempty: number };

export type CredentialStorageAudit = {
  status: "empty" | "payloads_present" | "unavailable";
  checkedAt: string;
  summary: string;
  detail: string;
  connectedAccounts: null | {
    totalRows: number;
    inactiveRows: number;
    accessToken: PayloadCounts;
    refreshToken: PayloadCounts;
  };
  twoFactorMethods: null | { totalRows: number; secret: PayloadCounts };
};

type AggregateRow = Record<
  "accountRows" | "inactiveRows" | "accessEmpty" | "accessCiphertext" | "accessOther" |
  "refreshEmpty" | "refreshCiphertext" | "refreshOther" | "methodRows" |
  "secretEmpty" | "secretCiphertext" | "secretOther",
  number | bigint
>;

function count(value: number | bigint): number {
  const result = Number(value);
  if ((typeof value !== "number" && typeof value !== "bigint") || !Number.isSafeInteger(result) || result < 0) {
    throw new Error("Invalid credential aggregate count");
  }
  return result;
}

function payloadCounts(total: number, empty: number | bigint, ciphertext: number | bigint, other: number | bigint): PayloadCounts {
  const counts = { empty: count(empty), ciphertext: count(ciphertext), otherNonempty: count(other) };
  if (counts.empty + counts.ciphertext + counts.otherNonempty !== total) {
    throw new Error("Incomplete credential aggregate counts");
  }
  return counts;
}

// Called only after getAdminDashboard's isAdmin check. This is a server-only
// helper, not a server action: no unauthenticated route exposes these counts.
export async function getCredentialStorageAudit(): Promise<CredentialStorageAudit> {
  try {
    // One statement gives all counts from the same database snapshot. No row
    // filter: inactive connections and disabled/legacy 2FA records also matter.
    // Credentials stay inside the database; only aggregate numbers are returned.
    const [row] = await prisma.$queryRaw<AggregateRow[]>`
      SELECT accounts.*, methods.*
      FROM (
        SELECT COUNT(*) AS accountRows,
          COUNT(CASE WHEN isActive = 0 THEN 1 END) AS inactiveRows,
          COUNT(CASE WHEN accessToken IS NULL OR accessToken = '' THEN 1 END) AS accessEmpty,
          COUNT(CASE WHEN substr(accessToken, 1, 7) = 'enc:v1:' THEN 1 END) AS accessCiphertext,
          COUNT(CASE WHEN accessToken IS NOT NULL AND accessToken <> '' AND substr(accessToken, 1, 7) <> 'enc:v1:' THEN 1 END) AS accessOther,
          COUNT(CASE WHEN refreshToken IS NULL OR refreshToken = '' THEN 1 END) AS refreshEmpty,
          COUNT(CASE WHEN substr(refreshToken, 1, 7) = 'enc:v1:' THEN 1 END) AS refreshCiphertext,
          COUNT(CASE WHEN refreshToken IS NOT NULL AND refreshToken <> '' AND substr(refreshToken, 1, 7) <> 'enc:v1:' THEN 1 END) AS refreshOther
        FROM ConnectedAccount
      ) AS accounts
      CROSS JOIN (
        SELECT COUNT(*) AS methodRows,
          COUNT(CASE WHEN secret IS NULL OR secret = '' THEN 1 END) AS secretEmpty,
          COUNT(CASE WHEN substr(secret, 1, 7) = 'enc:v1:' THEN 1 END) AS secretCiphertext,
          COUNT(CASE WHEN secret IS NOT NULL AND secret <> '' AND substr(secret, 1, 7) <> 'enc:v1:' THEN 1 END) AS secretOther
        FROM TwoFactorMethod
      ) AS methods
    `;
    if (!row) throw new Error("Missing credential aggregate counts");
    const accountRows = count(row.accountRows);
    const inactiveRows = count(row.inactiveRows);
    if (inactiveRows > accountRows) throw new Error("Invalid inactive account count");
    const methodRows = count(row.methodRows);
    const accessToken = payloadCounts(accountRows, row.accessEmpty, row.accessCiphertext, row.accessOther);
    const refreshToken = payloadCounts(accountRows, row.refreshEmpty, row.refreshCiphertext, row.refreshOther);
    const secret = payloadCounts(methodRows, row.secretEmpty, row.secretCiphertext, row.secretOther);
    const hasPayloads = [accessToken, refreshToken, secret].some((counts) => counts.ciphertext > 0 || counts.otherNonempty > 0);

    return {
      status: hasPayloads ? "payloads_present" : "empty",
      checkedAt: new Date().toISOString(),
      summary: hasPayloads
        ? "Stored credential payloads require review before changing the encryption key."
        : "No currently stored credential payloads were found.",
      detail: "This audit covers the three credential fields below, including inactive connections and disabled two-factor methods. It does not verify decryption or determine whether key replacement is safe. Backups and external copies are not checked.",
      connectedAccounts: { totalRows: accountRows, inactiveRows, accessToken, refreshToken },
      twoFactorMethods: { totalRows: methodRows, secret },
    };
  } catch {
    // A failed or incomplete read must never look like an empty database.
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString(),
      summary: "Credential storage could not be checked.",
      detail: "No conclusion about stored payloads or encryption-key replacement can be drawn. Retry the audit after database access is restored. Backups and external copies are not checked.",
      connectedAccounts: null,
      twoFactorMethods: null,
    };
  }
}
