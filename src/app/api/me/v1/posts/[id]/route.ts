import { postResource, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

// Owner-pinned lookup: a post that is not yours and a post that does not
// exist are the SAME 404, by query construction rather than comparison.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withPersonalToken(req, "posts:read", async (auth) => {
    const post = await postResource(auth.userId, id);
    if (!post) return { body: { error: "Not found.", code: "not-found" }, status: 404 };
    return { body: { data: post } };
  });
}
