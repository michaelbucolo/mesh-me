// THE MESH, IN WORDS, ALWAYS PRESENT.
//
// ── WHAT THIS IS AND WHY IT HAD TO COME BACK ───────────────────────────────
//
// The scene is a <canvas>. To a screen reader a canvas is one opaque box: the
// whole mesh — every person, every post, every platform — reaches assistive
// technology as the single string on `role="img" aria-label="Your mesh
// constellation"`. That is not a description of the surface, it is the name of
// a picture.
//
// The canvas already has an accessible twin: MeshListView (ui/list-view.tsx),
// which states the same world in headings and links. But it is a MODE — it
// renders only while `chrome.isOpen("list")`, and it is closed on arrival. A
// fallback you have to find and open is not a fallback; a screen reader user
// landing on /mesh gets the one label and nothing else.
//
// The tile layout that briefly replaced the canvas had this right and it was
// the one thing it did better: it emitted `<ul data-testid="mesh-list"
// className="sr-only">` on every render, unconditionally, listing every item
// with its own label. Restoring the canvas verbatim threw that away, and
// scripts/platform-diagnostics.mjs (mesh-testability, P1) certifies exactly
// this property. The honest fix was to bring the guarantee back rather than to
// relax the gate to match what the canvas happened to have — a gate edited
// down to fit the code it is meant to hold up has stopped being a gate.
//
// ── WHY A SEPARATE, ALWAYS-MOUNTED OUTLINE RATHER THAN OPENING THE LIST ────
//
// Two different jobs. MeshListView is an interactive panel with a close
// button, a heading hierarchy and jump-to-node behaviour — mounting it
// permanently would put a dialog's worth of controls in every render and force
// a visual decision about a panel nobody asked to open. This is the flat
// alternative text for the picture: no controls, no focus traps, no visual
// footprint. It is `sr-only`, so sighted users see the constellation exactly as
// before and nothing about the canvas's look or behaviour changes.
//
// Each entry is a real anchor rather than a bare <li>, so the outline is
// KEYBOARD-REACHABLE and not merely readable: tabbing through /mesh now walks
// the mesh's contents and each stop lands somewhere real. A node with nowhere
// to go stays plain text — a link that goes nowhere is worse than a label.

"use client";

import type { SceneModel, SceneNode } from "../scene/scene-model";
import type { MeshCopy } from "./copy";

/** Nodes that are structure rather than content: the hub you are standing on
 *  and the six branch stalks. Reading them aloud describes the drawing, not
 *  the mesh — "Posts, branch" tells a listener nothing they can act on. */
function isStructural(node: SceneNode): boolean {
  return node.kind === "self" || node.kind === "branch";
}

/**
 * One line per node, in the same order the list view organises the world:
 * people first (closest first), then everything else newest-first. Sorting
 * here rather than trusting Map insertion order matters because the model is
 * rebuilt on every live weave — an outline whose order shuffles under a
 * listener between refreshes is a worse experience than no order at all.
 */
function outlineNodes(model: SceneModel): SceneNode[] {
  const all = Array.from(model.nodes.values()).filter((n) => !isStructural(n));
  const people = all
    .filter((n) => n.kind === "person")
    .sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0) || a.id.localeCompare(b.id));
  const rest = all
    .filter((n) => n.kind !== "person")
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || a.id.localeCompare(b.id));
  return [...people, ...rest];
}

/**
 * What to say about one node.
 *
 * Kind first, because "post" or "person" is the fact that orients a listener
 * before the name does, and the canvas conveys it with shape and colour that
 * do not survive the translation. `placeReason` is included where the scene
 * has one for the same reason the visual mesh shows it: a surface that
 * arranges things by importance owes you its reasoning, and that debt is not
 * cancelled by the reader being blind.
 */
function describe(node: SceneNode): string {
  const parts = [node.kind, node.label];
  if (node.sublabel) parts.push(node.sublabel);
  if (node.isNew) parts.push("new");
  if (node.placeReason) parts.push(node.placeReason);
  return parts.filter(Boolean).join(" — ");
}

export function MeshOutline({ model, copy }: { model: SceneModel | null; copy: MeshCopy }) {
  // Before the world arrives there is genuinely nothing to describe, and an
  // empty list announced as the mesh would be a lie about an unfinished load.
  // The scene's own loading gate (ui/gates.tsx) is what speaks in that window.
  if (!model) return null;
  const nodes = outlineNodes(model);
  if (nodes.length === 0) return null;

  return (
    <ol data-testid="mesh-list" className="sr-only" aria-label={copy.listAria}>
      {nodes.map((node) => (
        <li key={node.id}>
          {node.href ? (
            <a href={node.href} aria-label={describe(node)}>
              {describe(node)}
            </a>
          ) : (
            <span aria-label={describe(node)}>{describe(node)}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
