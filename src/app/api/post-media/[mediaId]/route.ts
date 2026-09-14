import { getCurrentUser } from "@/lib/auth";
import { ANONYMOUS_VIEWER, getFeedPostById } from "@/lib/feed-data";
import { parseMediaRange } from "@/lib/post-media";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ mediaId: string }> };

async function serve(request: Request, { params }: Context) {
  const { mediaId } = await params;
  const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const missing = () => new Response(null, { status: 404, headers: privateHeaders });
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(mediaId)) return missing();
  const [media, viewer] = await Promise.all([
    prisma.postMedia.findUnique({ where: { id: mediaId }, select: { postId: true } }),
    getCurrentUser(),
  ]);
  // The same post authorization applies to the file, including audience,
  // blocks, community membership, suspension, and sensitive-content controls.
  if (!media || !await getFeedPostById(viewer ?? ANONYMOUS_VIEWER, media.postId)) return missing();
  const file = await prisma.postMediaFile.findUnique({ where: { postMediaId: mediaId } });
  if (!file) return missing();
  const headers = new Headers({ ...privateHeaders, "Content-Type": file.mimeType, "Accept-Ranges": "bytes", "Content-Disposition": "inline" });
  const range = parseMediaRange(request.headers.get("range"), file.size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${file.size}`);
    return new Response(null, { status: 416, headers });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? file.size - 1;
  headers.set("Content-Length", String(end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
  const body = request.method === "HEAD" ? null : new Uint8Array(Buffer.from(file.data, "base64").subarray(start, end + 1));
  return new Response(body, { status: range ? 206 : 200, headers });
}

export const GET = serve;
export const HEAD = serve;
