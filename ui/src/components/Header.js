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

import { useAuth } from "../lib/auth";

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

export function Header() {
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
