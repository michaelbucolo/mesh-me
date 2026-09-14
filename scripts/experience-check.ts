import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@libsql/client";
import { normalizeLegacyCommunityAudience } from "./lib/community-audience-migration.mjs";
import { MAX_POST_MEDIA_TOTAL_BYTES, detectPostMediaType, parseMediaRange, postMediaSelectionError } from "../src/lib/post-media";
import { readPostDraft } from "../src/lib/post-draft";
import { scoreRelatedContent } from "../src/lib/related-content";
import { nativeVideoDuration, readVideoDuration } from "../src/lib/video-duration";
import videoFixture from "./fixtures/native-video.json";

// Always use an isolated database, even if invoked with production env loaded.
async function main() {
  const directory = mkdtempSync(join(tmpdir(), "mesh-experience-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  let server: ChildProcess | undefined;
  let checks = 0;
  const check = (actual: unknown, expected: unknown, message: string) => {
    assert.deepEqual(actual, expected, message);
    checks++;
  };
  execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  try {
    const { ANONYMOUS_VIEWER, getCombinedFeedPosts, getFeedPostById, getViewerSocialGraph } = await import("../src/lib/feed-data");
    const { nativePostAudienceWhere } = await import("../src/lib/post-audience");
    const { canUserInteractWithPost } = await import("../src/lib/privacy-policy");
    const { rankRelatedPosts } = await import("../src/lib/flow-ranking");
    const names = ["owner", "friendmember", "member", "friendoutside", "stranger"] as const;
    const users = await Promise.all(names.map((name) => prisma.user.create({ data: {
      id: randomUUID(), username: name, displayName: name, email: `${name}@example.invalid`,
      passwordHash: "test-fixture-no-login", isPublic: true, onboarded: true,
    } })));
    const [owner, friendMember, member, friendOutside] = users;
    const communities = await Promise.all([true, false].map((isPublic) => prisma.community.create({ data: {
      name: isPublic ? "Public fixture" : "Private fixture", slug: isPublic ? "public-fixture" : "private-fixture", isPublic,
      members: { create: [owner, friendMember, member].map((user) => ({ userId: user.id })) },
    } })));
    for (const friend of [friendMember, friendOutside]) {
      await prisma.follow.createMany({ data: [
        { followerId: owner.id, followingId: friend.id }, { followerId: friend.id, followingId: owner.id },
      ] });
    }
    const viewers = [...users.map((user) => ({ ...user, meshProGiftUntil: null })), ANONYMOUS_VIEWER];
    const legacy = await prisma.post.create({ data: { authorId: owner.id, communityId: communities[1].id, content: "Legacy community history", visibility: "private" } });
    const personal = await prisma.post.create({ data: { authorId: owner.id, content: "Personal Only me", visibility: "private" } });
    const migrationClient = createClient({ url: process.env.DATABASE_URL });
    try {
      await normalizeLegacyCommunityAudience(migrationClient);
      check((await prisma.post.findUniqueOrThrow({ where: { id: legacy.id } })).visibility, "community", "Migration preserves legacy member access explicitly");
      check((await prisma.post.findUniqueOrThrow({ where: { id: personal.id } })).visibility, "private", "Migration does not publish personal Only me content");
      const newPrivate = await prisma.post.create({ data: { authorId: owner.id, communityId: communities[1].id, content: "New Only me", visibility: "private" } });
      await normalizeLegacyCommunityAudience(migrationClient);
      check((await prisma.post.findUniqueOrThrow({ where: { id: newPrivate.id } })).visibility, "private", "Retried migrations leave new Only me posts unchanged");
      await prisma.post.deleteMany({ where: { id: { in: [legacy.id, personal.id, newPrivate.id] } } });
    } finally { migrationClient.close(); }
    const mediaIds = new Map<string, string>();
    const records: Array<{ id: string; authorId: string; visibility: string; communityId: string | null; allowed: number[] }> = [];
    const audiences = ["public", "friends", "private", "community"];
    for (const [contextIndex, community] of [null, ...communities].entries()) {
      for (const visibility of audiences) {
        if (!community && visibility === "community") continue;
        const allowed = visibility === "private" ? [0]
          : visibility === "community" ? [0, 1, 2]
          : visibility === "friends" ? contextIndex === 2 ? [0, 1] : [0, 1, 3]
          : contextIndex === 2 ? [0, 1, 2] : [0, 1, 2, 3, 4, 5];
        const id = randomUUID();
        const mediaId = randomUUID();
        // Minimal PNG signature + payload, enough to verify byte delivery.
        const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
        const post = await prisma.post.create({ data: {
          id, authorId: owner.id, communityId: community?.id, visibility,
          content: `Audience fixture ${contextIndex} ${visibility}`,
          media: { create: { id: mediaId, type: "image", url: `/api/post-media/${mediaId}`, file: { create: { mimeType: "image/png", size: bytes.length, data: bytes.toString("base64") } } } },
        } });
        records.push({ ...post, allowed });
        mediaIds.set(post.id, mediaId);
      }
    }
    for (const [index, viewer] of viewers.entries()) {
      const graph = await getViewerSocialGraph(viewer.id);
      const feed = await prisma.post.findMany({ where: nativePostAudienceWhere(viewer.id, graph.communityIds, graph.friendIds), select: { id: true } });
      check(feed.map((p) => p.id).sort(), records.filter((p) => p.allowed.includes(index)).map((p) => p.id).sort(), `Feed audience for ${viewer.username}`);
      for (const post of records) {
        check(Boolean(await getFeedPostById(viewer, post.id)), post.allowed.includes(index), `Permalink ${post.visibility} for ${viewer.username}`);
        if (index < users.length) check(await canUserInteractWithPost(viewer.id, post), post.allowed.includes(index), `Interaction ${post.visibility} for ${viewer.username}`);
      }
    }
    const publicPost = records.find((p) => p.visibility === "public" && !p.communityId)!;
    await prisma.block.create({ data: { blockerId: owner.id, blockedId: member.id } });
    check(await getFeedPostById(viewers[2], publicPost.id), null, "Block removes the permalink");
    check(await canUserInteractWithPost(member.id, publicPost), false, "Block rejects interactions");
    await prisma.block.deleteMany();
    await prisma.user.update({ where: { id: owner.id }, data: { isSuspended: true } });
    check(await getFeedPostById(ANONYMOUS_VIEWER, publicPost.id), null, "Suspended authors do not circulate");
    check(await canUserInteractWithPost(member.id, publicPost), false, "Suspended content cannot receive interactions");
    await prisma.user.update({ where: { id: owner.id }, data: { isSuspended: false } });
    // Making a community public must not publish its members-only history.
    await prisma.community.update({ where: { id: communities[1].id }, data: { isPublic: true } });
    const memberHistory = records.find((p) => p.communityId === communities[1].id && p.visibility === "community")!;
    check(await getFeedPostById(ANONYMOUS_VIEWER, memberHistory.id), null, "Private community history stays members-only after a public switch");
    await prisma.community.update({ where: { id: communities[1].id }, data: { isPublic: false } });

    check(postMediaSelectionError([{ size: MAX_POST_MEDIA_TOTAL_BYTES, type: "video/mp4" }]), null, "The documented upload boundary is accepted");
    check(Boolean(postMediaSelectionError([{ size: MAX_POST_MEDIA_TOTAL_BYTES + 1, type: "video/mp4" }])), true, "Oversized uploads are rejected");
    check(Boolean(postMediaSelectionError(Array.from({ length: 5 }, () => ({ size: 10, type: "image/png" })))), true, "Extra files are rejected, not dropped");
    check(Boolean(postMediaSelectionError([{ size: 10, type: "image/svg+xml" }])), true, "Active SVG uploads are not accepted");
    check(detectPostMediaType(new TextEncoder().encode("<html>not an image</html>")), null, "File extensions and claimed types cannot substitute for a media signature");
    check(detectPostMediaType(new Uint8Array([0, 0, 0, 24, ...Buffer.from("ftypavif"), 0, 0, 0, 0]))?.type, "image", "AVIF is an image, not a video");
    for (const [input, expected] of [
      [null, null], ["bytes=0-3", { start: 0, end: 3 }], ["bytes=4-", { start: 4, end: 11 }],
      ["bytes=-4", { start: 8, end: 11 }], ["bytes=0-999", { start: 0, end: 11 }],
      ["bytes=12-", "invalid"], ["bytes=4-2", "invalid"], ["bytes=-0", "invalid"],
      ["bytes=0-1,4-5", "invalid"], ["bytes=9999999999999999999999-", "invalid"],
    ] as const) check(parseMediaRange(input, 12), expected, `Range ${input}`);

    const draft = { version: 1, savedAt: Date.now(), content: "Keep my thought", tags: "", mediaUrl: "", linkUrl: "", visibility: "private" };
    check(readPostDraft(JSON.stringify(draft), false)?.visibility, "private", "A restored draft keeps its audience");
    check(readPostDraft(JSON.stringify({ ...draft, savedAt: Date.now() - 8 * 86400000 }), false), null, "Expired drafts do not return");
    check(readPostDraft(JSON.stringify({ ...draft, visibility: "community" }), false), null, "Community drafts cannot become home posts");
    check(readPostDraft('{"content":123}', false), null, "Malformed storage does not crash the composer");

    const anchor = { content: "Artemis lunar mission prepares for the next Moon landing", tags: [{ id: "space", tag: "space" }] };
    const candidates = [
      { content: "Artemis mission engineers test the lunar landing system", tags: [{ id: "space", tag: "space" }] },
      { content: "My favorite pasta recipe for tonight", tags: [{ id: "food", tag: "food" }] },
      { content: "Follow my new video today viral fyp", tags: [] },
    ];
    const ranked = scoreRelatedContent(anchor, candidates);
    check(ranked[0].score > 0 && ranked[1].score === 0 && ranked[2].score === 0, true, "Subject matching excludes unrelated and generic content");
    const base = (await getFeedPostById(viewers[0], publicPost.id))!;
    const reel = { ...base, ...anchor, id: "anchor", durationSeconds: 30, media: [{ id: "v", url: "https://example.invalid/video.mp4", type: "video" }] };
    const lane = rankRelatedPosts(reel, [
      reel, { ...reel, ...candidates[1], id: "unrelated" }, { ...reel, ...candidates[0], id: "related" },
      { ...reel, ...candidates[0], id: "long", durationSeconds: 3600 },
      { ...reel, ...candidates[0], id: "related" },
    ], { exclude: new Set(), limit: 8 });
    check(lane.map((p) => p.id), ["related"], "Sideways lane excludes the anchor, duplicates, long videos and unrelated posts");

    for (const format of ["mp4", "webm"] as const) {
      const bytes = Buffer.from(videoFixture[format], "base64");
      check(readVideoDuration(bytes, `video/${format}`), videoFixture.durationSeconds, `Real ${format} container duration`);
      check(readVideoDuration(bytes.subarray(0, 20), `video/${format}`), null, `Truncated ${format} metadata remains unknown`);
    }
    const mp4Header = (seconds: number, version = 0) => {
      const payload = version === 1 ? 32 : 20;
      const bytes = Buffer.alloc(16 + payload);
      bytes.writeUInt32BE(bytes.length, 0); bytes.write("moov", 4);
      bytes.writeUInt32BE(payload + 8, 8); bytes.write("mvhd", 12);
      bytes[16] = version;
      bytes.writeUInt32BE(1000, 16 + (version === 1 ? 20 : 12));
      if (version === 1) bytes.writeBigUInt64BE(BigInt(seconds * 1000), 40);
      else bytes.writeUInt32BE(seconds * 1000, 32);
      return bytes;
    };
    for (const version of [0, 1]) {
      for (const seconds of [0, 1.2, 180, 180.001, 3600]) {
        check(readVideoDuration(mp4Header(seconds, version), "video/quicktime"), seconds || null, `MOV version ${version}, ${seconds} seconds`);
      }
    }
    const malformedMp4 = mp4Header(20);
    malformedMp4.writeUInt32BE(0xffffffff, 0);
    check(readVideoDuration(malformedMp4, "video/mp4"), null, "Oversized container cannot escape the upload bounds");
    const zeroScale = mp4Header(20);
    zeroScale.writeUInt32BE(0, 28);
    check(readVideoDuration(zeroScale, "video/mp4"), null, "Zero time scale stays unknown");
    check(readVideoDuration(Buffer.alloc(32), "video/webm"), null, "Invalid EBML is handled without throwing");
    const webmScale = Buffer.from(videoFixture.webm, "base64");
    const scaleAt = webmScale.indexOf(Buffer.from([0x2a, 0xd7, 0xb1, 0x83]));
    assert.ok(scaleAt >= 0);
    webmScale.writeUIntBE(100_000, scaleAt + 4, 3);
    check(readVideoDuration(webmScale, "video/webm"), 0.12, "WebM honors a non-default timestamp scale");
    check(nativeVideoDuration([{ type: "image" }, { type: "video", durationSeconds: 20 }]), 20, "Photos do not hide a native clip's duration");
    check(nativeVideoDuration([{ type: "video", durationSeconds: 20 }, { type: "video", durationSeconds: 400 }]), 400, "A short attachment cannot hide a long attachment");
    check(nativeVideoDuration([{ type: "video", durationSeconds: 20 }, { type: "video" }]), null, "Every video must be classified before a mixed post reaches Flow");

    if (process.argv.includes("--http")) {
      const port = 23000 + Math.floor(Math.random() * 10000);
      const baseUrl = `http://127.0.0.1:${port}`;
      let logs = "";
      server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
        env: { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_APP_URL: baseUrl }, stdio: ["ignore", "pipe", "pipe"],
      });
      server.stdout?.on("data", (data) => { logs = (logs + data).slice(-10000); });
      server.stderr?.on("data", (data) => { logs = (logs + data).slice(-10000); });
      let ready = false;
      for (let i = 0; i < 100; i++) {
        ready = await fetch(`${baseUrl}/api/health`).then((r) => r.ok).catch(() => false);
        if (ready) break;
        if (server.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert.ok(ready, "Isolated production server became healthy");
      const sessions = await Promise.all(users.map((user) => prisma.session.create({ data: { id: randomBytes(32).toString("hex"), userId: user.id, expiresAt: new Date(Date.now() + 600000) } })));
      const headersFor = (index: number): Record<string, string> => index < sessions.length ? { cookie: `__Host-mesh_session=${sessions[index].id}` } : {};
      const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
      const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-webpack/client.node") as {
        encodeReply: (value: unknown) => Promise<FormData | string>;
      };
      const invoke = async (name: string, args: unknown[], viewerIndex = 0) => {
        const action = Object.entries(manifest.node).find(([, value]) => (value as { exportedName?: string }).exportedName === name)?.[0];
        assert.ok(action, `The production build exposes ${name}`);
        const response = await fetch(`${baseUrl}/feed`, {
          method: "POST", body: await encodeReply(args),
          headers: { ...headersFor(viewerIndex), "Next-Action": action, Accept: "text/x-component", Origin: baseUrl },
        });
        return { status: response.status, text: await response.text() };
      };
      const publish = async (fields: Record<string, string>, files: File[] = [], viewerIndex = 0) => {
        // Use the installed React encoder, including its multipart field order.
        // This hits the real action, auth, validation and database transaction.
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.set(key, value);
        for (const file of files) form.append("mediaFiles", file);
        return invoke("createPost", [form], viewerIndex);
      };
      const imageBytes = Buffer.alloc(1200 * 1024);
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM7cAAAAASUVORK5CYII=", "base64").copy(imageBytes);
      Buffer.from("xxxA", "base64").copy(imageBytes, 102);
      const uploaded = await publish({ content: "Uploaded fixture", visibility: "private", tags: "space,space" }, [new File([imageBytes], "photo.png", { type: "image/png" })]);
      check(uploaded.status, 200, "An upload over the old 1 MB limit reaches the composer action");
      const stored = await prisma.post.findFirst({ where: { content: "Uploaded fixture" }, include: { media: { include: { file: true } }, tags: true } });
      assert.ok(stored, `Publishing persists the post: ${uploaded.text.slice(0, 500)}`);
      check(stored.visibility, "private", "Publishing preserves Only me");
      check(stored.isNsfw, false, "Encoded media bytes are not classified as text");
      check(stored.media[0].file?.size, imageBytes.length, "The entire file is stored separately");
      check(stored.media[0].url.startsWith("/api/post-media/"), true, "Feed metadata contains an addressable URL");
      check(stored.tags.length, 1, "Post and deduplicated tags commit together");
      check(uploaded.text.includes(imageBytes.toString("base64").slice(0, 256)), false, "Publishing returns media metadata without the encoded image");
      check((await fetch(`${baseUrl}${stored.media[0].url}`)).status, 404, "Only me media cannot be fetched by a guest");
      for (const format of ["mp4", "webm"] as const) {
        const bytes = Buffer.from(videoFixture[format], "base64");
        const content = `Artemis lunar mission native ${format} fixture`;
        const result = await publish({ content, visibility: "public", tags: "space", durationSeconds: "9999" }, [new File([bytes], `clip.${format}`, { type: `video/${format}` })]);
        check(result.status, 200, `Native ${format} upload succeeds`);
        const clip = await prisma.post.findFirstOrThrow({ where: { content }, include: { media: true } });
        check(clip.media[0].durationSeconds, 1.2, "Stored duration comes from the container, not a forged form field");
        const card = (await getFeedPostById(viewers[0], clip.id))!;
        check(card.durationSeconds, 1.2, "The native permalink carries duration to Flow");
        const feed = await getCombinedFeedPosts({ user: viewers[0], source: "all", contentFilter: "all", limit: 50 });
        check(feed.find((post) => post.id === clip.id)?.durationSeconds, 1.2, "Native feed candidates carry duration to Flow");
        check(rankRelatedPosts(reel, [card], { exclude: new Set(), limit: 8 }).map((post) => post.id), [clip.id], "A published native short enters the related Flow lane");
        const media = await fetch(`${baseUrl}${clip.media[0].url}`);
        check(media.headers.get("content-type"), `video/${format}`, "Native videos are served with their container MIME type");
        check(Buffer.from(await media.arrayBuffer()), bytes, "The playable video bytes survive upload and delivery unchanged");
      }
      const forged = await publish({ content: "Forged media fixture" }, [new File(["<script>alert(1)</script>"], "fake.png", { type: "image/png" })]);
      check(forged.text.includes("not supported media"), true, "Forged image bytes produce a useful error");
      check(await prisma.post.count({ where: { content: "Forged media fixture" } }), 0, "Invalid media cannot leave a partial post");
      const overLimit = await publish({ content: "Too many media fixture" }, Array.from({ length: 5 }, () => new File([imageBytes.subarray(0, 100)], "photo.png", { type: "image/png" })));
      check(overLimit.text.includes("up to 4"), true, "Too many files are rejected visibly");
      check(await prisma.post.count({ where: { content: "Too many media fixture" } }), 0, "No attachment is silently dropped");
      const communityPublish = await publish({ content: "Community publication fixture", communityId: communities[1].id, visibility: "public", crossPostTo: '["twitter"]' });
      const communityPost = await prisma.post.findFirst({ where: { content: "Community publication fixture" } });
      check(communityPost?.visibility, "community", "Private-community publication is members-only on the server");
      check(communityPublish.text.includes("Not sent"), true, "Private-community publication cannot cross-post publicly");
      await publish({ content: "Outsider community fixture", communityId: communities[1].id, visibility: "community" }, [], 4);
      check(await prisma.post.count({ where: { content: "Outsider community fixture" } }), 0, "Outsiders cannot publish into a private community");
      await invoke("toggleReaction", [publicPost.id], 2);
      check(await prisma.reaction.count({ where: { postId: publicPost.id, userId: member.id } }), 1, "A like persists for its viewer");
      await invoke("toggleReaction", [publicPost.id], 2);
      check(await prisma.reaction.count({ where: { postId: publicPost.id, userId: member.id } }), 0, "A second like toggles it off");
      await invoke("toggleReaction", [stored.id], 2);
      check(await prisma.reaction.count({ where: { postId: stored.id } }), 0, "Knowing an Only me post ID cannot bypass the reaction audience");
      await invoke("toggleSavePost", [publicPost.id], 2);
      check(await prisma.savedPost.count({ where: { postId: publicPost.id, userId: member.id } }), 1, "Bookmarks persist per account");
      const comment = new FormData();
      comment.set("postId", publicPost.id); comment.set("content", "Fixture reply");
      await invoke("createComment", [comment], 2);
      check(await prisma.comment.count({ where: { postId: publicPost.id, authorId: member.id } }), 1, "Comments persist with the authenticated author");
      comment.set("postId", stored.id);
      await invoke("createComment", [comment], 2);
      check(await prisma.comment.count({ where: { postId: stored.id } }), 0, "Only me posts reject outsider comments");
      await invoke("deletePost", [stored.id], 2);
      check(Boolean(await prisma.post.findUnique({ where: { id: stored.id } })), true, "Other users cannot delete a post");
      await invoke("toggleFollow", [owner.id], 2);
      check(await prisma.follow.count({ where: { followerId: member.id, followingId: owner.id } }), 1, "Following is stored for the authenticated viewer");
      await invoke("toggleFollow", [owner.id], 2);
      check(await prisma.follow.count({ where: { followerId: member.id, followingId: owner.id } }), 0, "Unfollowing removes the relationship");
      const thread = await prisma.messageThread.create({ data: { threadType: "direct", sourcePlatform: "mesh", members: { create: [{ userId: owner.id }, { userId: member.id }] } } });
      const sent = await fetch(`${baseUrl}/api/messages/${thread.id}`, {
        method: "POST", headers: { ...headersFor(2), "Content-Type": "application/json", Origin: baseUrl }, body: JSON.stringify({ content: "Fixture private message" }),
      });
      check(sent.status, 201, "A thread member can send a message");
      await sent.text();
      check(await prisma.message.count({ where: { threadId: thread.id, senderId: member.id } }), 1, "Messages persist under the sender's identity");
      check((await fetch(`${baseUrl}/api/messages/${thread.id}`, { headers: headersFor(4) })).status, 404, "Non-members cannot read the conversation");
      for (const [index, viewer] of viewers.entries()) {
        for (const post of records) {
          const response = await fetch(`${baseUrl}/api/post-media/${mediaIds.get(post.id)}`, { headers: headersFor(index) });
          check(response.status, post.allowed.includes(index) ? 200 : 404, `Media authorization ${post.visibility} for ${viewer.username}`);
          check(response.headers.get("cache-control"), "private, no-store", "Media is never publicly cached");
          await response.arrayBuffer();
        }
      }
      const mediaUrl = `${baseUrl}/api/post-media/${mediaIds.get(publicPost.id)}`;
      const partial = await fetch(mediaUrl, { headers: { range: "bytes=8-" } });
      check(partial.status, 206, "Video seeking gets partial content");
      check([...new Uint8Array(await partial.arrayBuffer())], [1, 2, 3, 4], "Partial content contains the requested bytes");
      check(partial.headers.get("content-range"), "bytes 8-11/12", "Partial content describes its byte interval");
      check((await fetch(mediaUrl, { headers: { range: "bytes=100-" } })).status, 416, "Unsatisfiable media ranges are rejected");
      const head = await fetch(mediaUrl, { method: "HEAD" });
      check(head.headers.get("content-length"), "12", "HEAD reports the file size");
      check((await head.arrayBuffer()).byteLength, 0, "HEAD does not stream the file");
      for (const path of ["/", "/explore", "/flow", "/feed", "/messages", "/settings", "/search?q=fixture", "/search?q=fixture&q=second", "/communities/private-fixture"]) {
        const response = await fetch(`${baseUrl}${path}`, { headers: headersFor(0) });
        check(response.status, 200, `Authenticated page ${path} renders`);
        await response.text();
      }
      check((await fetch(`${baseUrl}/api/search?q=${"x".repeat(201)}`, { headers: headersFor(0) })).status, 400, "Search bounds are enforced over HTTP");
      // Verify removing a post removes its stored bytes as well.
      await invoke("deletePost", [publicPost.id], 0);
      check(await prisma.postMediaFile.findUnique({ where: { postMediaId: mediaIds.get(publicPost.id)! } }), null, "Deleting a post cascades to its media file");
      check((await fetch(mediaUrl)).status, 404, "Deleted media is unavailable");
      const diagnostics = execFileSync(process.execPath, ["scripts/platform-diagnostics.mjs", "--strict", `--base-url=${baseUrl}`], {
        env: { ...process.env, NEXT_PUBLIC_APP_URL: baseUrl, AUTH_SECRET: "isolated-test-not-a-production-secret" }, encoding: "utf8", timeout: 60000,
      });
      console.log(diagnostics);
    }
    console.log(`experience: ${checks} assertions passed (isolated database${process.argv.includes("--http") ? " + production HTTP" : ""})`);
  } finally {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => server!.once("exit", () => resolve()));
    }
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
