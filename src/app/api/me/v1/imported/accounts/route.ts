import { importedAccountsResource, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withPersonalToken(req, "imported:read", async (auth) => {
    return { body: { data: await importedAccountsResource(auth.userId) } };
  });
}
