import { importedPostsPage, pageParams, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withPersonalToken(req, "imported:read", async (auth, r) => {
    const { limit, cursorId } = pageParams(r);
    return { body: await importedPostsPage(auth.userId, cursorId, limit) };
  });
}
