#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";

// An operator must explicitly configure this on the main production deployment.
// No HTTP request, signup, password or client-supplied value can invoke it.
const username = process.env.MESH_BOOTSTRAP_ADMIN_USERNAME?.trim();
if (!username) process.exit(0);

class OwnerSetupError extends Error {}

async function main() {
  if (process.env.VERCEL_ENV !== "production" || process.env.VERCEL_GIT_COMMIT_REF !== "main") {
    throw new OwnerSetupError("Owner setup is restricted to the main production deployment.");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username) || !databaseUrl) {
    throw new OwnerSetupError("Owner setup requires an exact existing username and a configured database.");
  }
  const client = createClient({ url: databaseUrl, authToken });
  let tx;
  try {
    tx = await client.transaction("write");
    const { rows } = await tx.execute({
      sql: 'SELECT id, username, isAdmin, isSuspended FROM "User" WHERE username = ?', args: [username],
    });
    const user = rows[0];
    if (!user || user.isSuspended) throw new OwnerSetupError("Owner setup requires an existing, active account.");
    if (user.isAdmin) {
      await tx.rollback();
      console.log("[owner-setup] Account is already an administrator. Remove MESH_BOOTSTRAP_ADMIN_USERNAME from deployment settings.");
      return;
    }
    const admins = await tx.execute('SELECT id FROM "User" WHERE isAdmin = 1 LIMIT 1');
    const previousSetup = await tx.execute('SELECT id FROM "AdminLog" WHERE action = \'bootstrap_owner_admin\' LIMIT 1');
    if (admins.rows.length || previousSetup.rows.length) {
      throw new OwnerSetupError("An administrator or previous owner setup already exists. Use an authorized administrative workflow.");
    }
    const promoted = await tx.execute({
      sql: 'UPDATE "User" SET isAdmin = 1, updatedAt = ? WHERE id = ? AND username = ? AND isAdmin = 0 AND isSuspended = 0',
      args: [Date.now(), user.id, username],
    });
    if (promoted.rowsAffected !== 1) throw new OwnerSetupError("The account changed during setup; no role was granted.");
    await tx.execute({
      sql: 'INSERT INTO "AdminLog" (id, action, details, adminId, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [randomUUID(), "bootstrap_owner_admin", "Initial owner role granted through production deployment configuration.", user.id, Date.now()],
    });
    await tx.commit();
    console.log("[owner-setup] Existing owner account granted administrator access. Remove MESH_BOOTSTRAP_ADMIN_USERNAME from deployment settings.");
  } finally {
    if (tx && !tx.closed) await tx.rollback();
    client.close();
  }
}

main().catch((error) => {
  // Upstream errors can include a connection URL or Authorization header.
  // Only our own fixed operational messages are safe for deployment logs.
  console.error(`[owner-setup] ${error instanceof OwnerSetupError ? error.message : "Database operation failed. Check the connection configuration; credential details have been withheld."}`);
  process.exitCode = 1;
});
