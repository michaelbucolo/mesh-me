import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { diagnoseCredentialCiphertexts, type CredentialRecoveryDiagnostic } from "./credential-recovery-diagnostics";

export const CREDENTIAL_AUDIT_LIMITS = { maxPayloads: 2000, maxPayloadBytes: 32768, maxTotalBytes: 8388608 } as const;
const ciphertextFields = Prisma.sql`
  SELECT accessToken AS value FROM ConnectedAccount WHERE substr(accessToken, 1, 7) = 'enc:v1:'
  UNION ALL
  SELECT refreshToken AS value FROM ConnectedAccount WHERE substr(refreshToken, 1, 7) = 'enc:v1:'
  UNION ALL
  SELECT secret AS value FROM TwoFactorMethod WHERE substr(secret, 1, 7) = 'enc:v1:'
`;

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
  recovery: CredentialRecoveryDiagnostic;
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
    // Reads share a snapshot and include inactive/disabled records. Count and
    // byte limits are checked before ciphertext enters server memory.
    const snapshot = await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<AggregateRow[]>`
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
      const expected = count(row.accessCiphertext) + count(row.refreshCiphertext) + count(row.secretCiphertext);
      const [bounds] = await tx.$queryRaw<Array<{ payloads: number | bigint; totalBytes: number | bigint; largestBytes: number | bigint }>>`
        SELECT COUNT(*) AS payloads, COALESCE(SUM(length(CAST(value AS BLOB))), 0) AS totalBytes,
          COALESCE(MAX(length(CAST(value AS BLOB))), 0) AS largestBytes FROM (${ciphertextFields})
      `;
      if (!bounds || count(bounds.payloads) !== expected) throw new Error("Incomplete credential snapshot");
      const totalBytes = count(bounds.totalBytes);
      if (expected > CREDENTIAL_AUDIT_LIMITS.maxPayloads || count(bounds.largestBytes) > CREDENTIAL_AUDIT_LIMITS.maxPayloadBytes || totalBytes > CREDENTIAL_AUDIT_LIMITS.maxTotalBytes) {
        return { row, payloads: null };
      }
      const values = await tx.$queryRaw<Array<{ value: string }>>`
        SELECT value FROM (${ciphertextFields}) WHERE length(CAST(value AS BLOB)) <= ${CREDENTIAL_AUDIT_LIMITS.maxPayloadBytes}
        LIMIT ${CREDENTIAL_AUDIT_LIMITS.maxPayloads + 1}
      `;
      if (values.length !== expected || values.some(({ value }) => typeof value !== "string")) throw new Error("Incomplete credential payload scan");
      const payloads = values.map(({ value }) => value);
      if (payloads.reduce((sum, value) => sum + Buffer.byteLength(value, "utf8"), 0) !== totalBytes) throw new Error("Incomplete credential byte scan");
      return { row, payloads };
    });
    const { row } = snapshot;
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
      detail: "This audit covers the three credential fields below, including inactive connections and disabled two-factor methods. The prefix count does not verify decryption or determine whether key replacement is safe. The separate read-only scan reports authentication results only for a complete bounded snapshot. No rotation or migration is performed. Backups and external copies are not checked.",
      connectedAccounts: { totalRows: accountRows, inactiveRows, accessToken, refreshToken },
      twoFactorMethods: { totalRows: methodRows, secret },
      recovery: snapshot.payloads === null
        ? { status: "not_scanned", reason: "The complete ciphertext set exceeds diagnostic limits (2,000 payloads, 32 KiB each, 8 MiB total). No ciphertext was fetched and no keys were tested." }
        : diagnoseCredentialCiphertexts(snapshot.payloads),
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
      recovery: { status: "not_scanned", reason: "The database snapshot could not be read completely. No recovery conclusion is available." },
    };
  }
}
