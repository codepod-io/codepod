import { useCallback } from "react";
import { useStore, EdgeProps, getBezierPath } from "reactflow";

import { getEdgeParams } from "./utils";

function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const sourceNode = useStore(
    useCallback((store) => store.nodeInternals.get(source), [source])
  );
  const targetNode = useStore(
    useCallback((store) => store.nodeInternals.get(target), [target])
  );

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode
  );

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      strokeWidth={5}
      markerEnd={markerEnd}
      style={selected ? { ...style, stroke: "red" } : style}
    />
  );
}

export default FloatingEdge;
