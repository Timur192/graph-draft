import { getEdgeCurve } from "../../graph";
import type { NodeType } from "../../node";
import type { EdgeType } from "../model/types";
import styles from "./Edge.module.css";

type Props = EdgeType & {
  nodeById: (nodeId: string) => NodeType | undefined;
};

export const Edge = ({ source, target, nodeById }: Props) => {
  const sourceNode = nodeById(source);
  const targetNode = nodeById(target);

  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, x1, y1, x2, y2 } = getEdgeCurve(sourceNode, targetNode);

  return <path className={styles.edgePath} d={`M ${sx} ${sy} C ${x1} ${y1}, ${x2} ${y2}, ${tx} ${ty}`} />;
};
