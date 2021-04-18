import jwt from "jsonwebtoken";
import dotenv from "dotenv";
// import { typeDefs } from './graphql-schema'

// set environment variables from .env
dotenv.config();

jwt.sign({ id: "jfdlksf", username: "lihebi" }, process.env.JWT_SECRET, {
  expiresIn: "30d",
});
