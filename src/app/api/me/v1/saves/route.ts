import { pageParams, savesPage, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withPersonalToken(req, "posts:read", async (auth, r) => {
    const { limit, cursorId } = pageParams(r);
    return { body: await savesPage(auth.userId, cursorId, limit) };
  });
}
