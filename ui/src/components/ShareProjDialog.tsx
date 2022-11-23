import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";

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
  const [alert, setAlert] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
    if (email === "") {
      setAlert(true);
      setErrorMsg("Please enter an email address");
      return;
    }
    try {
      const { data } = await addEmail({
        variables: {
          repoId: id,
          email,
        },
      });
      setAlert(false);
      setSuccess(true);
      // show the success message for 1 second before closing the dialog
      setTimeout(() => {
        onCloseHandler();
      }, 1000);
    } catch (error: any) {
      setSuccess(false); // just in case
      setAlert(true);
      setErrorMsg(error?.message || "Unknown error");
    }
  }

  function onCloseHandler() {
    setEmail("");
    setAlert(false);
    setSuccess(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onCloseHandler}>
      <DialogTitle> Share Project {title} with</DialogTitle>
      {alert && <Alert severity="error"> {errorMsg} </Alert>}
      {success && <Alert severity="success"> Invitation Sent </Alert>}
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
          <Button onClick={onCloseHandler}>Cancel</Button>
          <Button onClick={onShare}> Share</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
