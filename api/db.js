import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// mongodb://localhost:27017/test
// const uri = process.env.MONGO_URL;
const uri = "mongodb://root:example@localhost:27017/test?authSource=admin";
console.log(`connecting to ${uri} ..`);
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("connected");
});

export const User = mongoose.model(
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
  tree: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tree",
  },
});

const treeSchema = mongoose.Schema();
treeSchema.add({
  children: [treeSchema],
});

export const Repo = mongoose.model("Repo", repoSchema);

export const Pod = mongoose.model("Pod", podSchema);

export const Tree = mongoose.model("Tree", treeSchema);
