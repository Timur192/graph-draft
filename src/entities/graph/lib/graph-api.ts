import type {
  CreateEdgeInput,
  CreateNodeInput,
  GraphState,
  UpdateEdgePatch,
  UpdateNodePatch,
} from "../model/types";

const generateUniqueId = (existingIds: Set<string>): string | null => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (!randomUUID) return null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nextId = randomUUID.call(globalThis.crypto);
    if (!existingIds.has(nextId)) {
      return nextId;
    }
  }

  return null;
};

const resolveEntityId = (requestedId: string | undefined, existingIds: Set<string>): string | null => {
  if (requestedId) {
    return existingIds.has(requestedId) ? null : requestedId;
  }

  return generateUniqueId(existingIds);
};

const hasNode = (graph: GraphState, nodeId: string): boolean => graph.nodes.some((node) => node.id === nodeId);

export const createNode = (graph: GraphState, input: CreateNodeInput): GraphState => {
  const existingIds = new Set(graph.nodes.map((node) => node.id));
  const nodeId = resolveEntityId(input.id, existingIds);
  if (!nodeId) return graph;

  return {
    ...graph,
    nodes: [...graph.nodes, { ...input, id: nodeId, position: { ...input.position } }],
  };
};

export const updateNode = (graph: GraphState, nodeId: string, patch: UpdateNodePatch): GraphState => {
  let exists = false;

  const nextNodes = graph.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    exists = true;
    return { ...node, ...patch };
  });

  if (!exists) return graph;

  return {
    ...graph,
    nodes: nextNodes,
  };
};

export const deleteNode = (graph: GraphState, nodeId: string): GraphState => {
  const nextNodes = graph.nodes.filter((node) => node.id !== nodeId);
  if (nextNodes.length === graph.nodes.length) return graph;

  return {
    nodes: nextNodes,
    edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
  };
};

export const createEdge = (graph: GraphState, input: CreateEdgeInput): GraphState => {
  if (!hasNode(graph, input.source) || !hasNode(graph, input.target)) return graph;

  const existingIds = new Set(graph.edges.map((edge) => edge.id));
  const edgeId = resolveEntityId(input.id, existingIds);
  if (!edgeId) return graph;

  return {
    ...graph,
    edges: [...graph.edges, { ...input, id: edgeId }],
  };
};

export const updateEdge = (graph: GraphState, edgeId: string, patch: UpdateEdgePatch): GraphState => {
  const currentEdge = graph.edges.find((edge) => edge.id === edgeId);
  if (!currentEdge) return graph;

  const nextEdge = { ...currentEdge, ...patch };
  if (!hasNode(graph, nextEdge.source) || !hasNode(graph, nextEdge.target)) return graph;

  return {
    ...graph,
    edges: graph.edges.map((edge) => (edge.id === edgeId ? nextEdge : edge)),
  };
};

export const deleteEdge = (graph: GraphState, edgeId: string): GraphState => {
  const nextEdges = graph.edges.filter((edge) => edge.id !== edgeId);
  if (nextEdges.length === graph.edges.length) return graph;

  return {
    ...graph,
    edges: nextEdges,
  };
};
