import { User, Repo, Pod } from "./db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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

export const resolvers = {
  Query: {
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
    repo: (_, { name }) => {
      return Repo.findOne({ name: name }).populate("pods");
    },
    pods: (_, reponame) => {
      // 1. find the repo
      // 2. return all the pods
      throw Error(`Not Implemented`);
    },

    login: async (_, { email, password }) => {
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
  },
  Mutation: {
    createUser: async (_, { username, email, password, firstname }) => {
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
    clearUser: () => {
      User.deleteMany({}, (err) => {
        console.log(err);
      });
      return true;
    },
    createRepo: (_, { name }) => {
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
    createPod: (_, { reponame, name, content, parent, index }) => {
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
              // 1. create pod
              // 2. update connections:
              //    - up:
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
  },
};
