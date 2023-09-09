import { Link as ReactLink, useLocation } from "react-router-dom";

import { useState } from "react";

import { useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import MenuIcon from "@mui/icons-material/Menu";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Avatar from "@mui/material/Avatar";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";

import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Tooltip from "@mui/material/Tooltip";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AppBar from "@mui/material/AppBar";

export const Header = ({ children }: { children?: any }) => {
  return (
    <AppBar
      position="fixed"
      color="inherit"
      sx={{
        // The default zIndex is 1100, but the default zIndex of the drawer is
        // 1200. Thus we make this 1300 to make sure it is on top of the drawer.
        zIndex: 1300,
      }}
    >
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          variant="dense"
          style={{
            maxHeight: "10px",
          }}
        >
          {children}

          {/* The navigation on desktop */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
            }}
          >
            <Link
              href="https://codepod.io"
              target="_blank"
              underline="none"
              sx={{
                mx: 2,
                display: "flex",
              }}
              alignItems="center"
              // alignContent="center"
              // textAlign={"center"}
            >
              {/* <span>Docs</span> */}
              Docs <OpenInNewIcon fontSize="small" sx={{ ml: "1px" }} />
            </Link>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export function Footer() {
  return (
    <Box
      component="nav"
      sx={{
        display: "flex",
        mb: 8,
        px: 8,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        // width: "100%",
      }}
    >
      <Box fontSize="lg" fontWeight="bold">
        <Link component={ReactLink} to="/" underline="none">
          CodePod
        </Link>
      </Box>

      <Box fontSize="lg" fontWeight="bold">
        <Link component={ReactLink} to="/" underline="none">
          Copyright © CodePod Inc
        </Link>
      </Box>
    </Box>
  );
}
