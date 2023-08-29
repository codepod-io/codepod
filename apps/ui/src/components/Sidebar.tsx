import { useEffect, useContext, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import Typography from "@mui/material/Typography";
import TreeView from "@mui/lab/TreeView";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeItem from "@mui/lab/TreeItem";

import { useSnackbar, VariantType } from "notistack";

import { Node as ReactflowNode } from "reactflow";

import { useStore } from "zustand";
import { MyKBar } from "./MyKBar";

import { RepoContext } from "../lib/store";

import { sortNodes } from "./nodes/utils";

import {
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  Slider,
  Input,
  Grid,
} from "@mui/material";
import { registerCompletion } from "../lib/monacoCompletionProvider";
import { SettingDialog } from "./SettingDialog";
import { toSvg } from "html-to-image";

const defaultAPIKey = import.meta.env.VITE_APP_CODEIUM_API_KEY;

function SidebarSettings() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const scopedVars = useStore(store, (state) => state.scopedVars);
  const setScopedVars = useStore(store, (state) => state.setScopedVars);
  const showAnnotations = useStore(store, (state) => state.showAnnotations);
  const setShowAnnotations = useStore(
    store,
    (state) => state.setShowAnnotations
  );
  const devMode = useStore(store, (state) => state.devMode);
  const setDevMode = useStore(store, (state) => state.setDevMode);
  const showLineNumbers = useStore(store, (state) => state.showLineNumbers);
  const setShowLineNumbers = useStore(
    store,
    (state) => state.setShowLineNumbers
  );
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);
  const setAutoRunLayout = useStore(store, (state) => state.setAutoRunLayout);
  const contextualZoom = useStore(store, (state) => state.contextualZoom);
  const setContextualZoom = useStore(store, (state) => state.setContextualZoom);
  const autoCompletion = useStore(
    store,
    (state) => !isGuest && state.autoCompletion
  );

  const setAutoCompletion = useStore(store, (state) => state.setAutoCompletion);
  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);
  const apiKey = useStore(store, (state) =>
    state.isCustomToken
      ? state.user.codeiumAPIKey ?? defaultAPIKey
      : defaultAPIKey
  );
  const setSettingOpen = useStore(store, (state) => state.setSettingOpen);

  const contextualZoomParams = useStore(
    store,
    (state) => state.contextualZoomParams
  );
  const setContextualZoomParams = useStore(
    store,
    (state) => state.setContextualZoomParams
  );
  const restoreParamsDefault = useStore(
    store,
    (state) => state.restoreParamsDefault
  );
  useEffect(() => {
    if (autoCompletion && apiKey) {
      const dispose = registerCompletion(apiKey);
      if (dispose !== null) {
        return dispose;
      }
    }
  }, [autoCompletion, apiKey]);

  return (
    <Box>
      <Box>
        <Tooltip title={"Show Line Numbers"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={showLineNumbers}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setShowLineNumbers(event.target.checked);
                  }}
                />
              }
              label="Show Line Numbers"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip
          title={"Enable Debug Mode, e.g., show pod IDs"}
          disableInteractive
        >
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={devMode}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setDevMode(event.target.checked);
                  }}
                />
              }
              label="Debug Mode"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip
          title={"Automatically run auto-layout at the end of node dragging."}
          disableInteractive
        >
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRunLayout}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setAutoRunLayout(event.target.checked);
                    if (event.target.checked) {
                      autoLayoutROOT();
                    }
                  }}
                />
              }
              label="Auto Run Layout"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Enable contextual zoom."} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={contextualZoom}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoom(event.target.checked);
                  }}
                />
              }
              label="Contextual Zoom"
            />
          </FormGroup>
        </Tooltip>
        {contextualZoom && (
          <Stack alignItems="center">
            L0 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={contextualZoomParams[0]}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      0,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      0,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 0, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 0, 8);
                    }
                  }}
                  value={contextualZoomParams[0]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L1 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={contextualZoomParams[1]}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      1,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      1,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 1, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 1, 8);
                    }
                  }}
                  value={contextualZoomParams[1]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L2 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={contextualZoomParams[2]}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      2,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      2,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 2, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 2, 8);
                    }
                  }}
                  value={contextualZoomParams[2]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L3 Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={Number(contextualZoomParams[3])}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      3,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      3,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 3, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 3, 8);
                    }
                  }}
                  value={contextualZoomParams[3]}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            L4+ Font Size
            <Grid direction="row" container spacing={2} justifyContent="center">
              <Grid item xs={8}>
                <Slider
                  aria-label="Font Size"
                  value={Number(contextualZoomParams.next)}
                  defaultValue={16}
                  aria-valuetext="size"
                  step={2}
                  marks
                  min={8}
                  max={60}
                  valueLabelDisplay="auto"
                  onChange={(event: Event, newValue: number | number[]) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      4,
                      newValue as number
                    );
                  }}
                />
              </Grid>
              <Grid item xs={3}>
                <Input
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setContextualZoomParams(
                      contextualZoomParams,
                      4,
                      Number(event.target.value)
                    );
                  }}
                  onBlur={(event) => {
                    if (Number(event.target.value) > 60) {
                      setContextualZoomParams(contextualZoomParams, 4, 60);
                    } else if (Number(event.target.value) < 8) {
                      setContextualZoomParams(contextualZoomParams, 4, 8);
                    }
                  }}
                  value={contextualZoomParams.next}
                  size="small"
                  inputProps={{
                    step: 1,
                    min: 8,
                    max: 56,
                    type: "number",
                    "aria-labelledby": "input-slider",
                  }}
                />
              </Grid>
            </Grid>
            <Button onClick={() => restoreParamsDefault()}>
              Restore Default
            </Button>
          </Stack>
        )}
        <Tooltip title={"Enable Scoped Variables"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={scopedVars}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setScopedVars(event.target.checked);
                  }}
                />
              }
              label="Scoped Variables"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Auto Completion"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={!!(apiKey && autoCompletion)}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    if (apiKey) {
                      setAutoCompletion(event.target.checked);
                    } else {
                      setSettingOpen(true);
                    }
                  }}
                />
              }
              label={
                <>
                  Auto Completion
                  <Tooltip
                    title={"Help"}
                    disableInteractive
                    sx={{ display: "inline" }}
                  >
                    <Box>
                      <IconButton
                        size="small"
                        sx={{ display: "inline" }}
                        onClick={() => setSettingOpen(true)}
                        disabled={isGuest}
                      >
                        <HelpOutlineOutlinedIcon
                          sx={{ fontSize: 14 }}
                        ></HelpOutlineOutlinedIcon>
                      </IconButton>
                    </Box>
                  </Tooltip>
                </>
              }
              disabled={isGuest}
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Show Annotations in Editor"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={showAnnotations}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setShowAnnotations(event.target.checked);
                  }}
                />
              }
              label="Enable Annotations"
            />
          </FormGroup>
        </Tooltip>
        {showAnnotations && (
          <Stack spacing={0.5}>
            <Box className="myDecoration-function">Function Definition</Box>
            <Box className="myDecoration-vardef">Variable Definition</Box>
            <Box className="myDecoration-varuse">Function/Variable Use</Box>
            <Box className="myDecoration-varuse my-underline">
              Undefined Variable
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function ToastError() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const { enqueueSnackbar } = useSnackbar();
  const error = useStore(store, (state) => state.error);
  const clearError = useStore(store, (state) => state.clearError);
  useEffect(() => {
    if (error) {
      enqueueSnackbar(`ERROR: ${error.msg}`, {
        variant: error.type as VariantType,
      });
      // I'll need to clear this msg once it is displayed
      clearError();
    }
  }, [error, enqueueSnackbar, clearError]);
  return <Box></Box>;
}

type SidebarProps = {
  width: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

function ExportJupyterNB() {
  const { id: repoId } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoName = useStore(store, (state) => state.repoName);
  const nodesMap = useStore(store, (state) => state.getNodesMap());
  const resultMap = useStore(store, (state) => state.getResultMap());
  const codeMap = useStore(store, (state) => state.getCodeMap());
  const filename = `${
    repoName || "Untitled"
  }-${new Date().toISOString()}.ipynb`;
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    const nodes = Array.from<ReactflowNode>(nodesMap.values());

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
    let q = new Array<[ReactflowNode | undefined, string]>();
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

    // Generate the download link on the fly
    let element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(fileContent)
    );
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setLoading(false);
  };

  return (
    <Button
      variant="outlined"
      size="small"
      color="secondary"
      onClick={onClick}
      disabled={false}
    >
      Jupyter Notebook
    </Button>
  );
}

function ExportSVG() {
  // The name should contain the name of the repo, the ID of the repo, and the current date
  const { id: repoId } = useParams();
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const repoName = useStore(store, (state) => state.repoName);
  const filename = `${repoName?.replaceAll(
    " ",
    "-"
  )}-${repoId}-${new Date().toISOString()}.svg`;
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    const elem = document.querySelector(".react-flow");
    if (!elem) return;
    toSvg(elem as HTMLElement, {
      filter: (node) => {
        // we don't want to add the minimap and the controls to the image
        if (
          node?.classList?.contains("react-flow__minimap") ||
          node?.classList?.contains("react-flow__controls")
        ) {
          return false;
        }

        return true;
      },
    }).then((dataUrl) => {
      const a = document.createElement("a");

      a.setAttribute("download", filename);
      a.setAttribute("href", dataUrl);
      a.click();
      setLoading(false);
    });
  };

  return (
    <Button
      variant="outlined"
      size="small"
      color="secondary"
      onClick={onClick}
      disabled={loading}
    >
      Download Image
    </Button>
  );
}

function ExportButtons() {
  return (
    <Stack spacing={1}>
      <ExportJupyterNB />
      <ExportSVG />
    </Stack>
  );
}

function PodTreeItem({ id, node2children }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const selectPod = useStore(store, (state) => state.selectPod);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const setCenterSelection = useStore(
    store,
    (state) => state.setCenterSelection
  );

  if (!node2children.has(id)) return null;
  const children = node2children.get(id);
  return (
    <TreeItem
      key={id}
      nodeId={id}
      label={id.substring(0, 8)}
      onClick={() => {
        resetSelection();
        selectPod(id, true);
        setCenterSelection(true);
      }}
    >
      {children.length > 0 &&
        children.map((child) => (
          <PodTreeItem key={child} id={child} node2children={node2children} />
        ))}
    </TreeItem>
  );
}

function TableofPods() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const nodesMap = useStore(store, (state) => state.getNodesMap());
  let node2children = new Map<string, string[]>();
  let keys = new Set(nodesMap.keys());

  for (const key of Array.from(keys)) {
    if (!node2children.has(key)) {
      node2children.set(key, []);
    }
    const parent =
      nodesMap.get(key)?.parentNode === undefined
        ? "ROOT"
        : nodesMap.get(key)?.parentNode;

    if (!node2children.has(parent!)) {
      node2children.set(parent!, []);
    }

    node2children.get(parent!)!.push(key);
  }

  for (const value of Array.from(node2children.values())) {
    if (value.length > 1) {
      sortNodes(value, nodesMap);
    }
  }

  return (
    <TreeView
      aria-label="multi-select"
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      defaultExpanded={Array.from(node2children.keys()).filter(
        (key) => node2children!.get(key!)!.length > 0
      )}
      multiSelect
    >
      {node2children.size > 0 &&
        node2children!
          .get("ROOT")!
          .map((child) => (
            <PodTreeItem key={child} id={child} node2children={node2children} />
          ))}
    </TreeView>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  width,
  open,
  onOpen,
  onClose,
}) => {
  // never render saving status / runtime module for a guest
  // FIXME: improve the implementation logic
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const isGuest = useStore(store, (state) => state.role === "GUEST");
  const settingOpen = useStore(store, (state) => state.settingOpen);
  return (
    <>
      <MyKBar />
      <Box
        sx={{
          position: "absolute",
          display: open ? "none" : "block",
          top: `54px`,
          left: 1,
        }}
      >
        <IconButton
          onClick={onOpen}
          sx={{
            zIndex: 1,
          }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      <Drawer
        sx={{
          width: width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: width,
            boxSizing: "border-box",
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            paddingLeft: "8px",
            height: 48,
          }}
        >
          <IconButton onClick={onClose}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>
        <Divider />
        <Box
          sx={{
            padding: "8px 16px",
          }}
        >
          <Stack>
            <Typography variant="h6">Export to ..</Typography>
            <ExportButtons />

            <Divider />
            <Typography variant="h6">Site Settings</Typography>
            <SidebarSettings />
            <ToastError />

            <Divider />
            <Typography variant="h6">Table of Pods</Typography>
            <TableofPods />
          </Stack>
        </Box>
      </Drawer>

      {settingOpen && <SettingDialog open={settingOpen} />}
    </>
  );
};
