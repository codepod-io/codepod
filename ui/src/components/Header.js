import {
  Flex,
  Text,
  Box,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
// TODO react link might work natively with chakra
import { Link as ReactLink } from "react-router-dom";

import { useState } from "react";

import { CloseIcon, HamburgerIcon } from "@chakra-ui/icons";

import { useAuth } from "../lib/auth";
import { useHistory } from "react-router-dom";

const MyMenuItem = ({ children, isLast, to = "/" }) => {
  return (
    <Text
      mb={{ base: isLast ? 0 : 8, sm: 0 }}
      mr={{ base: 0, sm: isLast ? 0 : 8 }}
      display="block"
    >
      <ReactLink to={to}>{children}</ReactLink>
    </Text>
  );
};

export function Header() {
  const [show, setShow] = useState(false);
  const toggleMenu = () => setShow(!show);
  let history = useHistory();

  const { isSignedIn, signOut } = useAuth();

  return (
    <Flex
      mb={8}
      p={8}
      as="nav"
      align="center"
      justify="space-between"
      wrap="wrap"
      w="100%"
    >
      <Text fontSize="lg" fontWeight="bold">
        <ReactLink to="/">CodePod</ReactLink>
      </Text>

      <Box display={{ base: "block", md: "none" }} onClick={toggleMenu}>
        {show ? <CloseIcon /> : <HamburgerIcon />}
      </Box>

      <Box
        display={{ base: show ? "block" : "none", md: "block" }}
        flexBasis={{ base: "100%", md: "auto" }}
      >
        <Flex
          align="center"
          justify={["center", "space-between", "flex-end", "flex-end"]}
          direction={["column", "row", "row", "row"]}
          pt={[4, 4, 0, 0]}
        >
          <MyMenuItem to="/">Home</MyMenuItem>
          <MyMenuItem to="/repos">Repos</MyMenuItem>
          <MyMenuItem to="/commitnote">CommitNote</MyMenuItem>
          <MyMenuItem to="/test">Test</MyMenuItem>
          <MyMenuItem to="/about">About</MyMenuItem>
          {isSignedIn() ? (
            <Menu>
              <MenuButton
              // as={Button}
              // rightIcon={<ChevronDownIcon />}
              >
                <Avatar name="Dan Abrahmov" src="https://bit.ly/dan-abramov" />
              </MenuButton>
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
          )}
        </Flex>
      </Box>
    </Flex>
  );
}

export function Footer() {
  return (
    <Flex
      mb={8}
      p={8}
      as="nav"
      align="center"
      justify="space-between"
      wrap="wrap"
      w="100%"
    >
      <Text fontSize="lg" fontWeight="bold">
        <ReactLink to="/">CodePod</ReactLink>
      </Text>

      <Text fontSize="lg" fontWeight="bold">
        <ReactLink to="/">Copyright © CodePod Inc</ReactLink>
      </Text>
    </Flex>
  );
}
