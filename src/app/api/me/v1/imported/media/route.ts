import { importedMediaPage, pageParams, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withPersonalToken(req, "imported:read", async (auth, r) => {
    const { limit, cursorId } = pageParams(r);
    return { body: await importedMediaPage(auth.userId, cursorId, limit) };
  });
}
