export type PanState = {
  isPanning: boolean;
  pointerId: number;
  startMouse: { x: number; y: number };
  startPan: { panX: number; panY: number };
};

export type DragState = {
  isDragging: boolean;
  pointerId: number;
  nodeId: string;
  offsetX: number;
  offsetY: number;
};
