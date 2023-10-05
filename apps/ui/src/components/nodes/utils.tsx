import {
  Position,
  internalsSymbol,
  Node,
  NodePositionChange,
  XYPosition,
  Handle,
} from "reactflow";

import { useContext, useState } from "react";

import Button from "@mui/material/Button";
import CodeIcon from "@mui/icons-material/Code";
import NoteIcon from "@mui/icons-material/Note";

import { useStore } from "zustand";

import { RepoContext } from "../../lib/store";
import {
  Box,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Popper,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import React from "react";

export function ResizeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="#ff0071"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", right: 5, bottom: 5 }}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <polyline points="16 20 20 20 20 16" />
      <line x1="14" y1="14" x2="20" y2="20" />
      <polyline points="8 4 4 4 4 8" />
      <line x1="4" y1="4" x2="10" y2="10" />
    </svg>
  );
}

// returns the position (top,right,bottom or right) passed node compared to
function getParams(nodeA, nodeB) {
  const centerA = getNodeCenter(nodeA);
  const centerB = getNodeCenter(nodeB);

  const horizontalDiff = Math.abs(centerA.x - centerB.x);
  const verticalDiff = Math.abs(centerA.y - centerB.y);

  let position;

  // when the horizontal difference between the nodes is bigger, we use Position.Left or Position.Right for the handle
  if (horizontalDiff > verticalDiff) {
    position = centerA.x > centerB.x ? Position.Left : Position.Right;
  } else {
    // here the vertical difference between the nodes is bigger, so we use Position.Top or Position.Bottom for the handle
    position = centerA.y > centerB.y ? Position.Top : Position.Bottom;
  }

  const [x, y] = getHandleCoordsByPosition(nodeA, position);
  return [x, y, position];
}

export function sortNodes(nodeIds, nodesMap) {
  nodeIds.sort((id1, id2) => {
    const node1 = nodesMap.get(id1);
    const node2 = nodesMap.get(id2);
    if (node1 && node2) {
      if (node1.position.y === node2.position.y) {
        return node1.position.x - node2.position.x;
      } else {
        return node1.position.y - node2.position.y;
      }
    } else {
      return 0;
    }
  });
}

function getHandleCoordsByPosition(node, handlePosition) {
  // all handles are from type source, that's why we use handleBounds.source here
  const handle = node[internalsSymbol].handleBounds.source.find(
    (h) => h.position === handlePosition
  );

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  // this is a tiny detail to make the markerEnd of an edge visible.
  // The handle position that gets calculated has the origin top-left, so depending which side we are using, we add a little offset
  // when the handlePosition is Position.Right for example, we need to add an offset as big as the handle itself in order to get the correct position
  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handle.width;
      break;
    case Position.Top:
      offsetY = 0;
      break;
    case Position.Bottom:
      offsetY = handle.height;
      break;
  }

  const x = node.positionAbsolute.x + handle.x + offsetX;
  const y = node.positionAbsolute.y + handle.y + offsetY;

  return [x, y];
}

function getNodeCenter(node) {
  return {
    x: node.positionAbsolute.x + node.width / 2,
    y: node.positionAbsolute.y + node.height / 2,
  };
}

// returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) you need to create an edge
export function getEdgeParams(source, target) {
  const [sx, sy, sourcePos] = getParams(source, target);
  const [tx, ty, targetPos] = getParams(target, source);

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePos,
    targetPos,
  };
}

type GetHelperLinesResult = {
  horizontal?: number;
  vertical?: number;
  snapPosition: Partial<XYPosition>;
};

// this utility function can be called with a position change (inside onNodesChange)
// it checks all other nodes and calculated the helper line positions and the position where the current node should snap to
export function getHelperLines(
  change: NodePositionChange,
  nodes: Node[],
  distance = 5
): GetHelperLinesResult {
  const defaultResult = {
    horizontal: undefined,
    vertical: undefined,
    snapPosition: { x: undefined, y: undefined },
  };
  const nodeA = nodes.find((node) => node.id === change.id);

  if (!nodeA || !change.position) {
    return defaultResult;
  }

  const nodeABounds = {
    left: change.position.x,
    right: change.position.x + (nodeA.width ?? 0),
    top: change.position.y,
    bottom: change.position.y + (nodeA.height ?? 0),
    width: nodeA.width ?? 0,
    height: nodeA.height ?? 0,
  };

  let horizontalDistance = distance;
  let verticalDistance = distance;

  return nodes
    .filter((node) => node.id !== nodeA.id)
    .reduce<GetHelperLinesResult>((result, nodeB) => {
      const nodeBBounds = {
        left: nodeB.position.x,
        right: nodeB.position.x + (nodeB.width ?? 0),
        top: nodeB.position.y,
        bottom: nodeB.position.y + (nodeB.height ?? 0),
        width: nodeB.width ?? 0,
        height: nodeB.height ?? 0,
      };

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //  |
      //  |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceLeftLeft = Math.abs(nodeABounds.left - nodeBBounds.left);

      if (distanceLeftLeft < verticalDistance) {
        result.snapPosition.x = nodeBBounds.left;
        result.vertical = nodeBBounds.left;
        verticalDistance = distanceLeftLeft;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //              |
      //              |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceRightRight = Math.abs(
        nodeABounds.right - nodeBBounds.right
      );

      if (distanceRightRight < verticalDistance) {
        result.snapPosition.x = nodeBBounds.right - nodeABounds.width;
        result.vertical = nodeBBounds.right;
        verticalDistance = distanceRightRight;
      }

      //              |‾‾‾‾‾‾‾‾‾‾‾|
      //              |     A     |
      //              |___________|
      //              |
      //              |
      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     B     |
      //  |___________|
      const distanceLeftRight = Math.abs(nodeABounds.left - nodeBBounds.right);

      if (distanceLeftRight < verticalDistance) {
        result.snapPosition.x = nodeBBounds.right;
        result.vertical = nodeBBounds.right;
        verticalDistance = distanceLeftRight;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|
      //              |
      //              |
      //              |‾‾‾‾‾‾‾‾‾‾‾|
      //              |     B     |
      //              |___________|
      const distanceRightLeft = Math.abs(nodeABounds.right - nodeBBounds.left);

      if (distanceRightLeft < verticalDistance) {
        result.snapPosition.x = nodeBBounds.left - nodeABounds.width;
        result.vertical = nodeBBounds.left;
        verticalDistance = distanceRightLeft;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|‾‾‾‾‾|‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |     |     B     |
      //  |___________|     |___________|
      const distanceTopTop = Math.abs(nodeABounds.top - nodeBBounds.top);

      if (distanceTopTop < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.top;
        result.horizontal = nodeBBounds.top;
        horizontalDistance = distanceTopTop;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |
      //  |___________|_________________
      //                    |           |
      //                    |     B     |
      //                    |___________|
      const distanceBottomTop = Math.abs(nodeABounds.bottom - nodeBBounds.top);

      if (distanceBottomTop < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.top - nodeABounds.height;
        result.horizontal = nodeBBounds.top;
        horizontalDistance = distanceBottomTop;
      }

      //  |‾‾‾‾‾‾‾‾‾‾‾|     |‾‾‾‾‾‾‾‾‾‾‾|
      //  |     A     |     |     B     |
      //  |___________|_____|___________|
      const distanceBottomBottom = Math.abs(
        nodeABounds.bottom - nodeBBounds.bottom
      );

      if (distanceBottomBottom < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.bottom - nodeABounds.height;
        result.horizontal = nodeBBounds.bottom;
        horizontalDistance = distanceBottomBottom;
      }

      //                    |‾‾‾‾‾‾‾‾‾‾‾|
      //                    |     B     |
      //                    |           |
      //  |‾‾‾‾‾‾‾‾‾‾‾|‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
      //  |     A     |
      //  |___________|
      const distanceTopBottom = Math.abs(nodeABounds.top - nodeBBounds.bottom);

      if (distanceTopBottom < horizontalDistance) {
        result.snapPosition.y = nodeBBounds.bottom;
        result.horizontal = nodeBBounds.bottom;
        horizontalDistance = distanceTopBottom;
      }

      return result;
    }, defaultResult);
}

/**
 * The 4 handles for connecting reactflow nodes, with pop-up buttons for adding
 * new nodes.
 */
export const Handles = ({ xPos, yPos, width, height, parent }) => {
  return (
    <>
      <MyHandle
        position={Position.Top}
        width={width}
        height={height}
        parent={parent}
        xPos={xPos}
        yPos={yPos}
      />
      <MyHandle
        position={Position.Bottom}
        width={width}
        height={height}
        parent={parent}
        xPos={xPos}
        yPos={yPos}
      />
      <MyHandle
        position={Position.Left}
        width={width}
        height={height}
        parent={parent}
        xPos={xPos}
        yPos={yPos}
      />
      <MyHandle
        position={Position.Right}
        width={width}
        height={height}
        parent={parent}
        xPos={xPos}
        yPos={yPos}
      />
    </>
  );
};

/**
 * The Wrapped Hanlde with pop-up buttons.
 */
const MyHandle = ({ position, width, height, parent, xPos, yPos }) => {
  return (
    <WrappedHandle position={position}>
      <HandleButton
        position={position}
        width={width}
        height={height}
        parent={parent}
        xPos={xPos}
        yPos={yPos}
      />
    </WrappedHandle>
  );
};

const ClickAwayContext = React.createContext<() => void>(() => {});

/**
 * A react Handle wrapped with a popper and click away listener.
 */
const WrappedHandle = ({ position, children }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };
  const store = useContext(RepoContext)!;
  const moved = useStore(store, (state) => state.moved);
  const open = Boolean(anchorEl);
  const handler = React.useCallback((e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setAnchorEl(null);
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, []);
  // Remove the popper when the Canvas is moved.
  React.useEffect(() => {
    setAnchorEl(null);
  }, [moved]);
  return (
    <>
      <Handle
        id={position}
        type="source"
        position={position}
        onClick={handleClick}
      />

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement={position}
        disablePortal={true}
      >
        <ClickAwayListener
          onClickAway={() => {
            setAnchorEl(null);
          }}
        >
          <Box>
            {/* Must wrap the ClickAwayContext.Provider in this <Box> elem for the click away functionality to work. */}
            <ClickAwayContext.Provider value={() => setAnchorEl(null)}>
              {children}
            </ClickAwayContext.Provider>
          </Box>
        </ClickAwayListener>
      </Popper>
    </>
  );
};

/**
 * The two buttons.
 */
const HandleButton = ({ position, width, height, parent, xPos, yPos }) => {
  const store = useContext(RepoContext)!;
  const addNode = useStore(store, (state) => state.addNode);
  const clickAway = useContext(ClickAwayContext);
  switch (position) {
    case Position.Top:
      yPos = yPos - height! - 50;
      break;
    case Position.Bottom:
      yPos = yPos + height! + 50;
      break;
    case Position.Left:
      xPos = xPos - width! - 50;
      break;
    case Position.Right:
      xPos = xPos + width! + 50;
      break;
  }
  return (
    <Stack sx={{ border: 1, p: 1, bgcolor: "background.paper" }} spacing={1}>
      <Button
        variant="contained"
        onClick={() => {
          addNode("CODE", { x: xPos, y: yPos }, parent);
          clickAway();
        }}
      >
        Code
      </Button>
      <Button
        variant="contained"
        onClick={() => {
          addNode("RICH", { x: xPos, y: yPos }, parent);
          clickAway();
        }}
      >
        Rich
      </Button>
    </Stack>
  );
};

export function level2fontsize(
  level: number,
  contextualZoomParams: Record<any, number>,
  contextualZoom: boolean
) {
  // default font size
  if (!contextualZoom) return 16;
  // when contextual zoom is on
  switch (level) {
    case 0:
      return contextualZoomParams[0];
    case 1:
      return contextualZoomParams[1];
    case 2:
      return contextualZoomParams[2];
    case 3:
      return contextualZoomParams[3];
    default:
      return contextualZoomParams.next;
  }
}

// A delete button that requires confirmation.
// Have to use React.forwardRef to allows <Tooltip> over this component. Ref:
// https://mui.com/material-ui/guides/composition/#caveat-with-refs
export const ConfirmDeleteButton = React.forwardRef(
  ({ handleConfirm, ...props }: any, ref) => {
    const [open, setOpen] = useState(false);
    return (
      <Box>
        <IconButton
          onClick={() => {
            setOpen(true);
          }}
          {...props}
        >
          <DeleteIcon fontSize="inherit" />
        </IconButton>
        <Dialog
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          fullWidth
        >
          <DialogTitle>{`Please confirm deletion`}</DialogTitle>
          <DialogContent>Are you sure?</DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleConfirm();
                setOpen(false);
              }}
              autoFocus
              color="error"
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
);

export function downloadLink(dataUrl, fileName) {
  let element = document.createElement("a");
  element.setAttribute("href", dataUrl);
  element.setAttribute("download", fileName);

  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
}

export function repo2ipynb(nodesMap, codeMap, resultMap, repoId, repoName) {
  const nodes = Array.from<Node>(nodesMap.values());

  // Hard-code Jupyter cell format. Reference, https://nbformat.readthedocs.io/en/latest/format_description.html
  let jupyterCellList: {
    cell_type: string;
    execution_count?: number;
    metadata: object;
    source: string[];
    outputs?: object[];
  }[] = [];

  // 1. iteratively retrieve and sort all pods level by level
  // Queue to sort the pods geographically
  let q = new Array<[Node | undefined, string]>();
  // adjacency list for podId -> parentId mapping
  let adj = {};
  q.push([undefined, "0.0"]);
  while (q.length > 0) {
    let [curPod, curScore] = q.shift()!;
    let children: string[] = [];
    if (curScore === "0.0") {
      // fetch top-level nodes
      children = nodes.filter((n) => !n.parentNode).map((node) => node.id);
    } else {
      children = nodes
        .filter((n) => n.parentNode === curPod?.id)
        .map((n) => n.id);
    }

    // sort the pods geographically(top-down, left-right)
    sortNodes(children, nodesMap);

    children.forEach((id, index) => {
      const pod = nodesMap.get(id)!;
      let geoScore = `${curScore}${index + 1}`;
      adj[pod.id] = {
        name: pod.data.name,
        parentId: pod.parentNode || "ROOT",
      };
      switch (pod.type) {
        case "SCOPE":
          q.push([
            pod,
            geoScore.substring(0, geoScore.length - 1) +
              "0" +
              geoScore.substring(geoScore.length - 1),
          ]);
          break;
        case "CODE":
          jupyterCellList.push({
            cell_type: "code",
            // TODO: expand other Codepod related-metadata fields, or run a real-time search in database when importing.
            metadata: { id: pod.id, geoScore: Number(geoScore) },
            source: [],
          });
          break;
        case "RICH":
          jupyterCellList.push({
            cell_type: "markdown",
            // TODO: expand other Codepod related-metadata fields, or run a real-time search in database when importing.
            metadata: { id: pod.id, geoScore: Number(geoScore) },
            source: ["TODO"], // [pod.richContent || ""],
          });
          break;
      }
    });
  }

  // sort the generated cells by their geoScore
  jupyterCellList.sort((cell1, cell2) => {
    if (
      Number(cell1.metadata["geoScore"]) < Number(cell2.metadata["geoScore"])
    ) {
      return -1;
    } else {
      return 1;
    }
  });

  // 2. fill in the sources and outputs for sorted cell lists
  jupyterCellList.forEach((pod) => {
    // generate the scope structure as comment for each cell
    let scopes: string[] = [];
    let parentId = adj[pod.metadata["id"]].parentId;

    // iterative {parentId,name} retrieval
    while (parentId && parentId != "ROOT") {
      scopes.push(adj[parentId].name);
      parentId = adj[parentId].parentId;
    }

    // Add scope structure as a block comment at the head of each cell
    // FIXME, RICH pod should have a different format
    let scopeStructureAsComment =
      scopes.length > 0
        ? [
            "'''\n",
            `CodePod Scope structure: ${scopes.reverse().join("/")}\n`,
            "'''\n",
          ]
        : [""];
    switch (pod.cell_type) {
      case "code":
        const result = resultMap.get(pod.metadata["id"]);
        let podOutput: any[] = [];
        for (const item of result?.data || []) {
          switch (item.type) {
            case "execute_result":
              podOutput.push({
                output_type: item.type,
                data: {
                  "text/plain": (item.text || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                  "text/html": (item.html || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                },
                execution_count: result!.exec_count,
              });
              break;
            case "display_data":
              podOutput.push({
                output_type: item.type,
                data: {
                  "text/plain": (item.text || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                  "text/html": (item.html || "")
                    .split(/\r?\n/)
                    .map((line) => line + "\n") || [""],
                  "image/png": item.image,
                },
              });
              break;
            case "stream_stdout":
              podOutput.push({
                output_type: "stream",
                name: "stdout",
                text: (item.text || "")
                  .split(/\r?\n/)
                  .map((line) => line + "\n"),
              });
              break;
            case "stream_stderr":
              podOutput.push({
                output_type: "stream",
                name: "stderr",
                text: (item.text || "")
                  .split(/\r?\n/)
                  .map((line) => line + "\n"),
              });
              break;
            default:
              break;
          }
        }
        const error = result?.error;
        if (error) {
          podOutput.push({
            output_type: "error",
            ename: error.ename,
            evalue: error.evalue,
            traceback: error.stacktrace,
          });
        }

        const contentArray =
          codeMap
            .get(pod.metadata["id"])
            ?.toString()
            .split(/\r?\n/)
            .map((line) => line + "\n") || [];
        pod.source = [...scopeStructureAsComment, ...contentArray];
        pod.outputs = podOutput;
        pod.execution_count = result?.exec_count;
        break;
      case "markdown":
        pod.source = [...scopeStructureAsComment, "TODO"];
        break;
      default:
        break;
    }
  });

  // 3. produce the final .ipynb file
  const fileContent = JSON.stringify(
    {
      // hard-code Jupyter Notebook top-level metadata
      metadata: {
        name: repoName,
        kernelspec: {
          name: "python3",
          display_name: "Python 3",
        },
        language_info: { name: "python" },
        Codepod_version: "v0.0.1",
        Codepod_repo_id: `${repoId}`,
      },
      nbformat: 4.0,
      nbformat_minor: 0,
      cells: jupyterCellList,
    },
    null,
    4
  );

  return fileContent;
}
