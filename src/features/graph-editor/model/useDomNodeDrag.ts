import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { ViewportType } from "../../../entities/graph";
import type { NodeDragStartHandler, NodeType } from "../../../entities/node";

type Params = {
  boardRef: RefObject<HTMLDivElement | null>;
  getWorldFromClient: (clientX: number, clientY: number, currentViewport: ViewportType) => { x: number; y: number } | null;
  setNodes: Dispatch<SetStateAction<NodeType[]>>;
  viewportRef: RefObject<ViewportType>;
};

export const useDomNodeDrag = ({ boardRef, getWorldFromClient, setNodes, viewportRef }: Params) => {
  const onNodeDragStart: NodeDragStartHandler = useCallback(
    (offset, nodeId) => {
      const boardEl = boardRef.current;
      if (!boardEl) return;

      const dragOffsetX = offset[1] / viewportRef.current.zoom;
      const dragOffsetY = offset[0] / viewportRef.current.zoom;

      const changeNodePosition = (event: MouseEvent) => {
        const world = getWorldFromClient(event.clientX, event.clientY, viewportRef.current);
        if (!world) return;

        setNodes((prev) =>
          prev.map((node) =>
            node.id === nodeId ? { ...node, position: { x: world.x - dragOffsetX, y: world.y - dragOffsetY } } : node,
          ),
        );
      };

      const dragEnd = () => {
        boardEl.removeEventListener("mousemove", changeNodePosition);
        boardEl.removeEventListener("mouseup", dragEnd);
      };

      boardEl.addEventListener("mousemove", changeNodePosition);
      boardEl.addEventListener("mouseup", dragEnd);
    },
    [boardRef, getWorldFromClient, setNodes, viewportRef],
  );

  return { onNodeDragStart };
};
