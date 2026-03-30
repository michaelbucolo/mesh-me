import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Detect actual image type from file magic bytes (ignores client-provided MIME) */
function detectImageType(buf: Uint8Array): string | null {
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  return null;
}

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

    // Validate file size (max 4MB for banners)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 4MB" }, { status: 400 });
    }

    // Validate actual file content via magic bytes — don't trust client MIME type
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    const detectedType = detectImageType(bytes);
    if (!detectedType) {
      return NextResponse.json({ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" }, { status: 400 });
    }

    const base64 = Buffer.from(arrayBuf).toString("base64");
    const dataUrl = `data:${detectedType};base64,${base64}`;

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
