import { useParams, Link as ReactLink, Prompt } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { purple, red, grey, blue } from "@mui/material/colors";

import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import Popover from "@mui/material/Popover";
import Paper from "@mui/material/Paper";
import stripAnsi from "strip-ansi";
import IconButton from "@mui/material/IconButton";
import BuildIcon from "@mui/icons-material/Build";
import { FaCut, FaPaste } from "react-icons/fa";

import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { AiOutlineSafetyCertificate, AiFillThunderbolt } from "react-icons/ai";

import { CgMenuRound } from "react-icons/cg";
import Switch from "@mui/material/Switch";
import Popper from "@mui/material/Popper";
import TextField from "@mui/material/TextField";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FastForwardIcon from "@mui/icons-material/FastForward";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import { AiOutlineFunction } from "react-icons/ai";
import Ansi from "ansi-to-react";
import { FcAddColumn, FcDeleteColumn } from "react-icons/fc";
import { v4 as uuidv4 } from "uuid";
// const Diff2html = require("diff2html");
// import { Diff2html } from "diff2html";
import * as Diff2Html from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";

import {
  repoSlice,
  loadPodQueue,
  remoteUpdatePod,
  selectIsDirty,
} from "../../lib/store";
import * as wsActions from "../../lib/ws/actions";
import * as qActions from "../../lib/queue/actions";

function Code(props) {
  return (
    <Box
      component="pre"
      sx={{
        // mr: 1,
        // my: 0,
        display: "inline",
      }}
      {...props}
    >
      {props.children}
    </Box>
  );
}

function Text(props) {
  return (
    <Box component="span" {...props}>
      {props.children}
    </Box>
  );
}

function Flex(props) {
  return (
    <Box sx={{ display: "flex" }} {...props}>
      {props.children}
    </Box>
  );
}

function HStack(props) {
  return (
    <Stack direction="row" {...props}>
      {props.children}
    </Stack>
  );
}

export function SyncStatus({ pod }) {
  const dispatch = useDispatch();
  const isDirty = useSelector(selectIsDirty(pod.id));
  if (pod.isSyncing) {
    return (
      <Box>
        <CircularProgress />
      </Box>
    );
  } else if (isDirty) {
    return (
      <Box>
        <Button
          size="small"
          // variant="ghost"
          onClick={() => {
            dispatch(remoteUpdatePod(pod));
          }}
        >
          <ReplayIcon />
        </Button>
      </Box>
    );
  } else {
    return (
      <Box>
        <Button size="small" isDisabled>
          <CheckIcon />
        </Button>
      </Box>
    );
  }
}

export function InfoBar({ pod }) {
  /* eslint-disable no-unused-vars */
  const [hasCopied, setCopied] = useState(false);
  const [hasCopied_ns, setCopied_ns] = useState(false);

  const [show, setShow] = useState(false);
  const anchorEl = useRef(null);
  return (
    <Box>
      <IconButton
        size="small"
        ref={anchorEl}
        onClick={(e) => {
          setShow(!show);
        }}
      >
        {/* <InfoOutlinedIcon /> */}
        <InfoIcon />
      </IconButton>
      <Popper open={show} anchorEl={anchorEl.current} placement="left-start">
        <Paper>
          <Box p={5}>
            The content of the Popover.
            <Box>
              <Box>
                ID:{" "}
                <Code>
                  {
                    // pod.id.substring(0, 8)
                    pod.id
                  }
                </Code>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(pod.id);
                    setCopied(true);
                  }}
                >
                  {hasCopied ? "Copied" : "Copy"}
                </Button>
              </Box>
              <Box>
                Namespace:
                <Code>{pod.ns}</Code>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(pod.ns);
                    setCopied_ns(true);
                  }}
                >
                  {hasCopied_ns ? "Copied" : "Copy"}
                </Button>
              </Box>
              <Text mr={5}>Index: {pod.index}</Text>
              <Box>
                Parent: <Code>{pod.parent?.substring(0, 8)}</Code>
              </Box>
              <Code whiteSpace="pre-wrap">{JSON.stringify(pod, null, 2)}</Code>
            </Box>
          </Box>
        </Paper>
      </Popper>
    </Box>
  );
}

export function ClickInputButton({ callback, children, defvalue }) {
  const anchorEl = useRef(null);
  const [show, setShow] = useState(false);
  const [value, setValue] = useState(defvalue);
  return (
    <ClickAwayListener
      onClickAway={() => {
        setShow(false);
      }}
    >
      <Box>
        <IconButton
          ref={anchorEl}
          size="small"
          onClick={() => {
            // pop up a input box for entering exporrt
            setShow(!show);
          }}
        >
          {children || "Edit"}
        </IconButton>
        <Popper open={show} anchorEl={anchorEl.current} placement="top">
          <Paper>
            <TextField
              defaultValue={value}
              label="Name"
              variant="outlined"
              // focused={show}
              autoFocus
              onChange={(e) => {
                setValue(e.target.value);
              }}
              onKeyDown={(e) => {
                // enter
                // keyCode is deprecated in favor of code, but chrome didn't have
                // it ..
                if (e.keyCode === 13) {
                  console.log("enter pressed, adding", value);
                  // dispatch(repoSlice.actions.setName({ id, name: value }));
                  callback(value);
                  // clear value
                  setValue(null);
                  // click away
                  setShow(false);
                }
              }}
            />
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}

export function ExportButton({ id }) {
  const dispatch = useDispatch();
  return (
    <ClickInputButton
      callback={(value) => {
        if (value) {
          dispatch(repoSlice.actions.addPodExport({ id, name: value }));
        }
      }}
    >
      <AiOutlineFunction size={15} />
    </ClickInputButton>
  );
}

export function UpButton({ pod }) {
  const dispatch = useDispatch();
  return (
    <HoverButton
      btn1={
        <IconButton
          size="small"
          onClick={() => {
            dispatch(
              qActions.remoteAdd({
                parent: pod.parent,
                anchor: pod.id,
                type: pod.type === "DECK" ? "DECK" : pod.type,
                lang: pod.lang,
                column: pod.column,
              })
            );
          }}
        >
          <ArrowUpwardIcon sx={{ fontSize: 15 }} />
        </IconButton>
      }
      btn2={
        <IconButton
          size="small"
          onClick={() => {
            dispatch(
              qActions.remotePaste({
                parent: pod.parent,
                anchor: pod.id,
                column: pod.column,
              })
            );
          }}
        >
          <FaPaste />
        </IconButton>
      }
    />
  );
}

export function DownButton({ pod }) {
  const dispatch = useDispatch();
  return (
    <HoverButton
      btn1={
        <IconButton
          // variant="ghost"
          size="small"
          onClick={() => {
            dispatch(
              qActions.remoteAdd({
                parent: pod.parent,
                anchor: pod.id,
                shift: 1,
                type: pod.type === "DECK" ? "DECK" : pod.type,
                lang: pod.lang,
                column: pod.column,
              })
            );
          }}
        >
          <ArrowDownwardIcon sx={{ fontSize: 15 }} />
        </IconButton>
      }
      btn2={
        <IconButton
          size="small"
          // I have to use Buttons from material UI when I use disabled
          // together with onMouseLeave, otherwise, when the button is
          // disabled, the onMouseLeave is not called!
          // disabled={clip.length == 0}
          onClick={() => {
            dispatch(
              qActions.remotePaste({
                parent: pod.parent,
                anchor: pod.id,
                shift: 1,
                column: pod.column,
              })
            );
          }}
        >
          <FaPaste />
        </IconButton>
      }
    />
  );
}

export function RightButton({ pod }) {
  // This is only used in deck
  const dispatch = useDispatch();
  return (
    <IconButton
      size="small"
      onClick={() => {
        // 1. add a dec
        dispatch(
          qActions.remoteAdd({
            parent: pod.id,
            type: "DECK",
            index: pod.children.length,
            lang: pod.lang,
          })
        );
      }}
    >
      <ArrowForwardIcon sx={{ fontSize: 15 }} />
    </IconButton>
  );
}

export function FoldButton({ pod }) {
  const dispatch = useDispatch();
  return (
    <IconButton
      size="small"
      // variant="ghost"
      onClick={() => {
        dispatch(repoSlice.actions.toggleFold(pod.id));
      }}
    >
      {pod.fold ? (
        <UnfoldMoreIcon sx={{ fontSize: 15 }} />
      ) : (
        <UnfoldLessIcon sx={{ fontSize: 15 }} />
      )}
    </IconButton>
  );
}

export function ThundarMark({ pod }) {
  return (
    <Box>
      {pod.thundar && (
        <Button size="small" bg="teal.300">
          <AiFillThunderbolt /> Test{" "}
        </Button>
      )}
    </Box>
  );
}

export function RunButton({ id }) {
  const dispatch = useDispatch();
  return (
    <Flex>
      <Tooltip title="Run (shift-enter)">
        <IconButton
          size="small"
          sx={{ color: "green" }}
          onClick={() => {
            dispatch(wsActions.wsRun(id));
          }}
        >
          <PlayArrowIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Flex>
  );
}

export function DeckRunButton({ id }) {
  const dispatch = useDispatch();
  return (
    <HoverButton
      btn1={
        <IconButton
          sx={{
            color: "green",
          }}
          size="small"
          onClick={() => {
            dispatch(wsActions.wsRun(id));
          }}
        >
          <PlayArrowIcon fontSize="small" />
        </IconButton>
      }
      btn2={
        <Flex>
          <IconButton
            variant="ghost"
            sx={{
              color: "green",
            }}
            size="small"
            onClick={() => {
              dispatch(wsActions.wsPowerRun({ id }));
            }}
          >
            <FastForwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            sx={{
              color: "green",
            }}
            size="small"
            onClick={() => {
              dispatch(wsActions.wsPowerRun({ id, doEval: true }));
            }}
          >
            <PlaylistPlayIcon fontSize="small" />
          </IconButton>
        </Flex>
      }
    />
  );
}

export function ThundarButton({ pod }) {
  // this button is used for indicating side-effect. Side-effect pods are not
  // executed by run all button or run deck.
  const dispatch = useDispatch();
  return (
    <IconButton
      size="small"
      bg={pod.thundar ? "teal.300" : "default"}
      onClick={() => {
        dispatch(repoSlice.actions.toggleThundar(pod.id));
      }}
    >
      {pod.thundar ? (
        <Box>
          <AiFillThunderbolt /> Test{" "}
        </Box>
      ) : (
        <AiOutlineSafetyCertificate />
      )}
    </IconButton>
  );
}

export function UtilityMark({ pod }) {
  return (
    <Box>
      {pod.utility && (
        <Button size="small" bg="green.200">
          <Box>
            <BuildIcon style={{ fontSize: 15 }} />
          </Box>
          Utility
        </Button>
      )}
    </Box>
  );
}
export function UtilityButton({ pod }) {
  const dispatch = useDispatch();
  return (
    <IconButton
      size="small"
      bg={pod.utility ? "green.200" : "default"}
      onClick={() => {
        dispatch(repoSlice.actions.toggleUtility(pod.id));
      }}
    >
      {pod.utility ? (
        <Box>
          <Box>
            <BuildIcon style={{ fontSize: 15 }} />
          </Box>
          Utility
        </Box>
      ) : (
        <BuildIcon color="disabled" style={{ fontSize: 15 }} />
      )}
    </IconButton>
  );
}

export function DeleteButton({ pod }) {
  const dispatch = useDispatch();
  return (
    <HoverButton
      btn1={
        <IconButton
          size="small"
          // color="red"
          sx={{
            color: "red",
          }}
          onClick={() => {
            dispatch(qActions.remoteDelete({ id: pod.id }));
          }}
        >
          <DeleteIcon sx={{ fontSize: 15 }} />
        </IconButton>
      }
      btn2={
        <Flex direction="column">
          <Button
            size="small"
            onClick={() => {
              dispatch(repoSlice.actions.clearClip());
            }}
          >
            CLR
          </Button>
          <IconButton
            size="small"
            onClick={() => {
              dispatch(repoSlice.actions.markClip({ id: pod.id }));
            }}
          >
            <FaCut fontSize={15} />
          </IconButton>
        </Flex>
      }
    />
  );
}

export function HoverButton({ btn1, btn2 }) {
  const [show, setShow] = useState(false);
  const anchorEl = useRef(null);
  return (
    <Box component="span">
      <Box
        component="span"
        // pt={2}
        ref={anchorEl}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {btn1}
      </Box>
      <Popper
        open={show}
        anchorEl={anchorEl.current}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        placement="top"
      >
        <Paper>{btn2}</Paper>
      </Popper>
    </Box>
  );
}

function LanguageMenu({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      <Select
        size="small"
        placeholder="Select option"
        value={pod.lang || ""}
        onChange={(e) =>
          dispatch(
            repoSlice.actions.setPodLang({
              id: pod.id,
              lang: e.target.value,
            })
          )
        }
      >
        <MenuItem value="python">Python</MenuItem>
        <MenuItem value="julia">Julia</MenuItem>
        <MenuItem value="racket">Racket</MenuItem>
        {/* <MenuItem value="scheme">Scheme</MenuItem> */}
        <MenuItem value="javascript">JavaScript</MenuItem>
        {/* <MenuItem value="typescript">TypeScript</MenuItem> */}
        <MenuItem value="json">JSON</MenuItem>
        {/* <MenuItem value="css">CSS</MenuItem>
        <MenuItem value="html">HTML</MenuItem>
        <MenuItem value="sql">SQL</MenuItem>
        <MenuItem value="java">Java</MenuItem>
        <MenuItem value="php">PHP</MenuItem> */}
      </Select>
    </Box>
  );
}

function TypeMenu({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      <Select
        size="small"
        placeholder="Select option"
        value={pod.type || ""}
        onChange={(e) =>
          dispatch(
            repoSlice.actions.setPodType({
              id: pod.id,
              type: e.target.value,
            })
          )
        }
      >
        <MenuItem value="CODE">CODE</MenuItem>
        <MenuItem value="WYSIWYG">WYSIWYG</MenuItem>
        <MenuItem value="REPL">REPL</MenuItem>
        <MenuItem value="MD">Markdown</MenuItem>
      </Select>
    </Box>
  );
}

function IOStatus({ id, name }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const status = useSelector((state) => state.repo.pods[id].io[name]);
  if (!status) {
    return (
      <Box as="span" size="xs" variant="ghost">
        <HelpOutlineIcon color="orange" />
      </Box>
    );
  } else if ("result" in status) {
    return (
      <Button component="span" size="small">
        <CheckIcon color="green" />
      </Button>
    );
  } else if ("error" in status) {
    console.log("Error:", status);
    return (
      <Box>
        <Button
          as="span"
          onClick={(e) => {
            setAnchorEl(e.currentTarget);
          }}
        >
          <CloseIcon color="red" />
        </Button>
        <Popover
          open={Boolean(anchorEl)}
          onClose={() => {
            setAnchorEl(null);
          }}
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
        >
          <Box maxW="lg">
            <Text color="red">{status.error.evalue}</Text>
            {status.error.stacktrace && (
              <Text>
                StackTrace:
                <Code whiteSpace="pre-wrap">
                  {stripAnsi(status.error.stacktrace.join("\n"))}
                </Code>
              </Text>
            )}
          </Box>
        </Popover>
      </Box>
    );
  }
}

export function HoveringMenu({ pod, showMenu, draghandle, children }) {
  let dispatch = useDispatch();
  // const [anchorEl, setAnchorEl] = React.useState(null);
  const [show, setShow] = useState(false);
  const anchorEl = useRef(null);
  const [showForce, setShowForce] = useState(false);
  return (
    <Flex>
      {/* <Button
          size="sm"
          onClick={(e) => {
            setAnchorEl(anchorEl ? null : e.currentTarget);
          }}
        >
          Tool
        </Button> */}

      <Box
        ref={anchorEl}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        // onClick={() => setShowForce(!showForce)}
        visibility={showMenu || show || showForce ? "visible" : "hidden"}
        {...draghandle}
        cursor="grab"
      >
        <CgMenuRound size={25} />
      </Box>

      <Popper
        // open={Boolean(anchorEl)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        open={showForce || show}
        anchorEl={anchorEl.current}
        placement="left-start"
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            bgcolor: "white",
            border: "1px",
            p: 1,
            borderRadius: 2,
            boxShadow: 3,
          }}
          // direction="column"
          // bg="white"
          // border="1px"
          // p={3}
          // rounded="md"
          // boxShadow="md"
        >
          <HStack>
            {/* <Button
              size="small"
              // variant="ghost"
              onClick={() => {
                dispatch(repoSlice.actions.addColumn({ id: pod.id }));
              }}
            >
              <FcAddColumn />
            </Button> */}

            {/* <Button
              size="small"
              // variant="ghost"
              onClick={() => {
                dispatch(repoSlice.actions.deleteColumn({ id: pod.id }));
              }}
            >
              <FcDeleteColumn />
            </Button> */}
            {/* <Text as="span">col:{pod.column}</Text> */}
          </HStack>
          <HStack my={2}>
            <InfoBar pod={pod} />
            <TypeMenu pod={pod} />
            <LanguageMenu pod={pod} />
            <Button
              size="small"
              onClick={() => {
                dispatch(repoSlice.actions.toggleRaw(pod.id));
              }}
            >
              {pod.raw ? "raw" : "wrapped"}
            </Button>
          </HStack>
          <Stack>{children}</Stack>
        </Box>
      </Popper>
    </Flex>
  );
}

export function ExportList({ pod }) {
  const dispatch = useDispatch();
  if (Array.isArray(pod.exports)) {
    return (
      <Box>
        WARNING: pod.exports is an array. This was deprecated. Try clear all
        exports.
      </Box>
    );
  }
  return (
    <Box>
      {pod.exports && Object.keys(pod.exports).length > 0 && (
        <Box
          sx={{
            display: "flex",
          }}
        >
          {/* <Box
            component="span"
            sx={{
              mr: 1,
            }}
          >
            Exports:
          </Box> */}
          {Object.entries(pod.exports).map(([k, v]) => (
            <Box
              key={k}
              sx={{
                mr: 1,
                my: 0,
              }}
            >
              Exports: <Code>{k}</Code>: use: <Code>{v.join(",")}</Code>
            </Box>
          ))}
        </Box>
      )}
      {pod.reexports && Object.keys(pod.reexports).length > 0 && (
        <Box>
          {Object.entries(pod.reexports).map(([k, v]) => (
            <Box key={k}>
              RE-exports: <Code>{k}</Code>: from: <Code>{v ? v : "null"}</Code>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function ImportList({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      {pod.imports && Object.keys(pod.imports).length > 0 && (
        <Box>
          <Text as="span" mr={2}>
            Imports:
          </Text>
          {Object.entries(pod.imports).map(([k, v]) => (
            <Box key={k} as="span">
              <Code>{k}</Code>
              <Switch
                size="small"
                checked={v}
                onChange={() => {
                  dispatch(wsActions.wsToggleImport({ id: pod.id, name: k }));
                }}
              />
              <IOStatus id={pod.id} name={k} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function MidportList({ pod }) {
  const dispatch = useDispatch();
  return (
    <Box>
      {pod.midports && Object.keys(pod.midports).length > 0 && (
        <Box>
          <Text as="span" mr={2}>
            Midports:
          </Text>
          {Object.entries(pod.midports).map(([k, v]) => (
            <Box key={k}>
              <Switch
                size="small"
                checked={v}
                onChange={() => {
                  dispatch(
                    wsActions.wsToggleMidport({ id: pod.id, name: k })
                    // repoSlice.actions.togglePodMidport({
                    //   id: pod.id,
                    //   name: k,
                    // })
                  );
                }}
              />
              <Code>{k}</Code>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
