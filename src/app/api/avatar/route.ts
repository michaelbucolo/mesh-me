import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readFormData } from "@/lib/request-guard";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/** Detect actual image type from file magic bytes (ignores client-provided MIME) */
function detectImageType(buf: Uint8Array): string | null {
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  return null;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await readFormData(request);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form submission" }, { status: 400 });
    }
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Validate actual file content via magic bytes — don't trust client MIME type
    const detectedType = detectImageType(bytes);
    if (!detectedType) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, WebP, or GIF." },
        { status: 400 }
      );
    }

    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${detectedType};base64,${base64}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: dataUrl },
    });

    return NextResponse.json({ success: true, avatarUrl: dataUrl });
  } catch {
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ success: true });
}
