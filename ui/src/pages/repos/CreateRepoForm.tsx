import React, { useState } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import { useNavigate } from "react-router-dom";
import { Formik } from "formik";
import { useMutation, gql } from "@apollo/client";
import { nolookalikes } from "nanoid-dictionary";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet(nolookalikes, 10);

interface form {
  button?: any;
}

export default function CreateRepoForm(props: form = {}) {
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState("");
  const [createRepo] = useMutation(
    gql`
      mutation CreateRepo($name: String!, $id: ID!, $isPublic: Boolean) {
        createRepo(name: $name, id: $id, isPublic: $isPublic) {
          name
        }
      }
    `,
    {
      refetchQueries: [
        // using this did not work
        // FETCH_REPOS,
        "GetRepos",
      ],
    }
  );
  const history = useNavigate();
  const [open, setOpen] = useState(false);
  const handleClickOpen = () => {
    setError("");
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  return (
    <div>
      <Button
        variant="contained"
        sx={props.button ? props.button : {}}
        onClick={handleClickOpen}
      >
        Create new repo
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth={true} maxWidth="sm">
        <DialogTitle
          sx={{
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          New Repo
        </DialogTitle>
        <DialogContent>
          <Formik
            initialValues={{ reponame: "" }}
            validate={(values) => {
              if (!values.reponame) {
                return { reponame: "Required" };
              }
              return {};
            }}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
              console.log("...");
              // clear the field
              // values.reponame = "";
              console.log(values);
              setError("");
              console.log("creating the repo ..");
              const id = "repo_" + nanoid();
              try {
                const res = await createRepo({
                  variables: {
                    name: values.reponame,
                    id,
                    isPublic: !isPrivate,
                  },
                });
                if (res.data) {
                  history(`/repo/${id}`);
                }
                handleClose();
              } catch (error) {
                setError("Server Error");
              }

              setSubmitting(false);
              resetForm();

              console.log("should be not submitting?");
              // return;
            }}
          >
            {({
              values,
              handleChange,
              handleBlur,
              handleSubmit,
              isSubmitting,
            }) => (
              <div>
                <Box
                  component="form"
                  onSubmit={handleSubmit}
                  noValidate
                  sx={{ mt: 1 }}
                >
                  {/* <Stack spacing="6"> */}
                  <FormControl id="reponame" sx={{ width: "100%" }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <FormLabel
                        sx={{
                          paddingRight: "5px",
                        }}
                      >
                        Repo Name
                      </FormLabel>
                      <TextField
                        sx={{
                          flex: 1,
                        }}
                        name="reponame"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                        // HEBI: ??? This is super weired. Otherwise the form input is not cleared.
                        // https://github.com/formium/formik/issues/446#issuecomment-451121289
                        value={values.reponame || ""}
                      />
                    </Box>
                  </FormControl>

                  <FormControlLabel
                    sx={{ alignItems: "center", marginLeft: "80px" }}
                    control={
                      <Switch
                        defaultChecked
                        onChange={(e) => {
                          setIsPrivate(e.target.checked);
                        }}
                      />
                    }
                    // checked={isPrivate}
                    label={isPrivate ? "Private" : "Public"}
                  />
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "row-reverse",
                    }}
                  >
                    <Button type="submit" disabled={isSubmitting}>
                      Create
                    </Button>
                    <Button onClick={handleClose}>Cancel</Button>
                  </Box>

                  {error && <Alert severity="error">{error}</Alert>}
                  {/* </Stack> */}
                </Box>
              </div>
            )}
          </Formik>
        </DialogContent>
      </Dialog>
    </div>
  );
}
