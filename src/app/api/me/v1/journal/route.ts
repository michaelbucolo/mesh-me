import { journalResource, withPersonalToken } from "@/lib/me-api";

export const dynamic = "force-dynamic";

// Through listJournal only: grant re-read per request; no grant answers
// 200 {granted:false} — the owner's true state, never an error.
export async function GET(req: Request) {
  return withPersonalToken(req, "journal:read", async (auth) => {
    return { body: { data: await journalResource(auth.userId) } };
  });
}
