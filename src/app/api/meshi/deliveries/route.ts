import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

// GET: Fetch unread Meshi deliveries for the current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Find notifications of type "meshi_delivery" that are unread
    const deliveryNotifs = await prisma.notification.findMany({
      where: {
        recipientId: user.id,
        type: "meshi_delivery",
        read: false,
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            meshiPreference: {
              select: {
                colorTheme: true,
                hatStyle: true,
                hairStyle: true,
                accessoryStyle: true,
                eyeStyle: true,
                badgeStyle: true,
                outfitStyle: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const deliveries = deliveryNotifs.map((n) => ({
      id: n.id,
      fromUser: n.actor?.displayName || "Someone",
      fromUsername: n.actor?.username || "unknown",
      message: n.message || "",
      meshiColor: n.actor?.meshiPreference?.colorTheme || "blue",
      meshiHat: n.actor?.meshiPreference?.hatStyle || "none",
      meshiHair: n.actor?.meshiPreference?.hairStyle || "none",
      meshiAccessory: n.actor?.meshiPreference?.accessoryStyle || "none",
      meshiEyeStyle: n.actor?.meshiPreference?.eyeStyle || "regular",
      meshiBadge: n.actor?.meshiPreference?.badgeStyle || "none",
      meshiOutfit: n.actor?.meshiPreference?.outfitStyle || "none",
      timestamp: n.createdAt.getTime(),
    }));

    // Don't mark as read here — the client will call POST after displaying each delivery
    return NextResponse.json({ deliveries });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST: Mark specific deliveries as read after the client has displayed them
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deliveryBody = await req.json().catch(() => null);
    if (!deliveryBody || typeof deliveryBody !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { ids } = deliveryBody;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    // Only mark notifications that belong to this user
    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        recipientId: user.id,
        type: "meshi_delivery",
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
