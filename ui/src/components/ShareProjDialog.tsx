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
import { useState, useEffect } from "react";
import { useMutation, gql } from "@apollo/client";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import React from "react";

// const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
//   props,
//   ref,
// ) {
//   return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
// });

interface ShareProjDialogProps {
  open: boolean;
  title: String;
  onClose: () => void;
  id: string;
}

export function ShareProjDialog({
  open,
  title,
  onClose,
  id,
}: ShareProjDialogProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AlertColor>("info");
  const [message, setMessage] = useState("inviting...");
  const [infoOpen, setInfoOpen] = useState(false);

  const query = gql`
    mutation addCollaborator($repoId: String, $email: String) {
      addCollaborator(repoId: $repoId, email: $email)
    }
  `;
  const [addEmail] = useMutation(query);

  const onChange = (e) => {
    setEmail(e.target.value);
  };

  async function onShare() {
    setInfoOpen(true);
    if (email === "") {
      setStatus("error");
      setMessage("Please enter an email address");
      return;
    }
    try {
      const { data } = await addEmail({
        variables: {
          repoId: id,
          email,
        },
      });
      setStatus("success");
      setMessage(`Invitation sent to ${email} successfully`);
      // show the success message for 1 second before closing the dialog
      console.log(status, message);
      onCloseHandler();
    } catch (error: any) {
      setStatus("error"); // just in case
      setMessage(error?.message || "Unknown error");
    }
  }

  function onCloseHandler() {
    setEmail("");
    onClose();
  }

  function onCloseAlert(event: React.SyntheticEvent | Event, reason?: string) {
    if (reason === "clickaway") {
      return;
    }
    setInfoOpen(false);
  }

  return (
    <>
      <Dialog open={open} onClose={onCloseHandler}>
        <DialogTitle> Share Project {title} with</DialogTitle>

        <DialogContent>
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
            onChange={onChange}
          />
          <DialogActions>
            <Button
              onClick={() => {
                setInfoOpen(false);
                onCloseHandler();
              }}
            >
              Cancel
            </Button>
            <Button onClick={onShare}> Share</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <Snackbar open={infoOpen} autoHideDuration={3000} onClose={onCloseAlert}>
        <Alert severity={status} onClose={onCloseAlert}>
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
