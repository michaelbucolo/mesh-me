import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("banner") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" }, { status: 400 });
    }

    // Validate file size (max 4MB for banners)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 4MB" }, { status: 400 });
    }

    // Convert to base64 data URL (same approach as avatar for MVP)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { bannerUrl: dataUrl },
    });

    return NextResponse.json({ bannerUrl: dataUrl });
  } catch {
    return NextResponse.json({ error: "Failed to upload banner" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { bannerUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove banner" }, { status: 500 });
  }
}
