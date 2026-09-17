import "dotenv/config";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("Set DATABASE_URL explicitly. No default database is used for cleanup.");
  const { prisma } = await import("../src/lib/prisma");
  const { reviewTestAccounts, deleteVerifiedTestAccount } = await import("../src/lib/fixture-cleanup");
  try {
    const id = process.argv.find((arg) => arg.startsWith("--delete-id="))?.slice(12);
    const username = process.argv.find((arg) => arg.startsWith("--confirm-username="))?.slice(19);
    if (!id) {
      console.log(JSON.stringify({ mode: "review", accounts: await reviewTestAccounts() }, null, 2));
      return;
    }
    const result = await deleteVerifiedTestAccount(id, username ?? "");
    if ("error" in result) throw new Error(result.error);
    console.log(`Deleted verified fixture @${username} and its cascading content.`);
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Cleanup failed"); process.exitCode = 1; });
