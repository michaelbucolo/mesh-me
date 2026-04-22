import { NextResponse } from "next/server";
import { PLATFORM_CAPABILITIES } from "@/lib/platform-capabilities";

export async function GET() {
  return NextResponse.json({ capabilities: PLATFORM_CAPABILITIES });
}
