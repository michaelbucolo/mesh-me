import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getAnalyticsReport } from "@/lib/analytics-report-loader";
import { getCurrentUser } from "@/lib/auth";
import { meshBrand } from "@/lib/brand";
import { rateLimit } from "@/lib/security";

/**
 * GET /api/analytics/report/card?period=2026-07 — the report's headline
 * numbers as a 1200x630 PNG, for the person who would rather drop one image
 * in a chat than attach a document. Same fences as the document: MeshPro,
 * consent, the requester's own aggregates and nothing else. `ImageResponse`
 * is the same zero-dependency renderer the opengraph image already ships.
 *
 * Built with createElement rather than JSX so this stays a plain route.ts.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!rateLimit(`report-card:${user.id}`, 12, 60_000).allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const result = await getAnalyticsReport(searchParams.get("period"));

  switch (result.status) {
    case "unauthenticated":
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    case "consent-withheld":
      return NextResponse.json(
        { error: "Your privacy rules say Mesh.me may not process your activity into analytics." },
        { status: 403 },
      );
    case "not-pro":
      return NextResponse.json({ error: "The Mesh Report is a MeshPro document." }, { status: 403 });
    case "invalid-period":
      return NextResponse.json(
        { error: "Reports cover a fully ended month (period=2026-07) or year (period=2025)." },
        { status: 400 },
      );
  }

  const { report } = result;
  const colors = meshBrand.colors;
  const pick = (id: string) => report.totals.find((row) => row.id === id);
  const headline = [pick("views"), pick("engagement"), pick("followersGained")].filter(
    (row): row is NonNullable<typeof row> => Boolean(row),
  );

  const stat = (label: string, value: number, delta: number | null) =>
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("div", { style: { display: "flex", fontSize: 24, opacity: 0.65 } }, label),
      h("div", { style: { display: "flex", fontSize: 64, fontWeight: 700 } }, value.toLocaleString("en-US")),
      h(
        "div",
        { style: { display: "flex", fontSize: 26, opacity: delta == null ? 0.5 : 0.9 } },
        delta == null ? "no prior period" : `${delta >= 0 ? "+" : ""}${delta.toLocaleString("en-US")} vs previous`,
      ),
    );

  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: colors.ink,
          color: colors.white,
          fontFamily: "Georgia, serif",
        },
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        h("div", { style: { display: "flex", fontSize: 26, opacity: 0.7 } }, "The Mesh Report"),
        h("div", { style: { display: "flex", fontSize: 58, fontWeight: 700 } }, report.period.label),
        h("div", { style: { display: "flex", fontSize: 26, opacity: 0.75 } }, `@${user.username} — own data only`),
      ),
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", gap: 48 } },
        ...headline.map((row) => stat(row.label, row.current, row.delta)),
      ),
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", fontSize: 24, opacity: 0.6 } },
        h("div", { style: { display: "flex" } }, meshBrand.name),
        h("div", { style: { display: "flex" } }, report.period.kind === "month" ? "One month, closed and set" : "One year, closed and set"),
      ),
    ),
    { width: 1200, height: 630 },
  );
}
