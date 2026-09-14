/** @param {import('@libsql/client').Client} client */
export async function normalizeLegacyCommunityAudience(client) {
  const marker = "explicit-community-audience-20260914";
  // A retried build must never reinterpret a newly published Only me post.
  // SQLite serializes this write transaction across concurrent deployments.
  await client.batch([
    "CREATE TABLE IF NOT EXISTS _MeshDataMigration (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)",
    { sql: "UPDATE Post SET visibility = 'community' WHERE communityId IS NOT NULL AND visibility = 'private' AND NOT EXISTS (SELECT 1 FROM _MeshDataMigration WHERE id = ?)", args: [marker] },
    { sql: "INSERT OR IGNORE INTO _MeshDataMigration (id, appliedAt) VALUES (?, ?)", args: [marker, new Date().toISOString()] },
  ], "write");
}
