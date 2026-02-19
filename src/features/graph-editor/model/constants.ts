import type { EdgeType } from "../../../entities/edge";
import type { NodeType } from "../../../entities/node";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.2;

export const INITIAL_NODES: NodeType[] = [
  { id: "1", width: 100, height: 50, position: { x: 0, y: 0 } },
  { id: "2", width: 100, height: 50, position: { x: 120, y: 0 } },
];

export const INITIAL_EDGES: EdgeType[] = [{ id: "1-2", source: "1", target: "2" }];
