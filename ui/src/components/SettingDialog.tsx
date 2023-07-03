import React, { useEffect, useContext, useState, useRef } from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import { useStore } from "zustand";
import { RepoContext } from "../lib/store";
import { Link, Stack } from "@mui/material";
import LaunchIcon from "@mui/icons-material/Launch";
import { useApolloClient } from "@apollo/client";
import Button from "@mui/material/Button";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import Alert, { AlertColor } from "@mui/material/Alert";
import { openTokenPage, registerUser } from "../lib/monacoCompletionProvider";

interface SettingDiagProps {
  open: boolean;
}

export function SettingDialog({ open = false }: SettingDiagProps) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const setSettingOpen = useStore(store, (state) => state.setSettingOpen);
  const apiKey = useStore(store, (state) => state.user.codeiumAPIKey);
  const user = useStore(store, (state) => state.user);
  const isCustomToken = useStore(store, (state) => state.isCustomToken);
  const setIsCustomToken = useStore(store, (state) => state.setIsCustomToken);
  const updateAPIKey = useStore(store, (state) => state.updateAPIKey);
  const client = useApolloClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [infoShow, setInfoShow] = useState(false);
  const [status, setStatus] = useState<"success" | "error" | "warning">(
    "success"
  );
  const [message, setMessage] = useState("");

  const onAlertClose = (
    event: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    setInfoShow(false);
  };

  const updateToken = async () => {
    const token = inputRef.current?.value.trim();
    if (!token) {
      setStatus("error");
      setMessage("Token cannot be empty");
      setInfoShow(true);
      return;
    }
    try {
      const { api_key, name } = await registerUser(token);
      if (api_key === "" || api_key === undefined) {
        throw new Error("Invalid token");
      }
      if (await updateAPIKey(client, api_key)) {
        setStatus("success");
        setMessage(`${name}, welcome. Token updated`);
        setInfoShow(true);
      } else {
        throw new Error("Update failed");
      }
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message || "Unknown error");
      console.log(
        (e as Error).message === undefined,
        (e as Error).message === ""
      );
      setInfoShow(true);
      return;
    }
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Auto Completion</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The AI code auto completion is powered by{" "}
          <Link href="https://codeium.com/" target="_blank" rel="noreferrer">
            Codeium <LaunchIcon fontSize="small" />
          </Link>{" "}
          You can also use your own token instead of our default API keys, which
          records your own activities of using Codeium.
        </DialogContentText>

        <Stack
          direction="row"
          flexWrap="wrap"
          spacing={{ xs: 1, sm: 2 }}
          sx={{ justifyContent: "space-between" }}
        >
          {apiKey ? (
            <Chip
              label="Token Verified"
              color="success"
              size="small"
              variant="outlined"
              icon={<DoneIcon />}
            />
          ) : (
            <Chip
              label="No Stored Token"
              color="error"
              size="small"
              variant="outlined"
              icon={<CloseIcon />}
            />
          )}
          <Button endIcon={<LaunchIcon />} onClick={() => openTokenPage()}>
            Get Token
          </Button>
        </Stack>

        <FormGroup>
          <FormControlLabel
            sx={{ marginRight: 0 }}
            control={
              <Switch
                checked={isCustomToken}
                onChange={(e) => setIsCustomToken(e.target.checked)}
              />
            }
            label="Use my own token"
          />

          {isCustomToken && (
            <TextField
              fullWidth
              label="Token"
              variant="standard"
              inputRef={inputRef}
              placeholder="Paste your token here"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button onClick={() => updateToken()}>Update</Button>
                  </InputAdornment>
                ),
              }}
            />
          )}
        </FormGroup>
        <Snackbar
          open={infoShow}
          autoHideDuration={3000}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          onClose={onAlertClose}
        >
          <Alert severity={status as AlertColor} onClose={onAlertClose}>
            {message}
          </Alert>
        </Snackbar>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSettingOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
