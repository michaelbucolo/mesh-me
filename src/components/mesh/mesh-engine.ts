// Pure physics engine for the Mesh force-directed graph.
// No React dependency — just math and node positioning.

import type { MeshNode, MeshEdge, FilterType } from "./mesh-types";

export interface SimulationConfig {
  repulsionForce: number;
  attractionForce: number;
  centerGravity: number;
  damping: number;
  settleThreshold: number;
  maxRepulsionDist: number;
}

const DEFAULT_CONFIG: SimulationConfig = {
  repulsionForce: 0.0015,
  attractionForce: 0.001,
  centerGravity: 0.00008,
  damping: 0.92,
  settleThreshold: 0.05,
  maxRepulsionDist: 2.5,
};

export class MeshEngine {
  nodes: MeshNode[] = [];
  edges: MeshEdge[] = [];
  private nodeMap = new Map<string, MeshNode>();
  private config: SimulationConfig;
  private _isSettled = false;
  private center = { x: 600, y: 400 };
  time = 0;

  constructor(config?: Partial<SimulationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isSettled(): boolean {
    return this._isSettled;
  }

  setCenter(x: number, y: number) {
    this.center = { x, y };
  }

  getCenter() {
    return this.center;
  }

  setData(nodes: MeshNode[], edges: MeshEdge[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.nodeMap.clear();
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
    }
    this._isSettled = false;
  }

  getNode(id: string): MeshNode | undefined {
    return this.nodeMap.get(id);
  }

  findNodeAt(worldX: number, worldY: number, filter: FilterType = "all"): MeshNode | null {
    // Search in reverse order so top-rendered nodes are found first
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      if (filter !== "all" && node.type !== filter && node.type !== "self") continue;
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      const hitRadius = node.radius * 1.5;
      if (dx * dx + dy * dy < hitRadius * hitRadius) return node;
    }
    return null;
  }

  /** Run one tick of the physics simulation. Returns true if still active. */
  tick(): boolean {
    this.time += 0.016;
    if (this._isSettled) return false;

    const { nodes, edges, config, center } = this;
    if (nodes.length === 0) return false;
    let totalKineticEnergy = 0;

    // Node-node repulsion
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const other = nodes[j];
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = node.radius + other.radius + 60;
        if (dist < minDist * config.maxRepulsionDist) {
          const force = (minDist * config.maxRepulsionDist - dist) * config.repulsionForce;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (node.type !== "self") { node.vx -= fx; node.vy -= fy; }
          if (other.type !== "self") { other.vx += fx; other.vy += fy; }
        }
      }

      // Center gravity
      if (node.type !== "self") {
        node.vx += (center.x - node.x) * config.centerGravity;
        node.vy += (center.y - node.y) * config.centerGravity;
      }

      // Damping
      node.vx *= config.damping;
      node.vy *= config.damping;

      // Apply velocity
      if (node.type !== "self") {
        node.x += node.vx;
        node.y += node.vy;
      }

      totalKineticEnergy += node.vx * node.vx + node.vy * node.vy;
    }

    // Edge spring forces
    for (const edge of edges) {
      const source = this.nodeMap.get(edge.source);
      const target = this.nodeMap.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const interactions = edge.interactionCount || 0;
      const interactionProximity = 1 / (1 + interactions * 0.1);
      const baseIdealDist = source.radius + target.radius + 80 + (1 - edge.strength) * 120;
      const idealDist = edge.type === "alter-ego"
        ? source.radius + target.radius + 40
        : baseIdealDist * interactionProximity;

      const diff = dist - idealDist;
      if (Math.abs(diff) > 5) {
        const force = diff * config.attractionForce * edge.strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (target.type !== "self") { target.vx -= fx; target.vy -= fy; }
        if (source.type !== "self") { source.vx += fx; source.vy += fy; }
      }
    }

    // Check if simulation has settled
    if (totalKineticEnergy < config.settleThreshold) {
      this._isSettled = true;
    }

    return !this._isSettled;
  }

  /** Wake the simulation (e.g. after external position changes). */
  wake() {
    this._isSettled = false;
  }
}
