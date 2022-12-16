import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { AlertColor } from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useState } from "react";
import ListSubheader from "@mui/material/ListSubheader";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import CloseIcon from "@mui/icons-material/Close";
import React, { useContext, useReducer } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { useStore } from "zustand";
import { RepoContext, RoleType } from "../lib/store";
import { useApolloClient } from "@apollo/client";

const initialState = { showInfo: false, status: "info", message: "wait..." };

interface ShareProjDialogProps {
  open?: boolean;
  id?: string;
}

function reducer(state, action) {
  switch (action.type) {
    case "init": {
      return { ...initialState };
    }
    case "inivite success": {
      return {
        showInfo: true,
        status: "success",
        message: `Invitation to ${action.email} is sent successfully!`,
      };
    }
    case "inivite error": {
      return {
        showInfo: true,
        status: "error",
        message: "Invitation failed: " + action.message,
      };
    }
    case "copy success": {
      return {
        showInfo: true,
        status: "success",
        message: "Link is copied to clipboard!",
      };
    }

    case "delete success": {
      return {
        showInfo: true,
        status: "success",
        message: `Remove the collaborator ${action.name} successfully!`,
      };
    }

    case "delete error": {
      return {
        showInfo: true,
        status: "error",
        message: "Remove collaborator failed: " + action.message,
      };
    }

    case "change visibility success": {
      return {
        showInfo: true,
        status: "success",
        message: `Change visibility successfully!`,
      };
    }

    case "change visibility error": {
      return {
        showInfo: true,
        status: "error",
        message: "Change visibility failed: " + action.message,
      };
    }

    case "close info": {
      return { ...state, showInfo: false };
    }
    default:
      return { ...initialState };
  }
}

function CollaboratorList({ collaborators, dispatch, isOwner }) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const apolloClient = useApolloClient();
  const deleteCollaborator = useStore(
    store,
    (state) => state.deleteCollaborator
  );

  if (!collaborators || collaborators?.length === 0) {
    return (
      <List dense={true}>
        <ListSubheader sx={{ fontWeight: "bold" }}>Collaborators</ListSubheader>
        <ListItem>
          <ListItemIcon>
            <GroupAddIcon />
          </ListItemIcon>
          <ListItemText
            primary="No collaborators yet?"
            secondary="Invite a friend right now!"
            key="no-collaborators"
          />
        </ListItem>
      </List>
    );
  }

  async function handleDeleteCollaborator(userId, name) {
    const { success, error } = await deleteCollaborator(apolloClient, userId);
    if (success) {
      dispatch({ type: "delete success", name });
    } else {
      dispatch({ type: "delete error", message: error.message });
    }
  }

  return (
    <List
      sx={{
        maxHeight: 300,
        overflow: "auto",
      }}
      dense={true}
    >
      <ListSubheader sx={{ fontWeight: "bold" }}>Collaborators</ListSubheader>
      {collaborators?.map((collab) => (
        <ListItem
          secondaryAction={
            isOwner && (
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() =>
                  handleDeleteCollaborator(
                    collab.id,
                    collab.firstname + " " + collab.lastname
                  )
                }
              >
                <CloseIcon />
              </IconButton>
            )
          }
          sx={{ "&:hover": { backgroundColor: "#f5f5f5" } }}
          key={collab.id}
        >
          <ListItemAvatar>
            <Avatar> {collab.firstname[0] + collab.lastname[0]} </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={collab.firstname + " " + collab.lastname}
            secondary={collab.email}
            key={collab.id}
          />
        </ListItem>
      ))}
    </List>
  );
}

const aboutVisibility =
  "A private project is only visible to you and collaborators, while a public project is visible to everyone. For both of them, only the owner can invite collaborators by their email addresses, and only collaborators can edit the project. The owner can change the visibility of a project at any time.";

export function ShareProjDialog({
  open = false,
  id = "",
}: ShareProjDialogProps) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const [showHelp, setShowHelp] = useState(false);
  const [feedback, dispatch] = useReducer(reducer, initialState);
  const apolloClient = useApolloClient();
  const isPublic = useStore(store, (state) => state.isPublic);
  const collaborators = useStore(store, (state) => state.collaborators);
  const setShareOpen = useStore(store, (state) => state.setShareOpen);
  const updateVisibility = useStore(store, (state) => state.updateVisibility);
  const addCollaborator = useStore(store, (state) => state.addCollaborator);
  const isOwner = useStore(store, (state) => state.role === RoleType.OWNER);
  const title = useStore(store, (state) => state.repoName || "Untitled");
  const url = `${window.location.protocol}//${window.location.host}/repo/${id}`;
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function flipVisibility() {
    if (await updateVisibility(apolloClient, !isPublic)) {
      dispatch({ type: "change visibility success" });
    } else {
      dispatch({ type: "change visibility error", message: "Unknown error" });
    }
  }

  async function onShare() {
    const email = inputRef?.current?.value;
    if (!email) {
      dispatch({ type: "error", message: "Email cannot be empty" });
      return;
    }
    const { success, error } = await addCollaborator(apolloClient, email);
    if (success) {
      dispatch({ type: "inivite success", email });
    } else {
      dispatch({ type: "inivite error", message: error.message });
    }
  }

  function onCloseAlert(event: React.SyntheticEvent | Event, reason?: string) {
    if (reason === "clickaway") {
      return;
    }
    dispatch({ type: "close info" });
  }

  return (
    <>
      <Dialog open={open} onClose={() => setShareOpen(false)}>
        <DialogTitle>
          Share Project:{" "}
          <span style={{ fontFamily: "monospace" }}>{title || "Untitled"}</span>
          <IconButton
            aria-label="close"
            onClick={() => setShareOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            id="link"
            type="text"
            variant="standard"
            label="Link"
            defaultValue={url}
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: (
                <CopyToClipboard
                  text={url}
                  onCopy={() => {
                    dispatch({ type: "copy success" });
                  }}
                >
                  <Tooltip title="Copy link">
                    <IconButton>
                      <FileCopyIcon />
                    </IconButton>
                  </Tooltip>
                </CopyToClipboard>
              ),
            }}
          ></TextField>

          <DialogContentText>
            The project is currently {isPublic ? "public" : "private"}.
            <Tooltip
              title="learn more?"
              placement="top"
              sx={{ marginBottom: 1, marginLeft: -1 }}
            >
              <IconButton
                onClick={() => setShowHelp((prev) => !prev)}
                color={showHelp ? "primary" : "inherit"}
              >
                <HelpOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {isOwner && (
              <Button sx={{ float: "right" }} onClick={flipVisibility}>
                Make it {isPublic ? "private" : "public"}
              </Button>
            )}
          </DialogContentText>

          {showHelp && (
            <DialogContentText
              color="primary"
              variant="body2"
              fontSize="small"
              sx={{ maxWidth: 500 }}
            >
              {aboutVisibility}
            </DialogContentText>
          )}

          <CollaboratorList
            collaborators={collaborators}
            isOwner={isOwner}
            dispatch={dispatch}
          />

          <DialogContentText>
            Enter the email address of the person you want to share this project
            with.
          </DialogContentText>

          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Email Address"
            type="email"
            variant="standard"
            fullWidth
            inputRef={inputRef}
            disabled={!isOwner}
          />
          <DialogActions>
            <Button
              onClick={() => {
                setShareOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={onShare} disabled={!isOwner}>
              Share
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Snackbar
        open={feedback?.showInfo}
        autoHideDuration={3000}
        onClose={onCloseAlert}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={feedback?.status as AlertColor} onClose={onCloseAlert}>
          {feedback?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
