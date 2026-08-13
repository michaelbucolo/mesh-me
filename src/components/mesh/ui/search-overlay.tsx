// The ONE mesh search: jump to any star in this constellation, and reach
// across all of mesh.me ("Across mesh.me" people discovery) from the same
// box. Extracted from the old mesh-scene.tsx; owns its query/debounce state
// so typing never re-renders the scene shell.

"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MeshRuntimeRef } from "../scene/runtime";
import type { SceneModel, SceneNode } from "../scene/scene-model";

type DiscoverUser = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

export function MeshSearchOverlay({
  closing = false,
  rtRef,
  model,
  placeholder,
  onJump,
  onVisitUser,
  onClose,
}: {
  rtRef: MeshRuntimeRef;
  /** The scene model snapshot (React state from useMeshWorld). */
  model: SceneModel | null;
  placeholder: string;
  onJump: (node: SceneNode) => void;
  onVisitUser: (userId: string) => void;
  onClose: () => void;
  /** Chrome is playing the 170ms graceful exit — render leaving, swallow input. */
  closing?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  // Cross-site results are keyed by the query they answered, so a stale
  // response (or a query that shrank below the threshold) simply stops
  // matching instead of needing an imperative clear.
  const [discover, setDiscover] = useState<{ q: string; users: DiscoverUser[] }>({ q: "", users: [] });

  // Discoverability: the mesh search also reaches across all of mesh.me, so
  // you can find any public user and step straight into their mesh.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || controller.signal.aborted) return;
        const users = Array.isArray(data.users) ? data.users : [];
        setDiscover({
          q,
          users: users
            .filter((u: { id: string }) => u.id !== rtRef.current.meshOwnerId)
            .slice(0, 5)
            .map((u: DiscoverUser) => ({
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              avatarUrl: u.avatarUrl,
            })),
        });
      } catch {
        // Discovery search is best-effort.
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [rtRef, searchQuery]);
  const discoverUsers =
    searchQuery.trim().length >= 2 && discover.q === searchQuery.trim() ? discover.users : [];

  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!model) return [];
    const out: SceneNode[] = [];
    model.nodes.forEach((node) => {
      if (node.kind === "self" || node.kind === "branch") return;
      if (!q || node.label.toLowerCase().includes(q) || node.sublabel?.toLowerCase().includes(q)) out.push(node);
    });
    out.sort((a, b) => b.weight - a.weight);
    return out.slice(0, 8);
  })();

  return (
    <div
      className={`absolute inset-0 z-50 flex ${closing ? "pointer-events-none animate-[fadeOut_.16s_var(--mesh-ease-press)_both]" : "animate-[fadeIn_.18s_var(--mesh-ease-out)]"} items-start justify-center bg-black/50 p-4 pt-24 backdrop-blur-sm`}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Search your Mesh" className={`w-full max-w-md ${closing ? "animate-[bubbleOut_.16s_var(--mesh-ease-press)_both]" : "animate-[bubbleIn_.36s_var(--mesh-ease-out)]"} rounded-2xl mesh-panel p-2 shadow-2xl`}>
        <div className="flex items-center gap-2 px-2">
          <Search size={15} className="shrink-0 text-[var(--text-tertiary)]" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchResults[0]) onJump(searchResults[0]);
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full bg-transparent py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={15} />
          </button>
        </div>
        {searchResults.length > 0 && (
          <ul className="max-h-72 overflow-y-auto border-t border-[var(--rule)] pt-1">
            {searchResults.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onJump(node)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--paper-hover)]"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: node.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--text-primary)]">{node.label}</span>
                    {node.sublabel && <span className="block truncate text-micro text-[var(--text-tertiary)]">{node.sublabel}</span>}
                  </span>
                  <span className="shrink-0 text-micro mesh-eyebrow text-[var(--text-tertiary)]">{node.kind}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {discoverUsers.length > 0 && (
          <div className="border-t border-[var(--rule)] pt-1">
            <p className="px-3 pt-1.5 pb-0.5 text-micro mesh-eyebrow text-[var(--text-tertiary)]">Across mesh.me</p>
            <ul className="max-h-48 overflow-y-auto">
              {discoverUsers.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onVisitUser(u.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--paper-hover)]"
                  >
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--paper-2)] text-micro font-semibold text-[var(--text-secondary)]">
                        {(u.displayName || u.username).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--text-primary)]">{u.displayName || u.username}</span>
                      <span className="block truncate text-micro text-[var(--text-tertiary)]">@{u.username}</span>
                    </span>
                    <span className="shrink-0 text-micro mesh-eyebrow text-[var(--text-tertiary)]">Visit mesh</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {searchQuery.trim() && searchResults.length === 0 && discoverUsers.length === 0 && (
          <p className="border-t border-[var(--rule)] px-3 py-3 text-xs text-[var(--text-tertiary)]">Nothing on the mesh matches that.</p>
        )}
      </div>
    </div>
  );
}
