import type { GraphApi } from "../../graph-editor";
import type { PlannerAction, PlannerResponse } from "./plannerResponseFormat";

export const parsePlannerResponse = (content: string): PlannerResponse | null => {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;
    if (typeof obj["reply"] !== "string") return null;
    if (!Array.isArray(obj["actions"])) return null;

    return { actions: obj["actions"] as PlannerAction[], reply: obj["reply"] };
  } catch {
    return null;
  }
};

export const executePlannerActions = (response: PlannerResponse, graphApi: GraphApi): void => {
  for (const action of response.actions) {
    executeAction(action, graphApi);
  }
};

const executeAction = (action: PlannerAction, graphApi: GraphApi): void => {
  switch (action.type) {
    case "createNode": {
      const { id, position, width, height } = action.params;
      graphApi.createNode({ id, position, width: width ?? 120, height: height ?? 60 });
      break;
    }
    case "createEdge": {
      const { source, target } = action.params;
      graphApi.createEdge({ source, target });
      break;
    }
    case "deleteNode": {
      graphApi.deleteNode(action.params.id);
      break;
    }
    case "deleteEdge": {
      graphApi.deleteEdge(action.params.id);
      break;
    }
    case "updateNode": {
      const { id, ...patch } = action.params;
      graphApi.updateNode(id, patch);
      break;
    }
  }
};
