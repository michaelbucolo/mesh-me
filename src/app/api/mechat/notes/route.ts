import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";

const NOTE_LIFESPAN_MS = 24 * 60 * 60 * 1000;
const MAX_NOTE_LENGTH = 60;
const MAX_SONG_LENGTH = 120;

type NotePayload = {
  id: string;
  userId: string;
  text: string;
  songTitle: string | null;
  songArtist: string | null;
  createdAt: string;
  expiresAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.threadMember.findMany({
      where: { thread: { members: { some: { userId: user.id } } } },
      select: { userId: true },
    });
    const relevantIds = new Set<string>(memberships.map((m) => m.userId));
    relevantIds.add(user.id);

    const now = new Date();
    const notes = await prisma.meChatNote.findMany({
      where: {
        userId: { in: Array.from(relevantIds) },
        expiresAt: { gt: now },
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Keep only the most recent note per user.
    const seen = new Set<string>();
    const latest: NotePayload[] = [];
    for (const note of notes) {
      if (seen.has(note.userId)) continue;
      seen.add(note.userId);
      latest.push({
        id: note.id,
        userId: note.userId,
        text: note.text,
        songTitle: note.songTitle,
        songArtist: note.songArtist,
        createdAt: note.createdAt.toISOString(),
        expiresAt: note.expiresAt.toISOString(),
        user: note.user,
      });
    }

    return NextResponse.json({ notes: latest });
  } catch {
    return NextResponse.json({ error: "Could not load notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(`mechat-note:${user.id}`, 12, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many notes. Please try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    const songTitle = typeof body.songTitle === "string" ? body.songTitle.trim() : "";
    const songArtist = typeof body.songArtist === "string" ? body.songArtist.trim() : "";

    if (!text && !songTitle) {
      return NextResponse.json({ error: "Add a note or a song" }, { status: 400 });
    }
    if (text.length > MAX_NOTE_LENGTH) {
      return NextResponse.json({ error: "Note too long" }, { status: 400 });
    }
    if (songTitle.length > MAX_SONG_LENGTH || songArtist.length > MAX_SONG_LENGTH) {
      return NextResponse.json({ error: "Song details too long" }, { status: 400 });
    }

    // A user keeps a single active note — replace any previous one atomically.
    const created = await prisma.$transaction(async (tx) => {
      await tx.meChatNote.deleteMany({ where: { userId: user.id } });
      return tx.meChatNote.create({
        data: {
          userId: user.id,
          text,
          songTitle: songTitle || null,
          songArtist: songArtist || null,
          expiresAt: new Date(Date.now() + NOTE_LIFESPAN_MS),
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });
    });

    return NextResponse.json({
      note: {
        id: created.id,
        userId: created.userId,
        text: created.text,
        songTitle: created.songTitle,
        songArtist: created.songArtist,
        createdAt: created.createdAt.toISOString(),
        expiresAt: created.expiresAt.toISOString(),
        user: created.user,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not save note" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await prisma.meChatNote.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Could not clear note" }, { status: 500 });
  }
}
