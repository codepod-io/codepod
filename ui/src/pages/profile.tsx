import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import Paper from "@mui/material/Paper";
import { Button, Container, Link, Stack } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";

import useMe from "../lib/me";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";

export default function Profile() {
  const { loading, me } = useMe();
  // const [] = useParams()
  let [searchParams] = useSearchParams();
  // This is the access token from backend. I need to write this to the database
  // with a graphQL call, because I need to attach user's authToken.
  let access_token = searchParams.get("token");
  const [setGitHubAccessToken] = useMutation(
    gql`
      mutation SetGitHubAccessToken($token: String) {
        setGitHubAccessToken(token: $token)
      }
    `,
    {
      refetchQueries: ["GetGitHubAccessToken"],
    }
  );
  const [deleteGitHubAccessToken] = useMutation(
    gql`
      mutation DeleteGitHubAccessToken {
        deleteGitHubAccessToken
      }
    `,
    {
      refetchQueries: ["GetGitHubAccessToken"],
    }
  );
  const { data } = useQuery(gql`
    query GetGitHubAccessToken {
      getGitHubAccessToken
    }
  `);

  if (!me) {
    // router.push("/login");
    // return null;
    return (
      <Box>
        <Box>Profile Page</Box>
        <Box>Please Log In</Box>
      </Box>
    );
  }

  if (access_token) {
    setGitHubAccessToken({ variables: { token: access_token } });
    // remove the searchParams from the url
    // navigate("/profile");
    return <Navigate to="/profile" replace={true} />;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2 }}>
      {loading ? (
        "Loading"
      ) : (
        <Box>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Stack>
              <Typography variant="h4">User profile</Typography>
              <Box>
                Name {me.firstname} {me.lastname}
              </Box>
              <Box> Email: {me.email}</Box>
              {/* <Box>CodePod version 0.4.6</Box> */}

              <Stack
                sx={{
                  alignItems: "center",
                }}
                direction="row"
                spacing={2}
              >
                <Box>
                  Link to Github <GitHubIcon />
                </Box>
                {data?.getGitHubAccessToken ? (
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box color="green">Connected</Box>
                    {/* <Box>{data.getGitHubAccessToken}</Box> */}
                    <Button
                      variant="outlined"
                      onClick={() => {
                        // FIXME I should remove the authorization instead. Need
                        // to call github_oauth_app.xxx in the backend.
                        deleteGitHubAccessToken();
                      }}
                    >
                      Unlink
                    </Button>
                  </Stack>
                ) : (
                  <Box>
                    <Link href="/api/github/oauth/login">Login</Link>
                  </Box>
                )}
              </Stack>
            </Stack>
          </Paper>
          <Divider />
        </Box>
      )}
    </Container>
  );
}
