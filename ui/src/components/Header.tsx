import { Link as ReactLink } from "react-router-dom";

import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { useAuth0 } from "@auth0/auth0-react";

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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AppBar from "@mui/material/AppBar";

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();

  return <button onClick={() => loginWithRedirect()}>Log In</button>;
};

const LogoutButton = () => {
  const { logout } = useAuth0();

  return (
    <button onClick={() => logout({ returnTo: window.location.origin })}>
      Log Out
    </button>
  );
};

export function Header() {
  const [anchorElNav, setAnchorElNav] = useState(null);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const { user, isLoading } = useAuth0();
  const { isAuthenticated } = useAuth0();

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
          <Box
            sx={{
              flexGrow: 1,
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

          {isAuthenticated && user ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Box sx={{ mr: 2 }}>
                <Link component={ReactLink} to="/profile" underline="none">
                  <Avatar
                    alt={user.given_name}
                    src={user.picture}
                    imgProps={{
                      referrerPolicy: "no-referrer",
                    }}
                  />
                </Link>
              </Box>
              <LogoutButton />
            </Box>
          ) : (
            <LoginButton />
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

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
