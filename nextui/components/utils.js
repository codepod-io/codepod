import { useColorModeValue, Link as ChakraLink } from "@chakra-ui/react";
import Link from "next/link";

///////// Link
export function StyledLink({ href, children }) {
  return (
    <Link href={href}>
      <ChakraLink
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
      </ChakraLink>
    </Link>
  );
}
