import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { getNodesBounds, type ViewportType } from "../../../entities/graph";
import type { NodeType } from "../../../entities/node";

type Params = {
  boardRef: RefObject<HTMLDivElement | null>;
  nodes: NodeType[];
  nodesRef: RefObject<NodeType[]>;
  setViewport: Dispatch<SetStateAction<ViewportType>>;
};

export const useGraphCentering = ({ boardRef, nodes, nodesRef, setViewport }: Params) => {
  const hasInitialCenterRef = useRef(false);

  const centerGraph = useCallback(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return false;

    const rect = boardEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const bounds = getNodesBounds(nodesRef.current);
    if (!bounds) return false;

    setViewport((current) => ({
      ...current,
      panX: rect.width / 2 - bounds.centerX * current.zoom,
      panY: rect.height / 2 - bounds.centerY * current.zoom,
    }));

    return true;
  }, [boardRef, nodesRef, setViewport]);

  const centerSceneOnStart = useCallback(() => {
    if (hasInitialCenterRef.current) return;
    const centered = centerGraph();
    if (centered) {
      hasInitialCenterRef.current = true;
    }
  }, [centerGraph]);

  useEffect(() => {
    centerSceneOnStart();
  }, [centerSceneOnStart, nodes]);

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl || hasInitialCenterRef.current) return;

    const observer = new ResizeObserver(() => {
      centerSceneOnStart();
    });

    observer.observe(boardEl);

    return () => {
      observer.disconnect();
    };
  }, [boardRef, centerSceneOnStart]);

  return { centerGraph };
};
