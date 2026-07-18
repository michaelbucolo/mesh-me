import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

// The notification row stores a truncated summary ("Meshi delivered a
// message: \"…\"") for the notifications feed. The arrival card hands over the
// sender's actual words, so unwrap the summary as a fallback when the real
// message body can't be found.
function unwrapDeliverySummary(summary: string): string {
  const match = summary.match(/^Meshi delivered a message: "([\s\S]*)"$/);
  return match ? match[1] : summary;
}

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

    // Recover each delivery's full message body: the message row is created
    // immediately before its notification, so the sender's newest message in a
    // shared thread at (or just after) the notification time is the one Meshi
    // carried. The stored summary is only a truncated fallback.
    const fullBodies = new Map<string, string>();
    await Promise.all(
      deliveryNotifs.map(async (n) => {
        if (!n.actorId) return;
        const carried = await prisma.message.findFirst({
          where: {
            senderId: n.actorId,
            createdAt: { lte: new Date(n.createdAt.getTime() + 5000) },
            thread: { members: { some: { userId: user.id } } },
          },
          orderBy: { createdAt: "desc" },
          select: { content: true },
        });
        if (carried?.content) fullBodies.set(n.id, carried.content);
      }),
    );

    const deliveries = deliveryNotifs.map((n) => ({
      id: n.id,
      fromUser: n.actor?.displayName || "Someone",
      fromUsername: n.actor?.username || "unknown",
      message: fullBodies.get(n.id) || unwrapDeliverySummary(n.message || ""),
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
