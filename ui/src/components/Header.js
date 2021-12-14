import { Link as ReactLink } from "react-router-dom";

import { useState } from "react";

import { useHistory } from "react-router-dom";

import Box from "@mui/material/Box";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Link from "@mui/material/Link";

import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Tooltip from "@mui/material/Tooltip";

import AppBar from "@mui/material/AppBar";

import { useAuth } from "../lib/auth";

const pages = ["Products", "Pricing", "Blog"];
const settings = ["Profile", "Account", "Dashboard", "Logout"];

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

  return (
    <AppBar
      position="fixed"
      color="inherit"
      sx={{
        color: "white",
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
            <Button sx={{ my: 2, color: "white", display: "block" }}>
              <Link to="/repos" component={ReactLink} underline="none">
                Repos
              </Link>
            </Button>
            <Button sx={{ my: 2, color: "white", display: "block" }}>
              <Link to="/test" component={ReactLink} underline="none">
                Test
              </Link>
            </Button>
            <Button sx={{ my: 2, color: "white", display: "block" }}>
              <Link to="/docs" component={ReactLink} underline="none">
                Docs
              </Link>
            </Button>
            <Button sx={{ my: 2, color: "white", display: "block" }}>
              <Link to="/about" component={ReactLink} underline="none">
                About
              </Link>
            </Button>
          </Box>

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt="Remy Sharp" src="/static/images/avatar/2.jpg" />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: "45px" }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              {settings.map((setting) => (
                <MenuItem key={setting} onClick={handleCloseNavMenu}>
                  <Typography textAlign="center">{setting}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

const MyMenuItem = ({ children, isLast, to = "/" }) => {
  return (
    <Box
      mb={{ xl: isLast ? 0 : 2, sm: 0 }}
      mr={{ xl: 0, sm: isLast ? 0 : 2 }}
      display="block"
    >
      <Link to={to} component={ReactLink} underline="none">
        {children}
      </Link>
    </Box>
  );
};

export function Header2() {
  const [show, setShow] = useState(false);
  const toggleMenu = () => setShow(!show);
  let history = useHistory();

  const { isSignedIn, signOut } = useAuth();

  return (
    <Box
      // component="nav"
      sx={{
        display: "flex",
        my: 2,
        px: 2,

        alignItems: "center",
        justifyContent: "space-between",
        textAlign: "center",
        // position: "fixed",
        // top: 0,
        background: "white",
        zIndex: 1,
        flexWrap: "wrap",
        // width: 1,
      }}
    >
      <Box
        sx={{
          fontSize: 16,
          fontWeight: "bold",
        }}
      >
        <Link component={ReactLink} underline="none" to="/">
          CodePod {!window.codepodio && "(Local)"}
        </Link>
      </Box>

      <Box display={{ sm: "block", md: "none" }} onClick={toggleMenu}>
        {show ? <CloseIcon /> : <MenuIcon />}
      </Box>

      <Box
        sx={{
          display: { xs: show ? "block" : "none", md: "block" },
          // display: ["none", "block"],
          // display: { xs: "none", md: "block" },
        }}
        // flexBasis={{ base: "100%", md: "auto" }}
        // display="none"
        // display={{ sm: "none", xl: "none" }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: ["center", "space-between", "flex-end", "flex-end"],
            flexDirection: ["column", "row", "row", "row"],
            pt: [4, 4, 0, 0],
            // width: 0.5,
          }}
        >
          <MyMenuItem to="/">Home</MyMenuItem>
          <MyMenuItem to="/repos">Repos</MyMenuItem>
          <MyMenuItem to="/test">Test</MyMenuItem>
          <MyMenuItem to="/docs">Docs</MyMenuItem>
          <MyMenuItem to="/about">About</MyMenuItem>
          {window.codepodio &&
            (isSignedIn() ? (
              <Menu>
                <Button
                // as={Button}
                // rightIcon={<ChevronDownIcon />}
                >
                  <Avatar alt="Dan Abrahmov" src="https://bit.ly/dan-abramov" />
                </Button>
                <MenuList>
                  <ReactLink to="/profile">
                    <MenuItem>Profile</MenuItem>
                  </ReactLink>
                  <ReactLink to="/profile">
                    <MenuItem>Create a Copy</MenuItem>
                  </ReactLink>
                  <MenuItem>Mark as Draft</MenuItem>
                  <MenuItem>Delete</MenuItem>
                  <MenuItem
                    onClick={() => {
                      signOut();
                      history.push("/login");
                    }}
                  >
                    Logout
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <MyMenuItem to="/login">Login</MyMenuItem>
            ))}
        </Box>
      </Box>
    </Box>
  );
}

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
