import React, { useEffect, useState } from "react";

import Avatar from "@mui/material/Avatar";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

import { useFormik } from "formik";

import { Link as ReactLink, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";

function Copyright(props: any) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      align="center"
      {...props}
    >
      {"Copyright © "}
      <Link color="inherit" href="https://mui.com/">
        Your Website
      </Link>{" "}
      {new Date().getFullYear()}
      {"."}
    </Typography>
  );
}

const theme = createTheme();

declare var google: any;

export default function SignIn() {
  /* eslint-disable no-unused-vars */
  const { signIn, isSignedIn, handleGoogle } = useAuth();
  const [error, setError] = useState(null);

  let navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn()) {
      navigate("/");
    }
  }, [isSignedIn, navigate]);

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    // validationSchema: validationSchema,
    onSubmit: (values) => {
      setError(null);
      return signIn({
        email: values.email,
        password: values.password,
      }).catch((err) => {
        // TODO use more user friendly error message
        setError(err.message);
      });
    },
  });

  useEffect(() => {
    console.log("nodeenv", process.env.NODE_ENV);
    let client_id =
      process.env.NODE_ENV === "development"
        ? process.env.REACT_APP_GOOGLE_CLIENT_ID
        : window.GOOGLE_CLIENT_ID || null;
    console.log("google client_id", client_id);
    google.accounts.id.initialize({
      client_id,
      callback: handleGoogle,
    });
    google.accounts.id.renderButton(
      document.getElementById("googleLoginDiv"),
      { theme: "outline", size: "large" } // customization attributes
    );
  }, [handleGoogle]);

  return (
    <ThemeProvider theme={theme}>
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <Box
          sx={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Box id="googleLoginDiv"></Box>
          <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
            <LockOutlinedIcon />
          </Avatar>
          <Typography component="h1" variant="h5">
            Sign in
          </Typography>
          <Box
            component="form"
            onSubmit={formik.handleSubmit}
            noValidate
            sx={{ mt: 1 }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={formik.values.email}
              onChange={formik.handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formik.values.password}
              onChange={formik.handleChange}
            />
            <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label="Remember me"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign In
            </Button>
            <Grid container>
              <Grid item xs>
                <Link href="#" variant="body2">
                  Forgot password?
                </Link>
              </Grid>
              <Grid item>
                <Link component={ReactLink} to="/signup">
                  {"Don't have an account? Sign Up"}
                </Link>
                {/* <Link href="/signup" variant="body2">
                  {"Don't have an account? Sign Up"}
                </Link> */}
              </Grid>
            </Grid>
          </Box>
        </Box>
        <Copyright sx={{ mt: 8, mb: 4 }} />
      </Container>
    </ThemeProvider>
  );
}
