import { useStore } from "zustand";
import { RepoContext, RoleType } from "../lib/store";
import Box from "@mui/material/Box";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import React, { useContext } from "react";
import CodeIcon from "@mui/icons-material/Code";
import PostAddIcon from "@mui/icons-material/PostAdd";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";

const paneMenuStyle = (left, top) => {
  return {
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 100,
    position: "absolute",
    boxShadow: "0px 1px 8px 0px rgba(0, 0, 0, 0.1)",
    // width: '200px',
    backgroundColor: "#fff",
    borderRadius: "5px",
    boxSizing: "border-box",
  } as React.CSSProperties;
};

const ItemStyle = {
  "&:hover": {
    background: "#f1f3f7",
    color: "#4b00ff",
  },
};

export function CanvasContextMenu(props) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const showLineNumbers = useStore(store, (state) => state.showLineNumbers);
  const flipShowLineNumbers = useStore(
    store,
    (state) => state.flipShowLineNumbers
  );
  const role = useStore(store, (state) => state.role);
  return (
    <Box sx={paneMenuStyle(props.x, props.y)}>
      <MenuList className="paneContextMenu">
        {role !== RoleType.GUEST && (
          <MenuItem onClick={props.addCode} sx={ItemStyle}>
            <ListItemIcon>
              <CodeIcon />
            </ListItemIcon>
            <ListItemText>New Code</ListItemText>
          </MenuItem>
        )}
        {role !== RoleType.GUEST && (
          <MenuItem onClick={props.addScope} sx={ItemStyle}>
            <ListItemIcon>
              <PostAddIcon />
            </ListItemIcon>
            <ListItemText>New Scope</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={flipShowLineNumbers} sx={ItemStyle}>
          <ListItemIcon>
            <FormatListNumberedIcon />
          </ListItemIcon>
          <ListItemText>
            {showLineNumbers ? "Hide " : "Show "} Line Numbers
          </ListItemText>
        </MenuItem>
      </MenuList>
    </Box>
  );
}
