import { PaperWait } from "@/components/loading/paper-wait";
import { cn } from "@/lib/utils";

const nodes = [
  [96, 116, 5], [198, 65, 4], [313, 93, 5], [373, 191, 4],
  [307, 296, 5], [194, 337, 4], [83, 271, 5], [47, 192, 3],
  [151, 170, 4], [258, 158, 4], [267, 237, 3], [174, 249, 4],
] as const;

const strands = [
  "M96 116 198 65 313 93 373 191 307 296 194 337 83 271 47 192 96 116",
  "M96 116 151 170 210 202 258 158 313 93",
  "M47 192 151 170 174 249 83 271",
  "M198 65 258 158 267 237 307 296",
  "M373 191 267 237 210 202 174 249 194 337",
] as const;

/** A finite SVG arrival. No canvas, animation loop, timer, or duplicated Meshi. */
export function MeshFormingLoader({ label = "Forming your mesh…", backdrop = false, className }: { label?: string; backdrop?: boolean; className?: string }) {
  return (
    <div
      className={cn("mesh-forming-surface", backdrop && "mesh-forming-backdrop", className)}
      {...(backdrop ? { "aria-hidden": true as const } : { role: "status" as const, "aria-live": "polite" as const, "aria-busy": true as const })}
    >
      <svg className="mesh-forming-diagram" viewBox="0 0 420 400" aria-hidden="true">
        <circle className="mesh-forming-orbit" cx="210" cy="202" r="148" />
        <circle className="mesh-forming-orbit" cx="210" cy="202" r="79" />
        <g>{strands.map(d => <path key={d} className="mesh-forming-strand" d={d} pathLength={1} />)}</g>
        <g>{nodes.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} className="mesh-forming-node" cx={cx} cy={cy} r={r} />)}</g>
        <circle className="mesh-forming-core" cx="210" cy="202" r="12" />
        <circle className="mesh-forming-core-dot" cx="210" cy="202" r="3" />
      </svg>
      {!backdrop && (label ? <div className="mesh-forming-label"><PaperWait /><span>{label}</span></div> : <span className="sr-only">Forming your mesh</span>)}
    </div>
  );
}
