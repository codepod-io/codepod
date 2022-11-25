import { Tooltip, Box, IconButton } from "@mui/material";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";

export enum ToolTypes {
  delete,
  play,
  layout,
  fold,
}
export default function ToolBox({
  visible = true,
  data,
  onRunTask = (...args) => {},
}) {
  // todo: need another design pattern to control visible
  if (!visible) {
    return null;
  }
  return (
    <Box
      sx={{
        display: "flex",
        marginLeft: "10px",
        borderRadius: "4px",
        position: "absolute",
        border: "solid 1px #d6dee6",
        right: "25px",
        top: "-15px",
        background: "white",
        zIndex: 250,
        justifyContent: "center",
      }}
    >
      <Tooltip title="Run (shift-enter)">
        <IconButton
          size="small"
          onClick={() => {
            onRunTask && onRunTask(ToolTypes.play, data);
          }}
        >
          <PlayCircleOutlineIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton
          size="small"
          onClick={() => {
            onRunTask && onRunTask(ToolTypes.delete, data);
          }}
        >
          <DeleteIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Change layout">
        <IconButton
          size="small"
          onClick={() => {
            onRunTask && onRunTask(ToolTypes.layout, data);
          }}
        >
          <ViewComfyIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
