// THE THREAD THE PAGE CAN KILL.
//
// This is the control that outranks every cap in zip-limits.ts, and the reason
// is not subtle: a browser out-of-memory is UNCATCHABLE. No exception is
// thrown, a try/catch does nothing, the tab dies and takes whatever the person
// was doing with it. Limits reduce the chance of reaching that point. Only a
// separate thread the page can terminate() can do anything once it is reached.
//
// So the entire archive read happens here — opening the ZIP, listing the central
// directory, inflating documents, parsing them — and the page keeps a handle it
// can pull at any time. Nothing about this file is load-bearing except that it
// runs somewhere else.
//
// ── WHY THE TYPING LOOKS LIKE THIS ──────────────────────────────────────────
//
// tsconfig's lib is ["dom", "dom.iterable", "esnext"], with no "webworker" —
// and adding it is not an option, because the two declare the same globals with
// different types and every file in the app would inherit the conflict. So the
// handful of worker globals actually used are declared narrowly here instead.
// Wrong-looking, correct, and contained to one file.

import { openArchive } from "@/lib/portability/read-zip";
import { readArchive } from "@/lib/portability/read-archive";

type StartMessage = { type: "start"; file: Blob };

const ctx = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", handler: (event: { data: unknown }) => void): void;
};

function isStart(value: unknown): value is StartMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "start" &&
    (value as { file?: unknown }).file instanceof Blob
  );
}

ctx.addEventListener("message", (event) => {
  if (!isStart(event.data)) return;
  const { file } = event.data;

  void (async () => {
    let archive: Awaited<ReturnType<typeof openArchive>> | null = null;
    try {
      ctx.postMessage({ type: "progress", stage: "opening" });

      // Listing the central directory costs a handful of ranged reads, not a
      // decompression pass — this is fast even on a multi-gigabyte file.
      archive = await openArchive(file);
      ctx.postMessage({ type: "progress", stage: "listed", entries: archive.headers.length });

      const result = await readArchive(archive.headers, archive.read);

      if (!result.understood) {
        // Not an error, and specifically not "0 posts". The distinction is the
        // whole reason locate-posts returns a union.
        ctx.postMessage({ type: "unrecognised", reason: result.reason, filesSeen: result.filesSeen });
        return;
      }

      ctx.postMessage({
        type: "done",
        platforms: result.report.platforms,
        posts: result.report.posts,
        refused: result.report.refused,
        unreadable: result.report.unreadable,
        skippedCount: result.report.skipped.length,
        textRepairs: result.report.textRepairs,
      });
    } catch (error) {
      ctx.postMessage({
        type: "error",
        message: error instanceof Error && error.message ? error.message.slice(0, 200) : "This file could not be read.",
      });
    } finally {
      // The page may have terminated this thread before we get here, in which
      // case none of it runs and nothing leaks anyway — the thread is gone.
      await archive?.close().catch(() => {});
    }
  })();
});
