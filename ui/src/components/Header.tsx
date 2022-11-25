import { Link as ReactLink } from "react-router-dom";

import { useState } from "react";

import { useNavigate, useLocation } from "react-router-dom";

import Box from "@mui/material/Box";
import MenuIcon from "@mui/icons-material/Menu";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Avatar from "@mui/material/Avatar";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import AppBar from "@mui/material/AppBar";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useAuth } from "../lib/auth";
import useMe from "../lib/me";

function formatPath(path) {
  const { pathname, search } = path;
  if (pathname.includes("repo")) {
    return search.split("=").pop();
  }
  return pathname.split("/").pop();
}
export function Header() {
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const path = useLocation();
  const currentCrumbs = formatPath(path);
  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  const logout = () => {
    signOut();
    handleCloseNavMenu();
  };
  const { isSignedIn, signOut } = useAuth();
  const { me } = useMe();

  return (
    <AppBar position="fixed" color="inherit">
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          variant="dense"
          style={{
            maxHeight: "10px",
          }}
        >
          <Breadcrumbs sx={{ marginLeft: "10px" }}>
            <Link component={ReactLink} underline="hover" to="/">
              CodePod
            </Link>
            <Typography color="text.primary">
              {currentCrumbs || "Dashboard"}
            </Typography>
          </Breadcrumbs>
          <Box
            sx={{
              flexGrow: 1,
              display: "flex",
              alignItems: "center",
            }}
          ></Box>
          {isSignedIn() ? (
            <Box>
              <IconButton onClick={handleOpenNavMenu}>
                <AccountCircleIcon></AccountCircleIcon>
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorElNav}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "left",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                open={Boolean(anchorElNav)}
                onClose={handleCloseNavMenu}
              >
                <MenuItem onClick={handleCloseNavMenu}>
                  <Link to="/profile" component={ReactLink} underline="none">
                    {me?.firstname}
                  </Link>
                </MenuItem>
                <MenuItem onClick={logout}>
                  <Link to="/login" component={ReactLink} underline="none">
                    Logout
                  </Link>
                </MenuItem>
                <MenuItem onClick={handleCloseNavMenu}>
                  <Link to="/docs" component={ReactLink} underline="none">
                    Docs
                  </Link>
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <MyMenuItem to="/login">Login</MyMenuItem>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

const MyMenuItem = ({ children, to = "/" }) => {
  return (
    <Box display="block">
      <Link to={to} component={ReactLink} underline="none">
        {children}
      </Link>
    </Box>
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
