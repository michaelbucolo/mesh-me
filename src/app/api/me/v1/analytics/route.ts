import { analyticsPage, pageParams, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

// Stored snapshot rows on ownership alone — the same posture as the data
// export. The computed dashboard is not exposed at v1.
export async function GET(req: Request) {
  return withPersonalToken(req, "analytics:read", async (auth, r) => {
    const { limit, cursorId } = pageParams(r);
    return { body: await analyticsPage(auth.userId, cursorId, limit) };
  });
}
