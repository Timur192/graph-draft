import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boardPointToWorld, createNodeMap, getBoardPointFromClient, type RenderMode, type ViewportType } from "../../../entities/graph";
import type { EdgeType } from "../../../entities/edge";
import type { NodeType } from "../../../entities/node";
import { INITIAL_EDGES, INITIAL_NODES, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./constants";
import { useBoardInteractions } from "./useBoardInteractions";
import { useDomNodeDrag } from "./useDomNodeDrag";
import { useGraphCentering } from "./useGraphCentering";

export const useGraphController = () => {
  const [nodes, setNodes] = useState<NodeType[]>(INITIAL_NODES);
  const [edges] = useState<EdgeType[]>(INITIAL_EDGES);
  const [viewport, setViewport] = useState<ViewportType>({ panX: 0, panY: 0, zoom: 1 });
  const [renderMode, setRenderMode] = useState<RenderMode>("dom");

  const boardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  const nodesRef = useRef(nodes);

  const webGpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

  const nodesMap = useMemo(() => createNodeMap(nodes), [nodes]);
  const nodeById = useCallback((nodeId: string) => nodesMap.get(nodeId), [nodesMap]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const getWorldFromClient = useCallback((clientX: number, clientY: number, currentViewport: ViewportType) => {
    const boardEl = boardRef.current;
    if (!boardEl) return null;

    const rect = boardEl.getBoundingClientRect();
    const boardPoint = getBoardPointFromClient(clientX, clientY, rect);
    return boardPointToWorld(boardPoint, currentViewport);
  }, []);

  const zoomAroundBoardPoint = useCallback((deltaZoom: number, boardX: number, boardY: number) => {
    setViewport((current) => {
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current.zoom + deltaZoom));
      if (nextZoom === current.zoom) return current;

      const worldX = (boardX - current.panX) / current.zoom;
      const worldY = (boardY - current.panY) / current.zoom;

      return {
        zoom: nextZoom,
        panX: boardX - worldX * nextZoom,
        panY: boardY - worldY * nextZoom,
      };
    });
  }, []);

  const zoomIn = useCallback(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const rect = boardEl.getBoundingClientRect();
    zoomAroundBoardPoint(ZOOM_STEP, rect.width / 2, rect.height / 2);
  }, [zoomAroundBoardPoint]);

  const zoomOut = useCallback(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const rect = boardEl.getBoundingClientRect();
    zoomAroundBoardPoint(-ZOOM_STEP, rect.width / 2, rect.height / 2);
  }, [zoomAroundBoardPoint]);

  const { centerGraph } = useGraphCentering({
    boardRef,
    nodes,
    nodesRef,
    setViewport,
  });

  const { onNodeDragStart } = useDomNodeDrag({
    boardRef,
    getWorldFromClient,
    setNodes,
    viewportRef,
  });

  useBoardInteractions({
    boardRef,
    getWorldFromClient,
    nodesRef,
    renderMode,
    setNodes,
    setViewport,
    viewportRef,
  });

  const setRenderModeSafe = useCallback(
    (mode: RenderMode) => {
      if (mode === "webgpu" && !webGpuAvailable) {
        setRenderMode("dom");
        return;
      }
      setRenderMode(mode);
    },
    [webGpuAvailable],
  );

  return {
    boardRef,
    centerGraph,
    edges,
    nodeById,
    nodes,
    onNodeDragStart,
    renderMode,
    setRenderMode: setRenderModeSafe,
    viewport,
    webGpuAvailable,
    zoomIn,
    zoomOut,
  };
};
