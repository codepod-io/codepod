import { useColorModeValue, Link } from "@chakra-ui/react";
import { Link as ReactLink } from "react-router-dom";

///////// Link
export function StyledLink({ to, children }) {
  return (
    <Link
      to={to}
      as={ReactLink}
      marginStart="1"
      color={useColorModeValue("blue.500", "blue.200")}
      _hover={{
        color: useColorModeValue("blue.600", "blue.300"),
      }}
      display={{
        base: "block",
        sm: "inline",
      }}
    >
      {children}
    </Link>
  );
}
