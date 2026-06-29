"use client";

import { useMemo } from "react";
import { LocateFixed, Waypoints } from "lucide-react";
import type { FilterType, MeshNode } from "./mesh-types";

interface MeshMiniMapProps {
  nodes: MeshNode[];
  filter: FilterType;
  selectedNode: MeshNode | null;
  hoveredNode: MeshNode | null;
  onFocusNode: (node: MeshNode) => void;
  onFitView: () => void;
}

function getVisibleNodes(nodes: MeshNode[], filter: FilterType) {
  if (filter === "all") return nodes;
  return nodes.filter((node) => node.type === filter || node.type === "self");
}

export function MeshMiniMap({
  nodes,
  filter,
  selectedNode,
  hoveredNode,
  onFocusNode,
  onFitView,
}: MeshMiniMapProps) {
  const visibleNodes = useMemo(() => getVisibleNodes(nodes, filter), [filter, nodes]);

  const bounds = useMemo(() => {
    if (visibleNodes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    visibleNodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return { minX, minY, width, height };
  }, [visibleNodes]);

  if (!bounds || visibleNodes.length === 0) return null;

  const plottedNodes = visibleNodes.map((node, index) => {
    let left = 8 + ((node.x - bounds.minX) / bounds.width) * 84;
    let top = 8 + ((node.y - bounds.minY) / bounds.height) * 84;
    const angle = index * 2.399963229728653;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const overlaps = visibleNodes.slice(0, index).some((previousNode, previousIndex) => {
        const previousLeft = 8 + ((previousNode.x - bounds.minX) / bounds.width) * 84;
        const previousTop = 8 + ((previousNode.y - bounds.minY) / bounds.height) * 84;
        const previousAngle = previousIndex * 2.399963229728653;
        const adjustedPreviousLeft = Math.max(6, Math.min(94, previousLeft + Math.cos(previousAngle) * 2.2));
        const adjustedPreviousTop = Math.max(6, Math.min(94, previousTop + Math.sin(previousAngle) * 2.2));
        return Math.hypot(left - adjustedPreviousLeft, top - adjustedPreviousTop) < 4.5;
      });

      if (!overlaps) break;
      left = Math.max(6, Math.min(94, left + Math.cos(angle + attempt) * 2.8));
      top = Math.max(6, Math.min(94, top + Math.sin(angle + attempt) * 2.8));
    }

    return { node, left, top };
  });

  return (
    <aside
      data-meshi-zone="mesh-mini-map"
      className="mesh-mini-map absolute bottom-4 right-3 z-10 hidden w-52 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/42 shadow-lg shadow-black/25 backdrop-blur-2xl lg:block"
      aria-label="Mini Mesh map"
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Waypoints className="h-3.5 w-3.5 shrink-0 text-white/62" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-white">Mini Mesh</p>
            <p className="text-[9px] font-semibold text-white/42">{visibleNodes.length} visible nodes</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFitView}
          className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white active:scale-95"
          title="Fit Mesh to view"
          aria-label="Fit Mesh to view"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative h-32 overflow-hidden">
        <div className="absolute inset-3 rounded-xl border border-white/[0.05] bg-white/[0.025]" aria-hidden="true" />
        {plottedNodes.map(({ node, left, top }) => {
          const isSelected = selectedNode?.id === node.id;
          const isHovered = hoveredNode?.id === node.id;
          const size = node.type === "self" ? 10 : isSelected ? 9 : isHovered ? 8 : 6;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onFocusNode(node)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform hover:scale-125 focus-visible:scale-125"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${size}px`,
                height: `${size}px`,
                zIndex: node.type === "self" ? 3 : isSelected || isHovered ? 2 : 1,
                backgroundColor: node.color,
                borderColor: isSelected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.28)",
                boxShadow: isSelected || isHovered ? `0 0 18px ${node.color}` : "0 0 8px rgba(255,255,255,0.08)",
              }}
              title={node.label}
              aria-label={`Focus ${node.label}`}
            />
          );
        })}
      </div>
    </aside>
  );
}
