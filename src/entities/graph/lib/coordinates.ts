import type { BoardPoint, ViewportType, WorldPoint } from "../model/types";

export const getBoardPointFromClient = (clientX: number, clientY: number, rect: DOMRect): BoardPoint => ({
  x: clientX - rect.left,
  y: clientY - rect.top,
});

export const boardPointToWorld = (point: BoardPoint, viewport: ViewportType): WorldPoint => ({
  x: (point.x - viewport.panX) / viewport.zoom,
  y: (point.y - viewport.panY) / viewport.zoom,
});

export const worldPointToBoard = (point: WorldPoint, viewport: ViewportType): BoardPoint => ({
  x: point.x * viewport.zoom + viewport.panX,
  y: point.y * viewport.zoom + viewport.panY,
});
