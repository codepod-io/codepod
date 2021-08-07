import { hashPod, computeNamespace } from "../utils";
import { slackGetPlainText } from "../../components/MySlate";

export function addPod(state, action) {
  let { parent, index, id } = action.payload;
  if (!parent) {
    parent = "ROOT";
  }
  // update all other siblings' index
  // FIXME this might cause other pods to be re-rendered
  state.pods[parent].children.forEach((id) => {
    if (state.pods[id].index >= index) {
      state.pods[id].index += 1;
    }
  });
  const pod = {
    content: "",
    column: 1,
    result: "",
    stdout: "",
    error: null,
    lang: "python",
    raw: false,
    exports: {},
    imports: {},
    midports: {},
    isSyncing: false,
    lastPosUpdate: Date.now(),
    children: [],
    io: {},
    ...action.payload,
  };
  // compute the remotehash
  pod.remoteHash = hashPod(pod);
  state.pods[id] = pod;
  // push this node
  // TODO the children no longer need to be ordered
  // TODO the frontend should handle differently for the children
  // state.pods[parent].children.splice(index, 0, id);
  state.pods[parent].children.push(id);
  // DEBUG sort-in-place
  // TODO I can probably insert
  // CAUTION the sort expects -1,0,1, not true/false
  state.pods[parent].children.sort(
    (a, b) => state.pods[a].index - state.pods[b].index
  );
  pod.ns = computeNamespace(state.pods, id);
}

export function deletePod(state, action) {
  const { id, toDelete } = action.payload;
  // delete the link to parent
  const parent = state.pods[state.pods[id].parent];
  const index = parent.children.indexOf(id);

  // update all other siblings' index
  parent.children.forEach((id) => {
    if (state.pods[id].index >= index) {
      state.pods[id].index -= 1;
    }
  });
  // remove all
  parent.children.splice(index, 1);
  toDelete.forEach((id) => {
    delete state.pods[id];
    if (state.clip === id) {
      state.clip = undefined;
    }
  });
}

export function pastePod(state, action) {
  let { parent, index, column } = action.payload;
  if (!state.clip) {
    state.error = {
      type: "error",
      msg: "No clipped pod.",
    };
    return;
  }
  let pod = state.pods[state.clip];
  // 1. remove current state.clip
  let oldparent = state.pods[pod.parent];
  oldparent.children.splice(oldparent.children.indexOf(pod.id), 1);
  oldparent.children.forEach((id) => {
    if (state.pods[id].index > pod.index) {
      state.pods[id].index -= 1;
    }
  });
  // 2. insert into the new position
  let newparent = state.pods[parent];
  if (newparent === oldparent && index > pod.index) {
    // need special adjustment if parent is not changed.
    index -= 1;
  }
  newparent.children.forEach((id) => {
    if (state.pods[id].index >= index) {
      state.pods[id].index += 1;
    }
  });
  newparent.children.push(pod.id);
  // 3. set the data of the pod itself
  pod.parent = parent;
  pod.column = column;
  pod.index = index;
  newparent.children.sort((a, b) => state.pods[a].index - state.pods[b].index);
}

function setPodType(state, action) {
  const { id, type } = action.payload;
  let pod = state.pods[id];
  if (type === "WYSIWYG" && typeof pod.content === "string") {
    pod.content = [
      {
        type: "paragraph",
        children: [
          {
            text: pod.content,
          },
        ],
      },
    ];
  }
  if (type === "CODE" && Array.isArray(pod.content)) {
    console.log("Converting to code, this will lose styles");
    pod.content = slackGetPlainText(pod.content);
  }
  pod.type = type;
}

export default {
  addPod,
  deletePod,
  pastePod,
  setPodType,

  setPodLang: (state, action) => {
    const { id, lang } = action.payload;
    state.pods[id].lang = lang;
  },
  setPodContent: (state, action) => {
    const { id, content } = action.payload;
    state.pods[id].content = content;
  },
  addColumn: (state, action) => {
    let { id } = action.payload;
    state.pods[id].column += 1;
  },
  deleteColumn: (state, action) => {
    let { id } = action.payload;
    state.pods[id].column -= 1;
  },
};
