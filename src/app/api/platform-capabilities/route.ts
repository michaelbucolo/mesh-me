import { NextResponse } from "next/server";
import { getPlatformCapabilitiesSnapshot } from "@/lib/platform-capabilities";

export async function GET() {
  return NextResponse.json(getPlatformCapabilitiesSnapshot());
}
