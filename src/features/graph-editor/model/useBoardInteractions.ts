import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { getBoardPointFromClient, getTopNodeAtPoint, type RenderMode, type ViewportType } from "../../../entities/graph";
import type { NodeType } from "../../../entities/node";
import { ZOOM_MAX, ZOOM_MIN } from "./constants";
import type { DragState, PanState } from "./types";

type Params = {
  boardRef: RefObject<HTMLDivElement | null>;
  getWorldFromClient: (clientX: number, clientY: number, currentViewport: ViewportType) => { x: number; y: number } | null;
  nodesRef: RefObject<NodeType[]>;
  renderMode: RenderMode;
  setNodes: Dispatch<SetStateAction<NodeType[]>>;
  setViewport: Dispatch<SetStateAction<ViewportType>>;
  viewportRef: RefObject<ViewportType>;
};

const INITIAL_PAN_STATE: PanState = {
  isPanning: false,
  pointerId: -1,
  startMouse: { x: 0, y: 0 },
  startPan: { panX: 0, panY: 0 },
};

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  pointerId: -1,
  nodeId: "",
  offsetX: 0,
  offsetY: 0,
};

export const useBoardInteractions = ({
  boardRef,
  getWorldFromClient,
  nodesRef,
  renderMode,
  setNodes,
  setViewport,
  viewportRef,
}: Params) => {
  const panRef = useRef<PanState>(INITIAL_PAN_STATE);
  const dragRef = useRef<DragState>(INITIAL_DRAG_STATE);

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = boardEl.getBoundingClientRect();
      const boardPoint = getBoardPointFromClient(event.clientX, event.clientY, rect);

      setViewport((prev) => {
        const worldX = (boardPoint.x - prev.panX) / prev.zoom;
        const worldY = (boardPoint.y - prev.panY) / prev.zoom;

        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev.zoom * Math.exp(-event.deltaY * 0.015)));

        return {
          zoom: newZoom,
          panX: boardPoint.x - worldX * newZoom,
          panY: boardPoint.y - worldY * newZoom,
        };
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-role="toolbar"]')) return;
      if (renderMode === "dom" && target.closest('[data-role="node"]')) return;

      const currentViewport = viewportRef.current;

      if (renderMode === "webgpu") {
        const world = getWorldFromClient(event.clientX, event.clientY, currentViewport);
        if (!world) return;

        const hitNode = getTopNodeAtPoint(nodesRef.current, world.x, world.y);
        if (hitNode) {
          dragRef.current = {
            isDragging: true,
            pointerId: event.pointerId,
            nodeId: hitNode.id,
            offsetX: world.x - hitNode.position.x,
            offsetY: world.y - hitNode.position.y,
          };
          boardEl.setPointerCapture(event.pointerId);
          return;
        }
      }

      panRef.current = {
        isPanning: true,
        pointerId: event.pointerId,
        startMouse: { x: event.clientX, y: event.clientY },
        startPan: {
          panX: currentViewport.panX,
          panY: currentViewport.panY,
        },
      };
      boardEl.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.isDragging && event.pointerId === drag.pointerId) {
        const world = getWorldFromClient(event.clientX, event.clientY, viewportRef.current);
        if (!world) return;

        setNodes((prev) =>
          prev.map((node) =>
            node.id === drag.nodeId
              ? {
                  ...node,
                  position: { x: world.x - drag.offsetX, y: world.y - drag.offsetY },
                }
              : node,
          ),
        );
        return;
      }

      const pan = panRef.current;
      if (!pan.isPanning || event.pointerId !== pan.pointerId) return;

      const dx = event.clientX - pan.startMouse.x;
      const dy = event.clientY - pan.startMouse.y;

      setViewport((current) => ({
        ...current,
        panX: pan.startPan.panX + dx,
        panY: pan.startPan.panY + dy,
      }));
    };

    const stopInteractions = (event: PointerEvent) => {
      const drag = dragRef.current;
      const pan = panRef.current;
      let handled = false;

      if (event.pointerId === drag.pointerId) {
        dragRef.current = INITIAL_DRAG_STATE;
        handled = true;
      }

      if (event.pointerId === pan.pointerId) {
        panRef.current = {
          ...panRef.current,
          isPanning: false,
          pointerId: -1,
        };
        handled = true;
      }

      if (handled && boardEl.hasPointerCapture(event.pointerId)) {
        boardEl.releasePointerCapture(event.pointerId);
      }
    };

    boardEl.addEventListener("wheel", onWheel, { passive: false });
    boardEl.addEventListener("pointerdown", onPointerDown);
    boardEl.addEventListener("pointermove", onPointerMove);
    boardEl.addEventListener("pointerup", stopInteractions);
    boardEl.addEventListener("pointercancel", stopInteractions);

    return () => {
      boardEl.removeEventListener("wheel", onWheel);
      boardEl.removeEventListener("pointerdown", onPointerDown);
      boardEl.removeEventListener("pointermove", onPointerMove);
      boardEl.removeEventListener("pointerup", stopInteractions);
      boardEl.removeEventListener("pointercancel", stopInteractions);
    };
  }, [boardRef, getWorldFromClient, nodesRef, renderMode, setNodes, setViewport, viewportRef]);
};
