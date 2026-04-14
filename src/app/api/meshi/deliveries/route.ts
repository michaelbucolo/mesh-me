import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
              select: { colorTheme: true, hatStyle: true },
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
      timestamp: n.createdAt.getTime(),
    }));

    // Mark them as read
    if (deliveryNotifs.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: deliveryNotifs.map((n) => n.id) },
        },
        data: { read: true },
      });
    }

    return NextResponse.json({ deliveries });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
