export type NodePosition = {
  x: number;
  y: number;
};

export type NodeDragOffset = [offsetY: number, offsetX: number];

export type NodeDragStartHandler = (offset: NodeDragOffset, nodeId: string) => void;

export type NodeType = {
  id: string;
  position: NodePosition;
  width: number;
  height: number;
  data?: unknown;
};
