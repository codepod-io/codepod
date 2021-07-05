import { useQuery, useMutation, gql } from "@apollo/client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Formik } from "formik";
import { chakra } from "@chakra-ui/system";
import { MySlate } from "../components/MySlate";

import {
  Box,
  Textarea,
  Checkbox,
  Switch,
  //   Editable,
  //   EditableInput,
  //   EditablePreview,
  Center,
  Grid,
  Flex,
  Button,
  Heading,
  SimpleGrid,
  Text,
  useColorModeValue,
  VisuallyHidden,
  useToken,
  Stack,
  FormControl,
  FormLabel,
  Input,
  Divider,
  useDisclosure,
  useMergeRefs,
  useColorModeValue as mode,
  InputGroup,
  InputRightElement,
  IconButton,
  Alert,
  AlertIcon,
  Link as ChakraLink,
} from "@chakra-ui/react";

function AddIdeaQForm(props) {
  const [error, setError] = useState(null);
  const [createRepo, { data }] = useMutation(gql`
    mutation AddIdeaQ($content: String!) {
      addIdeaQ(content: $content) {
        id
        content
      }
    }
  `);
  return (
    <Formik
      initialValues={{ content: "" }}
      validate={(values) => {
        const errors = {};
        if (!values.content) {
          errors.content = "Required";
        }
        return errors;
      }}
      onSubmit={(values, { setSubmitting, resetForm }) => {
        setError(null);
        createRepo({
          variables: {
            name: values.content,
          },
        });
        setSubmitting(false);
        resetForm();
      }}
    >
      {({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
      }) => (
        <div>
          <chakra.form onSubmit={handleSubmit} {...props}>
            <Stack spacing="6">
              <FormControl id="content">
                <FormLabel>Add new idea:</FormLabel>
                <Input
                  name="content"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  // HEBI: ??? This is super weired. Otherwise the form input is not cleared.
                  // https://github.com/formium/formik/issues/446#issuecomment-451121289
                  value={values.content || ""}
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                fontSize="md"
                disabled={isSubmitting}
              >
                add
              </Button>
              {error && (
                <Alert status="error">
                  <AlertIcon />
                  {error}
                </Alert>
              )}
            </Stack>
          </chakra.form>
        </div>
      )}
    </Formik>
  );
}

function MyTextarea({ content = "", archived = false }) {
  const [value, setValue] = useState(content);
  return (
    <Box>
      <Checkbox defaultIsChecked={archived} />

      <Textarea
        // maxW="sm"
        // maxH="sm"
        value={value}
        // colorScheme={archived ? "gray" : "whiteAlpha"}
        // colorScheme="blue"
        // isInvalid
        color={archived ? "gray.500" : "black"}
        onChange={(e) => setValue(e.target.value)}
      />
    </Box>
  );
}

function CurrentIdeaQ() {
  let [showArchived, setShowArchived] = useState(true);
  let queue = [
    { content: "aaa", archived: true },
    { content: "bbb", archived: false },
    { content: "ccc", archived: true },
    { content: "ddd" },
  ];
  return (
    <Box>
      <FormControl display="flex" alignItems="center">
        <FormLabel htmlFor="show-archived" mb="0">
          Show archived?
        </FormLabel>
        <Switch
          id="show-archived"
          defaultChecked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
      </FormControl>

      {/* <Grid templateColumns="repeat(3, 1fr)" gap={6}>
        {queue
          .filter((item) => showArchived || !item.archived)
          .map((item) => (
            <MyTextarea
              content={item.content}
              archived={item.archived}
              key={item.content}
            />
          ))}
      </Grid> */}

      <Grid templateColumns="repeat(5, 1fr)" gap={6}>
        {queue
          .filter((item) => showArchived || !item.archived)
          .map((item) => (
            <MyNotePod
              content={item.content}
              archived={item.archived}
              key={item.content}
            />
          ))}
      </Grid>
    </Box>
  );
}

function MyNotePod({ content, archived = false }) {
  return (
    <Box display="flex">
      <Checkbox defaultIsChecked={archived} mr={2} />
      <MySlate
        content={[
          {
            type: "paragraph",
            children: [{ text: content, strikethrough: archived }],
          },
        ]}
      />
    </Box>
  );
}

export default function CommitNote() {
  return (
    <Box maxW="lg" align="center" m="auto">
      {/* <Text>CommitNote</Text> */}
      {/* <hr /> */}
      <Heading>IdeaQ</Heading>
      <Box border="1px">
        <MySlate />
      </Box>
      <CurrentIdeaQ />
      <AddIdeaQForm />
    </Box>
  );
}
