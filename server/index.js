// import { ApolloServer, gql } from "apollo-server-express"

import express from "express";
import cors from "cors";
// import mongoose from 'mongoose';

// import { User } from "./models/user.js"

// import { expressGraphQL  } from "express-graphql";
// const {expressGraphQL} = require('express-graphql')
import { graphqlHTTP } from "express-graphql";
import { buildSchema } from "graphql";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const hashed = await bcrypt.hash("hebi123", 10);
const match = await bcrypt.compare("hebi123", hashed);
console.log(hashed);
console.log(match);

bcrypt.hash("hebi123", 10).then((hashed) => {
  bcrypt.compare("hebi123", hashed, (err, result) => {
    console.log(err);
    console.log(result);
  });
});

const app = express();

const uri = process.env.MONGO_URL;
console.log(uri);
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("connected");
});

const User = mongoose.model(
  "User",
  mongoose.Schema({
    username: {
      type: String,
      required: true,
    },
    email: String,
    firstname: String,
    password: {
      type: String,
      required: true,
    },
  })
);

const podSchema = mongoose.Schema({
  name: String,
  content: String,
});

const repoSchema = mongoose.Schema({
  name: String,
  pods: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pod",
    },
  ],
});

const Repo = mongoose.model("Repo", repoSchema);

const Pod = mongoose.model("Pod", podSchema);

var schema = buildSchema(`
  type Query {
    hello: String
    users: [User]
    repos: [Repo]
    repo(name: String): Repo
    pods(repo: String): [Pod]
    login(email: String, password: String): AuthData
  }

  type AuthData {
    userID: String,
    token: String
  }

  type User {
    id: ID!
    username: String!
    email: String!
    password: String!
    firstname: String
  }

  type Repo {
    id: ID!
    name: String!
    pods: [Pod]
  }

  type Pod {
    id: ID!
    name: String!
    content: String!
  }

  type Mutation {
    createUser(username: String, email: String, password: String, firstname: String): AuthData
    createRepo(name: String): Repo,
    createPod(reponame: String, name: String, content: String): Pod
    clearUser: Boolean,
    clearRepo: Boolean,
    clearPod: Boolean
  }
`);

function genToken(userID) {
  const token = jwt.sign(
    {
      // 1h: 60 * 60
      // 1day: *24
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      data: userID,
    },
    "mysuperlongsecretkey"
  );
  return token;
}

// The root provides a resolver function for each API endpoint
var root = {
  hello: () => {
    return "Hello world!";
  },
  users: () => {
    console.log("Finding users ..");
    return User.find((err, users) => {
      if (err) return console.log(err);
    });
  },
  repos: () => {
    console.log("Finding repos ..");
    return Repo.find().populate("pods");
    // .then((repos) => repos);
  },
  // CAUTION this is args
  repo: ({ name }) => {
    return Repo.findOne({ name: name });
  },
  pods: (reponame) => {
    // 1. find the repo
    // 2. return all the pods
    throw Error(`Not Implemented`);
  },
  clearUser: () => {
    User.deleteMany({}, (err) => {
      console.log(err);
    });
    return true;
  },
  login: async ({ email, password }) => {
    const user = await User.findOne({ email: email });
    if (!user) {
      throw Error(`Email and password do not match.`);
    } else {
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        throw Error(`Email and password do not match.`);
      } else {
        return { userID: user._id, token: genToken(user._id) };
      }
    }
  },
  createUser: async ({ username, email, password, firstname }) => {
    // console.log(User.find({ username: username }));
    // FIXME this should wait and return the user
    await Promise.all([
      User.findOne({ username: username }).then((user) => {
        if (user) {
          throw new Error(`Username already registered.`);
        }
      }),
      User.findOne({ email: email }).then((user) => {
        if (user) {
          throw new Error(`Email address already registered.`);
        }
      }),
    ]);
    console.log("Creating user ..");
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const user = new User({
      username,
      email,
      password: hashed,
      firstname,
    });
    await user.save();
    // login with token
    return { userID: user._id, token: genToken(user._id) };
  },
  createRepo: ({ name }) => {
    return Repo.findOne({ name: name }).then((repo) => {
      if (repo) {
        return Error(`Repo ${name} already exists.`);
      } else {
        const tmp = new Repo({ name: name, pods: [] });
        tmp.save().then(() => console.log("saved"));
        return tmp;
      }
    });
  },
  createPod: ({ reponame, name, content }) => {
    // TODO check if the repo name exist
    // 1. TODO the repo+pod should be the identifier
    // 2. check the identifier exist or not
    // 3. create and save the pod
    // 4. add the ID to the Repo
    return Pod.findOne({ name: name }).then((pod) => {
      if (pod) {
        throw new Error(`Pod ${name} already exists.`);
      } else {
        return Repo.findOne({ name: reponame }).then((repo) => {
          if (!repo) {
            throw new Error(`Repo ${reponame} not found.`);
          } else {
            const tmp = new Pod({ name: name, content: content });
            repo.pods.push(tmp);
            repo.save();
            tmp.save();
            return tmp;
          }
        });
      }
    });
  },
};

app.use(cors());

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  })
);

// app.use(express.json());

app.listen(5000, () => {
  console.log(`Pit server running on ${5000} ..`);
  // console.log(`GraphQL server: http://localhost:5000${server.graphqlPath}`);
  console.log(`GraphQL server: http://localhost:5000/graphql`);
});
