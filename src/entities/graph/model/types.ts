import type { EdgeType } from "../../edge";
import type { NodeType } from "../../node";

export type ViewportType = {
  panX: number;
  panY: number;
  zoom: number;
};

export type RenderMode = "dom" | "webgpu";

export type BoardPoint = {
  x: number;
  y: number;
};

export type WorldPoint = {
  x: number;
  y: number;
};

export type EdgeCurve = {
  sx: number;
  sy: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tx: number;
  ty: number;
};

export type NodeBounds = {
  centerX: number;
  centerY: number;
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
};

export type GraphState = {
  edges: EdgeType[];
  nodes: NodeType[];
};

export type CreateNodeInput = Omit<NodeType, "id"> & {
  id?: string;
};

export type UpdateNodePatch = Partial<Omit<NodeType, "id">>;

export type CreateEdgeInput = Omit<EdgeType, "id"> & {
  id?: string;
};

export type UpdateEdgePatch = Partial<Omit<EdgeType, "id">>;
