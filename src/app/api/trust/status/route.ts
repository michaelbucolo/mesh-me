import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    trust: {
      secureTransportRequired: true,
      policyLinks: {
        trustCenter: "/trust",
        privacy: "/privacy",
        terms: "/terms",
      },
      principles: [
        "privacy-first",
        "api-and-terms-compliance",
        "security-hardened-headers",
      ],
      generatedAt: new Date().toISOString(),
    },
  });
}

