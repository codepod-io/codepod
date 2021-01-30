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

dotenv.config();

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
    username: String,
    email: String,
    firstname: String,
    password: String,
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
  }
  type User {
    id: ID!
    username: String!
    email: String
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
    createUser(username: String, email: String, password: String, firstname: String): User
    createRepo(name: String): Repo,
    createPod(reponame: String, name: String, content: String): Pod
  }
`);

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
  createUser: ({ username, email, password, firstname }) => {
    // console.log(User.find({ username: username }));
    return User.findOne({ username: username })
      .then((user) => {
        if (user) {
          console.log(user);
          throw Error(`User ${username} already exists.`);
        } else {
          return bcrypt.genSalt(10, (salt) => {
            return bcrypt.hash(password, 18, (err, hashedPassword) => {
              return User({ username, email, hashedPassword, firstname })
                .save()
                .then(() => console.log("saved"))
                .catch((err) => {
                  throw err;
                });
            });
          });
        }
      })
      .catch((err) => {
        throw err;
      });
  },
  createRepo: ({ name }) => {
    return Repo.findOne({ name: name }).then((repo) => {
      if (repo) {
        throw `Repo ${name} already exists.`;
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

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  })
);

app.use(cors());
// app.use(express.json());

app.listen(5000, () => {
  console.log(`Pit server running on ${5000} ..`);
  // console.log(`GraphQL server: http://localhost:5000${server.graphqlPath}`);
  console.log(`GraphQL server: http://localhost:5000/graphql`);
});
