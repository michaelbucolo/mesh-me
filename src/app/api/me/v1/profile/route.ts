import { profileResource, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withPersonalToken(req, "profile:read", async (auth) => {
    const profile = await profileResource(auth.userId);
    if (!profile) return { body: { error: "Not found.", code: "not-found" }, status: 404 };
    return { body: { data: profile } };
  });
}
