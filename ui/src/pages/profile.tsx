import { useAuth0 } from "@auth0/auth0-react";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import Paper from "@mui/material/Paper";
import { Container, Stack } from "@mui/material";

const Profile = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <div>Loading ...</div>;
  }

  if (!isAuthenticated) return <div>Not isAuthenticated</div>;
  if (!user) return <div>Cannot retrieve user information.</div>;

  return (
    isAuthenticated && (
      <div>
        <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
        <h2>{user.name}</h2>
        <p>{user.email}</p>
      </div>
    )
  );
};

export default Profile;
