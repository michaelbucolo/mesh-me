// The whole mesh as a structured, keyboard-navigable list — the accessible
// twin of the canvas. Same organizing logic, stated in words: people sorted
// by real closeness, everyone's work newest-first under its maker. Extracted
// from the old mesh-scene.tsx; ownership language now comes from meshCopy so
// a visited/Global mesh no longer reads "Your people".

"use client";

import { X } from "lucide-react";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { byNewest } from "../sim/layout";
import type { SceneModel, SceneNode } from "../scene/scene-model";
import type { MeshCopy } from "./copy";

export function MeshListView({
  model,
  copy,
  onClose,
  onOpen,
}: {
  model: SceneModel | null;
  copy: MeshCopy;
  onClose: () => void;
  onOpen: (node: SceneNode) => void;
}) {
  if (!model) return null;
  const all = Array.from(model.nodes.values());
  // Sorted with the canvas layout's shared byNewest (sim/layout.ts): the id
  // tiebreak keeps equal-timestamp rows in the same order on every client,
  // and keeps the list agreeing with the constellation it mirrors.
  const people = all
    .filter((n) => n.kind === "person")
    .sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0));
  const nativePosts = all
    .filter((n) => n.kind === "post" && n.parentId === model.selfId)
    .sort(byNewest);
  const platforms = all.filter((n) => n.kind === "platform");
  const postsOf = (source: SceneNode) =>
    source.childIds
      .map((id) => model.nodes.get(id))
      .filter((n): n is SceneNode => Boolean(n && n.kind === "post"))
      .sort(byNewest);

  const timeOf = (node: SceneNode) => node.meta?.find((m) => m.label === "Time")?.value;

  const PostRow = ({ node, indent }: { node: SceneNode; indent?: boolean }) => (
    <li>
      <button
        type="button"
        onClick={() => onOpen(node)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6 ${indent ? "pl-8" : ""}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: node.color }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm text-white">{node.label}</span>
            {node.isNew && (
              <span className="shrink-0 rounded-full bg-cyan-400/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-cyan-200">
                New
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] text-white/45">
            {[timeOf(node), node.sublabel].filter(Boolean).join(" · ") || "Post"}
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <div
      className="absolute inset-0 z-50 flex animate-[fadeIn_.18s_ease] justify-end bg-black/50 backdrop-blur-sm"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label={copy.listAria}
        className="mesh-panel flex h-full w-full max-w-md animate-[sheetIn_.32s_cubic-bezier(0.22,1,0.36,1)] flex-col pt-16 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/8 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-white">The same world, as a list</p>
            <p className="text-[11px] text-white/50">Closest people first · newest work first</p>
          </div>
          <button
            type="button"
            aria-label="Close list"
            onClick={onClose}
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6 pt-1">
          {people.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {copy.listPeopleHeading}
              </p>
              <ul>
                {people.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(node)}
                      className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6"
                    >
                      {node.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={node.avatarUrl} alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                          style={{ background: node.color }}
                        >
                          {node.label.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-white">{node.label}</span>
                          {node.status === "online" && (
                            <span className="flex items-center gap-1 text-[9.5px] font-semibold text-emerald-300">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                              here now
                            </span>
                          )}
                        </span>
                        {node.sublabel && <span className="block truncate text-[11px] text-white/50">{node.sublabel}</span>}
                        {node.placeReason && <span className="block text-[10px] leading-snug text-white/40">{node.placeReason}</span>}
                      </span>
                    </button>
                    {postsOf(node).length > 0 && <ul>{postsOf(node).map((p) => <PostRow key={p.id} node={p} indent />)}</ul>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {nativePosts.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {copy.listMadeByHeading}
              </p>
              <ul>
                {nativePosts.map((node) => (
                  <PostRow key={node.id} node={node} />
                ))}
              </ul>
            </>
          )}

          {platforms.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {copy.listPlatformsHeading}
              </p>
              <ul>
                {platforms.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(node)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6"
                    >
                      <PlatformLogo platform={node.label} size={18} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm capitalize text-white">{node.label}</span>
                        {node.sublabel && <span className="block truncate text-[11px] text-white/50">{node.sublabel}</span>}
                      </span>
                    </button>
                    {postsOf(node).length > 0 && <ul>{postsOf(node).map((p) => <PostRow key={p.id} node={p} indent />)}</ul>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {people.length === 0 && nativePosts.length === 0 && platforms.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-white/45">This mesh is just its owner for now.</p>
          )}
        </div>
      </div>
    </div>
  );
}
