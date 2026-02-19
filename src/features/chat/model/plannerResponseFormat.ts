export type CreateNodeParams = {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
};

export type CreateEdgeParams = {
  source: string;
  target: string;
};

export type DeleteNodeParams = {
  id: string;
};

export type DeleteEdgeParams = {
  id: string;
};

export type UpdateNodeParams = {
  id: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
};

export type PlannerAction =
  | { type: "createNode"; params: CreateNodeParams }
  | { type: "createEdge"; params: CreateEdgeParams }
  | { type: "deleteNode"; params: DeleteNodeParams }
  | { type: "deleteEdge"; params: DeleteEdgeParams }
  | { type: "updateNode"; params: UpdateNodeParams };

export type PlannerResponse = {
  actions: PlannerAction[];
  reply: string;
};

