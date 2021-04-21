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
} from "@chakra-ui/react";
import { chakra } from "@chakra-ui/system";
import Link from "next/link";

import { useState } from "react";

import { CloseIcon, HamburgerIcon, ChevronDownIcon } from "@chakra-ui/icons";

import { useAuth } from "../lib/auth";

const MyMenuItem = ({ children, isLast, to = "/" }) => {
  return (
    <Text
      mb={{ base: isLast ? 0 : 8, sm: 0 }}
      mr={{ base: 0, sm: isLast ? 0 : 8 }}
      display="block"
    >
      <Link href={to}>{children}</Link>
    </Text>
  );
};

export default function Header() {
  const [show, setShow] = useState(false);
  const toggleMenu = () => setShow(!show);

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
        <Link href="/">CodePod</Link>
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
                <MenuItem>Profile</MenuItem>
                <MenuItem>Create a Copy</MenuItem>
                <MenuItem>Mark as Draft</MenuItem>
                <MenuItem>Delete</MenuItem>
                <MenuItem onClick={() => signOut()}>Logout</MenuItem>
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
