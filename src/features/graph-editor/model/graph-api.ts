import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { EdgeType } from "../../../entities/edge";
import {
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  updateEdge,
  updateNode,
  type CreateEdgeInput,
  type CreateNodeInput,
  type GraphState,
  type UpdateEdgePatch,
  type UpdateNodePatch,
} from "../../../entities/graph";
import type { NodeType } from "../../../entities/node";

type Params = {
  edgesRef: MutableRefObject<EdgeType[]>;
  nodesRef: MutableRefObject<NodeType[]>;
  setEdges: Dispatch<SetStateAction<EdgeType[]>>;
  setNodes: Dispatch<SetStateAction<NodeType[]>>;
};

export type GraphApi = {
  createEdge: (input: CreateEdgeInput) => void;
  createNode: (input: CreateNodeInput) => void;
  deleteEdge: (edgeId: string) => void;
  deleteNode: (nodeId: string) => void;
  updateEdge: (edgeId: string, patch: UpdateEdgePatch) => void;
  updateNode: (nodeId: string, patch: UpdateNodePatch) => void;
};

export const useGraphApi = ({ edgesRef, nodesRef, setEdges, setNodes }: Params): GraphApi => {
  const applyMutation = useCallback(
    (mutate: (graph: GraphState) => GraphState) => {
      const currentGraph: GraphState = {
        edges: edgesRef.current,
        nodes: nodesRef.current,
      };

      const nextGraph = mutate(currentGraph);

      if (nextGraph.nodes !== currentGraph.nodes) {
        nodesRef.current = nextGraph.nodes;
        setNodes(nextGraph.nodes);
      }

      if (nextGraph.edges !== currentGraph.edges) {
        edgesRef.current = nextGraph.edges;
        setEdges(nextGraph.edges);
      }
    },
    [edgesRef, nodesRef, setEdges, setNodes],
  );

  const onNodeCreate = useCallback(
    (input: CreateNodeInput) => {
      applyMutation((graph) => createNode(graph, input));
    },
    [applyMutation],
  );

  const onNodeUpdate = useCallback(
    (nodeId: string, patch: UpdateNodePatch) => {
      applyMutation((graph) => updateNode(graph, nodeId, patch));
    },
    [applyMutation],
  );

  const onNodeDelete = useCallback(
    (nodeId: string) => {
      applyMutation((graph) => deleteNode(graph, nodeId));
    },
    [applyMutation],
  );

  const onEdgeCreate = useCallback(
    (input: CreateEdgeInput) => {
      applyMutation((graph) => createEdge(graph, input));
    },
    [applyMutation],
  );

  const onEdgeUpdate = useCallback(
    (edgeId: string, patch: UpdateEdgePatch) => {
      applyMutation((graph) => updateEdge(graph, edgeId, patch));
    },
    [applyMutation],
  );

  const onEdgeDelete = useCallback(
    (edgeId: string) => {
      applyMutation((graph) => deleteEdge(graph, edgeId));
    },
    [applyMutation],
  );

  return useMemo(
    () => ({
      createEdge: onEdgeCreate,
      createNode: onNodeCreate,
      deleteEdge: onEdgeDelete,
      deleteNode: onNodeDelete,
      updateEdge: onEdgeUpdate,
      updateNode: onNodeUpdate,
    }),
    [onEdgeCreate, onEdgeDelete, onEdgeUpdate, onNodeCreate, onNodeDelete, onNodeUpdate],
  );
};
