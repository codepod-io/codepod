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
import React, { useContext } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { useStore } from "zustand";
import { RepoContext, RoleType } from "../lib/store";
import { useApolloClient } from "@apollo/client";

interface ShareProjDialogProps {
  open?: boolean;
  title?: String;
  id?: string;
}

function CollaboratorList({
  collaborators,
  setStatus,
  setMessage,
  setInfoOpen,
}) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const apolloClient = useApolloClient();
  const role = useStore(store, (state) => state.role);
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

  async function handleDeleteCollaborator(userId) {
    const { success, error } = await deleteCollaborator(apolloClient, userId);
    if (success) {
      setStatus("success");
      setMessage("Remove the collaborator successfully");
    } else {
      setStatus("error");
      setMessage(error.message);
    }
    setInfoOpen(true);
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
            role === RoleType.OWNER && (
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => handleDeleteCollaborator(collab.id)}
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

const infoAboutPublicOrPrivate =
  "A private project is only visible to you and collaborators, while a public project is visible to everyone. For both of them, only the owner can invite collaborators by their email addresses, and only collaborators can edit the project. The owner can change the visibility of a project at any time.";

export function ShareProjDialog({
  open = false,
  title = "Untitled",
  id = "",
}: ShareProjDialogProps) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const [status, setStatus] = useState<AlertColor>("info");
  const [message, setMessage] = useState("inviting...");
  const [infoOpen, setInfoOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const apolloClient = useApolloClient();
  const isPublic = useStore(store, (state) => state.isPublic);
  const collaborators = useStore(store, (state) => state.collaborators);
  const setShareOpen = useStore(store, (state) => state.setShareOpen);
  const updateVisibility = useStore(store, (state) => state.updateVisibility);
  const addCollaborator = useStore(store, (state) => state.addCollaborator);
  const role = useStore(store, (state) => state.role);
  const url = `${window.location.protocol}//${window.location.host}/repo/${id}`;
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function flipVisibility() {
    if (await updateVisibility(apolloClient, !isPublic)) {
      setStatus("success");
      setMessage("Visibility changed successfully");
    } else {
      setStatus("error");
      setMessage("Visibility change failed");
    }
    setInfoOpen(true);
  }

  async function onShare() {
    const email = inputRef?.current?.value;
    setInfoOpen(true);
    if (!email) {
      setStatus("error");
      setMessage("Please enter an email address");
      return;
    }
    const { success, error } = await addCollaborator(apolloClient, email);
    if (success) {
      setStatus("success");
      setMessage("Invited successfully");
    } else {
      setStatus("error");
      setMessage(error?.message || "Unknown error");
    }
  }

  function onCloseAlert(event: React.SyntheticEvent | Event, reason?: string) {
    if (reason === "clickaway") {
      return;
    }
    setInfoOpen(false);
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
                    setStatus("success");
                    setMessage("Link Copied");
                    setInfoOpen(true);
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
            <IconButton
              onClick={() => setShowHelp((prev) => !prev)}
              color={showHelp ? "primary" : "inherit"}
              sx={{ marginBottom: 1, marginLeft: 0 }}
            >
              <HelpOutlineOutlinedIcon fontSize="small" />
            </IconButton>
            {role === RoleType.OWNER && (
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
              {infoAboutPublicOrPrivate}
            </DialogContentText>
          )}

          <CollaboratorList
            collaborators={collaborators}
            setStatus={setStatus}
            setMessage={setMessage}
            setInfoOpen={setInfoOpen}
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
          />
          <DialogActions>
            <Button
              onClick={() => {
                setShareOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={onShare}> Share</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Snackbar
        open={infoOpen}
        autoHideDuration={3000}
        onClose={onCloseAlert}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={status} onClose={onCloseAlert}>
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
