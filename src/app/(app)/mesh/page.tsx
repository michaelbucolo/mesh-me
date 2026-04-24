"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useTransition, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowRightLeft,
  Compass,
  Globe,
  Network,
  Radio,
  RotateCcw,
  Sparkles,
  Timer,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeshiMascot, type MeshiColor, type MeshiHat } from "@/components/meshi/meshi-mascot";
import { MeshEngine } from "@/components/mesh/mesh-engine";
import { MeshCanvas } from "@/components/mesh/mesh-canvas";
import { buildMeshData, buildUserMeshData, preloadNodeImages, type MeshApiResponse } from "@/components/mesh/mesh-data";
import type { MeshNode, MeshEdge } from "@/components/mesh/mesh-types";
import type { RemoteMeshi } from "@/components/mesh/meshi-on-mesh";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";
import { deletePost } from "@/lib/actions";

type CachedUserMeshResponse = {
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
  following?: unknown[];
  communities?: unknown[];
  interests?: string[];
  platforms?: Array<{ id: string; platform: string; platformUsername?: string | null; publicPosts?: unknown[] }>;
  stats?: { followers?: number; following?: number; posts?: number; communities?: number; platforms?: number };
  privacyLevel?: string;
  meshiPreference?: { colorTheme?: string; hatStyle?: string } | null;
};

type FeedPost = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  community?: { id: string; name: string; slug: string } | null;
  media: { id: string; url: string; type: string }[];
  tags: { id: string; tag: string }[];
  _count: { comments: number; reactions: number; reposts: number };
  reactions?: { id: string }[];
  savedBy?: { id: string }[];
  isPinned?: boolean;
  platform?: string;
  crossPostedTo?: string[];
};

export default function MeshPage() {
  const router = useRouter();
  const imageCache = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const userMeshCacheRef = useRef<Map<string, CachedUserMeshResponse>>(new Map());

  const [engine] = useState(() => new MeshEngine());
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MeshNode | null>(null);
  const [zoom, setZoom] = useState(0.65);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingUserMesh, setLoadingUserMesh] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myMeshiColor, setMyMeshiColor] = useState<MeshiColor>("blue");
  const [myMeshiHat, setMyMeshiHat] = useState<MeshiHat>("none");
  const [myUsername, setMyUsername] = useState("You");
  const [myUserId, setMyUserId] = useState<string>("");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [remoteMeshis] = useState<RemoteMeshi[]>([]);
  const [travelLog, setTravelLog] = useState<Array<{ mesh: string; at: number }>>([]);
  const [meshNotice, setMeshNotice] = useState<string | null>(null);

  const [viewingUserMesh, setViewingUserMesh] = useState<MeshNode | null>(null);
  const [myNodes, setMyNodes] = useState<MeshNode[]>([]);
  const [myEdges, setMyEdges] = useState<MeshEdge[]>([]);
  const [meshData, setMeshData] = useState<MeshApiResponse | null>(null);

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<"map" | "posts" | "presence">("map");
  const [isPending, startTransition] = useTransition();

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      setFeedLoading(true);
      const res = await fetch("/api/feed?source=all", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load feed");
      const data = await res.json() as { posts: FeedPost[] };
      setFeedPosts(data.posts || []);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/mesh", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load mesh data");
        const data: MeshApiResponse = await res.json();
        setMeshData(data);

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        engine.setCenter(cx, cy);

        const { nodes, edges } = buildMeshData(data, cx, cy);
        engine.setData(nodes, edges);
        preloadNodeImages(nodes, imageCache.current);

        setMyNodes(nodes);
        setMyEdges(edges);
        setMyUsername(data.user.displayName || data.user.username || "You");
        setMyUserId(data.user.id);
        setMyAvatar(data.user.avatarUrl);
        if (data.meshiPreference?.colorTheme) setMyMeshiColor(data.meshiPreference.colorTheme as MeshiColor);
        if (data.meshiPreference?.hatStyle) setMyMeshiHat(data.meshiPreference.hatStyle as MeshiHat);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mesh");
      } finally {
        setLoading(false);
      }
    })();
  }, [engine]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const resetView = useCallback(() => {
    setZoom(0.65);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
    setHoveredNode(null);
  }, []);

  const enterUserMesh = useCallback(async (node: MeshNode) => {
    const username = node.sublabel?.replace("@", "");
    if (!username) return;

    try {
      setLoadingUserMesh(true);
      if (!viewingUserMesh) {
        setMyNodes([...engine.nodes]);
        setMyEdges([...engine.edges]);
      }

      const center = engine.getCenter();
      let data = userMeshCacheRef.current.get(username);
      if (!data) {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/mesh`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load user mesh");
        data = await res.json() as CachedUserMeshResponse;
        userMeshCacheRef.current.set(username, data);
      }

      const { nodes: userNodes, edges: userEdges } = buildUserMeshData(data, center.x, center.y);
      engine.setData(userNodes, userEdges);
      preloadNodeImages(userNodes, imageCache.current);

      setViewingUserMesh(node);
      if (data.privacyLevel === "private") {
        setMeshNotice("This user keeps their mesh private. You can view their profile but not their full network map.");
      } else if (data.privacyLevel === "friends-only") {
        setMeshNotice("This mesh is friends-only. Follow each other to unlock the full map and shared content.");
      } else {
        setMeshNotice(null);
      }
      setTravelLog((prev) => [{ mesh: node.label, at: Date.now() }, ...prev].slice(0, 10));
      setSelectedNode(null);
      resetView();
    } catch {
      if (node.href) router.push(node.href);
    } finally {
      setLoadingUserMesh(false);
    }
  }, [engine, resetView, router, viewingUserMesh]);

  const returnToMyMesh = useCallback(() => {
    if (myNodes.length > 0) engine.setData(myNodes, myEdges);
    setViewingUserMesh(null);
    setMeshNotice(null);
    setTravelLog((prev) => [{ mesh: "Your mesh", at: Date.now() }, ...prev].slice(0, 10));
    setSelectedNode(null);
    resetView();
  }, [engine, myEdges, myNodes, resetView]);

  const handleCanvasClick = useCallback((node: MeshNode | null) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (node.type === "user" && node.sublabel) {
        void enterUserMesh(node);
      } else if (node.href) {
        router.push(node.href);
      } else {
        setSelectedNode(node);
      }
    }, 220);
  }, [enterUserMesh, router]);

  const handleCanvasDoubleClick = useCallback((node: MeshNode | null) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (node?.href) router.push(node.href);
  }, [router]);

  const meshStats = useMemo(() => {
    const totalNodes = engine.nodes.length;
    const people = engine.nodes.filter((node) => node.type === "user").length;
    const communities = engine.nodes.filter((node) => node.type === "community").length;
    const platforms = engine.nodes.filter((node) => node.type === "platform").length;
    const posts = engine.nodes.filter((node) => node.type === "post").length;

    return { totalNodes, people, communities, platforms, posts };
  }, [engine.nodes]);

  const connectedAccounts = meshData?.connectedAccounts || [];
  const people = useMemo(
    () => engine.nodes.filter((node) => node.type === "user").slice(0, 8),
    [engine.nodes],
  );
  const onlinePeople = useMemo(
    () => engine.nodes.filter((node) => node.type === "user" && node.status === "online").slice(0, 8),
    [engine.nodes],
  );

  const quickDeletePost = (postId: string) => {
    setDeletingPostId(postId);
    startTransition(async () => {
      const result = await deletePost(postId);
      if (result?.success) {
        setFeedPosts((curr) => curr.filter((p) => p.id !== postId));
      }
      setDeletingPostId(null);
    });
  };

  if (loading) {
    return (
      <div className="relative h-[calc(100dvh-4rem)] overflow-hidden rounded-2xl md:rounded-3xl bg-[var(--bg-primary)] flex items-center justify-center">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
          <MeshiMascot size={64} mood="searching" color={myMeshiColor} hat={myMeshiHat} showGlow animate />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-4rem)] bg-[var(--bg-primary)] rounded-2xl md:rounded-3xl">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-[var(--text-primary)] font-semibold mb-1">Something went wrong</p>
          <p className="text-[var(--text-muted)] text-sm mb-4">{error}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4 mr-2" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-hidden rounded-2xl md:rounded-3xl bg-[var(--bg-primary)]">
      <div className="absolute inset-x-2 top-2 z-30 md:inset-x-4 md:top-4">
        <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl text-white shadow-2xl p-3 md:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <MeshiMascot size={30} mood={selectedNode ? "thinking" : "happy"} color={myMeshiColor} hat={myMeshiHat} animate />
              <div>
                <p className="text-sm font-semibold">The Mesh Control Center</p>
                <p className="text-[11px] text-white/70">Your super-app layer: one mesh for posts, chats, sync, and presence across every platform, including WeChat.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(["map", "posts", "presence"] as const).map((workspace) => (
                <button
                  key={workspace}
                  onClick={() => setActiveWorkspace(workspace)}
                  className={"px-2.5 py-1.5 rounded-lg text-xs font-medium transition " + (
                    activeWorkspace === workspace ? "bg-white/20 text-white" : "bg-white/10 text-white/75 hover:bg-white/15"
                  )}
                >
                  {workspace === "map" ? "Map" : workspace === "posts" ? "Posts" : "Presence"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
            <StatChip icon={Users} label="People" value={meshStats.people} />
            <StatChip icon={Network} label="Communities" value={meshStats.communities} />
            <StatChip icon={Globe} label="Platforms" value={meshStats.platforms} />
            <StatChip icon={Activity} label="Posts" value={meshStats.posts} />
            <StatChip icon={Sparkles} label="Nodes" value={meshStats.totalNodes} />
          </div>

          {meshNotice && <p className="text-xs text-amber-200/90">{meshNotice}</p>}
        </div>
      </div>

      <div className="absolute inset-0 pt-[11.4rem] pb-[11rem] md:pt-[10.5rem] md:pb-24 grid grid-cols-1 xl:grid-cols-[18rem_1fr_20rem] gap-2 md:gap-3 px-2 md:px-4">
        <aside className="hidden xl:block rounded-2xl border border-white/10 bg-black/45 backdrop-blur-xl text-white p-3 overflow-auto">
          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55 mb-2">Mesh travel</p>
            <div className="space-y-1.5">
              {people.length === 0 ? <p className="text-xs text-white/55">Connect with people to start jumping meshes.</p> : people.map((person) => (
                <button key={person.id} onClick={() => void enterUserMesh(person)} className="w-full text-left rounded-lg px-2 py-2 bg-white/5 hover:bg-white/10 transition">
                  <p className="text-xs font-medium truncate">{person.label}</p>
                  <p className="text-[11px] text-white/55 truncate">{person.sublabel || "Mesh hop"}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55 mb-2">Platform sync</p>
            <div className="space-y-1.5">
              {connectedAccounts.length === 0 ? (
                <p className="text-xs text-white/55">No platforms connected yet.</p>
              ) : connectedAccounts.map((acct: MeshApiResponse["connectedAccounts"][number]) => (
                <Link href="/connected-accounts" key={acct.id} className="block rounded-lg px-2 py-2 bg-white/5 hover:bg-white/10 transition">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{acct.platform}</p>
                    <span className="text-[10px] text-white/60">{acct.syncStatus || "synced"}</span>
                  </div>
                  <p className="text-[11px] text-white/55 truncate">{acct.platformUsername ? `@${acct.platformUsername}` : "Connected"}</p>
                </Link>
              ))}
            </div>
          </section>
        </aside>

        <main className="relative rounded-2xl border border-white/10 overflow-hidden">
          <MeshCanvas
            engine={engine}
            filter="all"
            showLabels={true}
            zoom={zoom}
            pan={pan}
            hoveredNode={hoveredNode}
            selectedNode={selectedNode}
            imageCache={imageCache}
            loading={loading}
            meshiColor={myMeshiColor}
            meshiHat={myMeshiHat}
            meshiUsername={myUsername}
            remoteMeshis={remoteMeshis}
            syncPulseTime={null}
            onZoomChange={setZoom}
            onPanChange={setPan}
            onHoverChange={setHoveredNode}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
          />

          <div className="absolute left-2 bottom-2 flex gap-2 z-10">
            <button onClick={resetView} className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 border border-white/10 px-2.5 py-1.5 text-xs text-white/85 hover:bg-black/70 transition">
              <RotateCcw className="h-3.5 w-3.5" /> Reset view
            </button>
            {viewingUserMesh && (
              <button onClick={returnToMyMesh} className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 border border-white/10 px-2.5 py-1.5 text-xs text-white/85 hover:bg-black/70 transition">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Return
              </button>
            )}
          </div>
        </main>

        <aside className="hidden lg:block rounded-2xl border border-white/10 bg-black/45 backdrop-blur-xl text-white p-3 overflow-auto">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/55 mb-2">Focus</p>
          {selectedNode || hoveredNode ? (
            <div className="rounded-xl bg-white/5 p-3 mb-3">
              <p className="text-sm font-semibold">{(selectedNode || hoveredNode)?.label}</p>
              <p className="text-xs text-white/55 mb-2">{(selectedNode || hoveredNode)?.sublabel || (selectedNode || hoveredNode)?.type}</p>
              {(selectedNode || hoveredNode)?.description && <p className="text-xs text-white/70">{(selectedNode || hoveredNode)?.description}</p>}
            </div>
          ) : (
            <p className="text-xs text-white/55 mb-3">Tap or hover a node to inspect posts, links, and connections.</p>
          )}

          <p className="text-[10px] uppercase tracking-[0.2em] text-white/55 mb-2">Meshi + presence</p>
          <div className="space-y-1.5">
            {onlinePeople.length === 0 ? (
              <p className="text-xs text-white/55">No contacts online right now.</p>
            ) : onlinePeople.map((person) => (
              <div key={person.id} className="rounded-lg px-2 py-2 bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate">{person.label}</p>
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[11px] text-white/55">{person.interactionCount || 0} interactions</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="absolute inset-x-2 bottom-2 md:inset-x-4 z-20 rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl text-white p-3 max-h-[46vh] overflow-auto">
        {activeWorkspace === "map" && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55 mb-2">Travel history</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/70 mb-2">Recent mesh jumps</p>
                <div className="space-y-1.5 max-h-36 overflow-auto pr-1">
                  {travelLog.length === 0 ? <p className="text-xs text-white/55">No jumps yet. Click a user node to travel.</p> : travelLog.map((item, idx) => (
                    <div key={`${item.mesh}-${item.at}-${idx}`} className="flex items-center justify-between text-xs">
                      <span className="truncate pr-3">{item.mesh}</span>
                      <span className="text-white/50"><Timer className="inline h-3 w-3 mr-1" />{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/70 mb-2">Mesh actions</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/connected-accounts"><Button variant="secondary" size="sm"><Globe className="h-3.5 w-3.5 mr-1.5" />Manage sync</Button></Link>
                  <Link href="/settings"><Button variant="secondary" size="sm"><Compass className="h-3.5 w-3.5 mr-1.5" />Privacy + mesh</Button></Link>
                  <Link href="/feed"><Button variant="secondary" size="sm"><Radio className="h-3.5 w-3.5 mr-1.5" />Open full feed</Button></Link>
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:hidden gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/70 mb-2">Quick mesh travel</p>
                <div className="space-y-1.5">
                  {people.length === 0 ? (
                    <p className="text-xs text-white/55">No nearby meshes yet.</p>
                  ) : people.slice(0, 4).map((person) => (
                    <button key={person.id} onClick={() => void enterUserMesh(person)} className="w-full text-left rounded-lg px-2 py-1.5 bg-white/5 hover:bg-white/10">
                      <p className="text-xs font-medium truncate">{person.label}</p>
                      <p className="text-[11px] text-white/55">{person.sublabel || "Tap to travel"}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/70 mb-2">Platform sync pulse</p>
                <div className="space-y-1.5">
                  {connectedAccounts.length === 0 ? (
                    <p className="text-xs text-white/55">Connect platforms to activate sync.</p>
                  ) : connectedAccounts.slice(0, 4).map((acct: MeshApiResponse["connectedAccounts"][number]) => (
                    <div key={acct.id} className="rounded-lg bg-white/5 px-2 py-1.5">
                      <p className="text-xs font-medium">{acct.platform}</p>
                      <p className="text-[11px] text-white/55 truncate">{acct.platformUsername ? `@${acct.platformUsername}` : "Connected"} · {acct.syncStatus || "synced"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeWorkspace === "presence" && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55 mb-2">User presence layer</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/65 mb-1">Online contacts</p>
                <p className="text-2xl font-semibold">{onlinePeople.length}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/65 mb-1">Active remotes</p>
                <p className="text-2xl font-semibold">{remoteMeshis.length}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/65 mb-1">Meshi mode</p>
                <p className="text-sm font-semibold">Context aware</p>
              </div>
            </div>
          </div>
        )}

        {activeWorkspace === "posts" && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Publishing + moderation</p>
            <div className="rounded-xl bg-white/5 p-3">
              <PostComposer user={{ displayName: myUsername, avatarUrl: myAvatar }} />
            </div>
            <div className="space-y-2 max-h-[24vh] overflow-auto pr-1">
              {feedLoading ? (
                <p className="text-sm text-white/60">Loading posts…</p>
              ) : feedPosts.length === 0 ? (
                <p className="text-sm text-white/60">No posts yet.</p>
              ) : feedPosts.slice(0, 5).map((post) => (
                <div key={post.id} className="rounded-xl bg-white/5 p-2">
                  <div className="flex justify-end mb-1">
                    <button
                      onClick={() => quickDeletePost(post.id)}
                      disabled={deletingPostId === post.id || isPending}
                      className="inline-flex items-center gap-1 text-[11px] text-red-300 hover:text-red-200 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                  <PostCard post={post} currentUserId={myUserId} compact />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {loadingUserMesh && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <MeshiMascot size={48} mood="excited" color={myMeshiColor} hat={myMeshiHat} showGlow animate />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {engine.nodes.length <= 1 && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-4">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 text-center text-white">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <UserRound className="h-8 w-8 text-white/70" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Your mesh is just getting started</h3>
            <p className="text-sm text-white/70 mb-4">
              Follow people, connect platforms, and post to begin syncing your full digital presence into this mesh.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/explore"><Button variant="gradient" size="sm">Explore</Button></Link>
              <Link href="/connected-accounts"><Button variant="secondary" size="sm">Connect platforms</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1.5">
      <div className="flex items-center gap-1 text-white/60 mb-0.5">
        <Icon className="h-3 w-3" />
        <p className="text-[10px] uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
