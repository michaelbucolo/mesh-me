import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";
import {
  listPersonalAccessTokens,
  mintPersonalAccessToken,
  parsePatScopes,
  renamePersonalAccessToken,
  revokePersonalAccessToken,
} from "@/lib/personal-access-token";

// THE TOKEN DESK — session side, the meshi/memory pattern: same-origin +
// getCurrentUser + both limiters, adjudication before the switch. This is
// the ONLY place a token is minted; a token can never mint tokens (the
// /api/me tree has no session and no POST).
//
// The full token string leaves the server exactly once, in the create
// response. Minting is durable-limited well below the burst limiter —
// token churn is a compromise signal, not a workload.

export async function GET(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tokens: await listPersonalAccessTokens(user.id) });
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = rateLimit(`api-tokens:${user.id}`, 30, 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
    const durableRl = await durableRateLimit(`api-tokens:${user.id}`, 30, 60 * 1000);
    if (!durableRl.allowed) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });

    const body = (await readJsonObject(req)) as {
      action?: "create" | "revoke" | "rename";
      name?: string;
      scopes?: string[];
      expiryDays?: number;
      tokenId?: string;
    };

    switch (body.action) {
      case "create": {
        const mint = await durableRateLimit(`pat:mint:${user.id}`, 5, 24 * 60 * 60 * 1000);
        if (!mint.allowed) {
          return NextResponse.json(
            { error: "Five new tokens a day is the ceiling — churn like this usually means something's wrong." },
            { status: 429 },
          );
        }
        const result = await mintPersonalAccessToken(user.id, {
          name: String(body.name ?? ""),
          scopes: parsePatScopes(body.scopes),
          expiryDays: body.expiryDays,
        });
        if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

        // Exactly one quiet notification, ever: the mint itself. If it
        // wasn't you, the panel is one tap away and revocation is instant.
        // The fingerprint, not the user-chosen name: the name is free text,
        // and a scare-notification must point at the row the panel shows.
        const message = `An API token (mesh_pat_${result.selector}…) was just created on your account. Not you? Revoke it in Privacy Controls.`;
        await prisma.notification
          .create({ data: { type: "api_token", recipientId: user.id, message } })
          .catch(() => {});

        return NextResponse.json({
          ok: true,
          token: result.token,
          id: result.id,
          selector: result.selector,
          expiresAt: result.expiresAt,
        });
      }
      case "revoke": {
        const revoked = await revokePersonalAccessToken(user.id, String(body.tokenId ?? ""));
        if (!revoked) return NextResponse.json({ error: "That token is already gone." }, { status: 404 });
        return NextResponse.json({ ok: true });
      }
      case "rename": {
        const renamed = await renamePersonalAccessToken(user.id, String(body.tokenId ?? ""), String(body.name ?? ""));
        if (!renamed) return NextResponse.json({ error: "Could not rename that token." }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("API token desk error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
