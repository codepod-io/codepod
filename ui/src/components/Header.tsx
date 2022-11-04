import { Link as ReactLink } from "react-router-dom";

import { useState } from "react";

import { useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import MenuIcon from "@mui/icons-material/Menu";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Avatar from "@mui/material/Avatar";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";

import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Tooltip from "@mui/material/Tooltip";

import AppBar from "@mui/material/AppBar";

import { useAuth } from "../lib/auth";

import useMe from "../lib/me";

export function Header() {
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);

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

  const { isSignedIn, signOut } = useAuth();
  let navigate = useNavigate();
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
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ mr: 2, display: { xs: "none", md: "flex" } }}
          >
            <Link component={ReactLink} underline="none" to="/">
              CodePod
            </Link>
          </Typography>

          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="primary"
            >
              <MenuIcon />
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
              sx={{
                display: { xs: "block", md: "none" },
              }}
            >
              {/* The toggle menu */}
              <MenuItem onClick={handleCloseNavMenu}>
                <Link to="/repos" component={ReactLink} underline="none">
                  Repos
                </Link>
              </MenuItem>
              <MenuItem onClick={handleCloseNavMenu}>
                <Link to="/test" component={ReactLink} underline="none">
                  Test
                </Link>
              </MenuItem>
              <MenuItem onClick={handleCloseNavMenu}>
                <Link to="/docs" component={ReactLink} underline="none">
                  Docs
                </Link>
              </MenuItem>
              <MenuItem onClick={handleCloseNavMenu}>
                <Link to="/about" component={ReactLink} underline="none">
                  About
                </Link>
              </MenuItem>
            </Menu>
          </Box>
          <Typography
            variant="h6"
            noWrap
            component="div"
            color="primary"
            sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}
          >
            <Link component={ReactLink} underline="none" to="/">
              CodePod
            </Link>
          </Typography>

          {/* The navigation on desktop */}
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}>
            <Link
              to="/repos"
              component={ReactLink}
              underline="none"
              sx={{ mx: 2 }}
            >
              Repos
            </Link>
            <Link
              to="/test"
              component={ReactLink}
              underline="none"
              sx={{ mx: 2 }}
            >
              Test
            </Link>
            <Link
              to="/docs"
              component={ReactLink}
              underline="none"
              sx={{ mx: 2 }}
            >
              Docs
            </Link>
            <Link
              to="/about"
              component={ReactLink}
              underline="none"
              sx={{ mx: 2 }}
            >
              About
            </Link>
          </Box>

          {isSignedIn() ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Box>{me?.firstname}</Box>
              <Button
                onClick={() => {
                  signOut();
                  navigate("/login");
                }}
              >
                Logout
              </Button>
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
        p: 8,
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
