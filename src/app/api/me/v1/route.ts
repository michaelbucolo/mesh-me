import { PAT_RESOURCES, withPersonalToken } from "@/lib/me-api";
import { introspectPersonalAccessToken } from "@/lib/personal-access-token";

export const dynamic = "force-dynamic";

// Introspection: what THIS token is, and the index of what it can reach.
export async function GET(req: Request) {
  return withPersonalToken(req, null, async (auth) => {
    const token = await introspectPersonalAccessToken(auth.tokenId);
    return {
      body: {
        data: {
          name: token?.name ?? null,
          fingerprint: token?.selector ?? null,
          scopes: auth.scopes,
          expiresAt: token?.expiresAt ?? null,
          resources: PAT_RESOURCES,
        },
      },
    };
  });
}
