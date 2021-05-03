import {
  Flex,
  Spacer,
  Text,
  Box,
  Heading,
  Button,
  useToken,
  useColorModeValue,
  Avatar,
  AvatarBadge,
  AvatarGroup,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuItemOption,
  MenuGroup,
  MenuOptionGroup,
  MenuIcon,
  MenuCommand,
  MenuDivider,
  Link,
} from "@chakra-ui/react";
import { chakra } from "@chakra-ui/system";
import NextLink from "next/link";

import { useState } from "react";

import { CloseIcon, HamburgerIcon, ChevronDownIcon } from "@chakra-ui/icons";

import { useAuth } from "../lib/auth";
import { useRouter } from "next/router";

const MyMenuItem = ({ children, isLast, to = "/" }) => {
  return (
    <Text
      mb={{ base: isLast ? 0 : 8, sm: 0 }}
      mr={{ base: 0, sm: isLast ? 0 : 8 }}
      display="block"
    >
      <NextLink href={to}>{children}</NextLink>
    </Text>
  );
};

export function Header() {
  const [show, setShow] = useState(false);
  const toggleMenu = () => setShow(!show);
  const router = useRouter();

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
        <NextLink href="/">CodePod</NextLink>
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
                <NextLink href="/profile">
                  <MenuItem>Profile</MenuItem>
                </NextLink>
                <NextLink href="/profile">
                  <MenuItem>Create a Copy</MenuItem>
                </NextLink>
                <MenuItem>Mark as Draft</MenuItem>
                <MenuItem>Delete</MenuItem>
                <MenuItem
                  onClick={() => {
                    signOut();
                    router.push("/login");
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
        <NextLink href="/">CodePod</NextLink>
      </Text>

      <Text fontSize="lg" fontWeight="bold">
        <NextLink href="/">Copyright © CodePod Inc</NextLink>
      </Text>
    </Flex>
  );
}
