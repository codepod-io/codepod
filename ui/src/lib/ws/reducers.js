export default {
  WS_STATUS: (state, action) => {
    const { lang, status } = action.payload;
    // console.log("WS_STATUS", { lang, status });
    state.kernels[lang].status = status;
  },
  WS_CONNECTED: (state, action) => {
    state.runtimeConnected = true;
  },
  WS_DISCONNECTED: (state, action) => {
    state.runtimeConnected = false;
  },
  WS_RESULT: (state, action) => {
    let { podId, content, count } = action.payload;
    // console.log("WS_RESULT", action.payload);
    // console.log("podId", podId)
    if (podId in state.pods) {
      state.pods[podId].result = {
        text: content.data["text/plain"],
        html: content.data["text/html"],
        count: count,
      };
      // state.pods[podId].running = false;
    } else {
      // most likely this podId is "CODEPOD", which is for startup code and
      // should not be send to the browser
      console.log("WARNING podId not recognized", podId);
    }
  },
  WS_DISPLAY_DATA: (state, action) => {
    let { podId, content, count } = action.payload;
    // console.log("WS_DISPLAY_DATA", content);
    state.pods[podId].result = {
      text: content.data["text/plain"],
      // FIXME hard coded MIME
      image: content.data["image/png"],
      count: count,
    };
  },
  WS_EXECUTE_REPLY: (state, action) => {
    let { podId, result, count } = action.payload;
    // console.log("WS_EXECUTE_REPLY", action.payload);
    if (podId in state.pods) {
      // state.pods[podId].execute_reply = {
      //   text: result,
      //   count: count,
      // };
      // console.log("WS_EXECUTE_REPLY", result);
      state.pods[podId].running = false;
      if (!state.pods[podId].result) {
        state.pods[podId].result = {
          text: result,
          count: count,
        };
      }
    } else {
      // most likely this podId is "CODEPOD", which is for startup code and
      // should not be send to the browser
      console.log("WARNING podId not recognized", podId);
    }
  },
  WS_STDOUT: (state, action) => {
    let { podId, stdout } = action.payload;
    // FIXME this is stream
    // FIXME this is base64 encoded
    state.pods[podId].stdout = stdout;
  },
  WS_ERROR: (state, action) => {
    let { podId, ename, evalue, stacktrace } = action.payload;
    if (podId === "CODEPOD") return;
    state.pods[podId].error = {
      ename,
      evalue,
      stacktrace,
    };
  },
  WS_STREAM: (state, action) => {
    let { podId, text } = action.payload;
    if (!(podId in state.pods)) {
      console.log("WARNING podId is not found:", podId);
      return;
    }
    // append
    state.pods[podId].stdout += text;
  },
  WS_IO_RESULT: (state, action) => {
    let { podId, result, name } = action.payload;
    // if (!("io" in state.pods[podId])) {
    //   state.pods[podId].io = {};
    // }
    state.pods[podId].io[name] = { result };
  },
  WS_IO_ERROR: (state, action) => {
    let { podId, name, ename, evalue, stacktrace } = action.payload;
    console.log("IOERROR", { podId, name, ename, evalue, stacktrace });
    state.pods[podId].io[name] = {
      error: {
        ename,
        evalue,
        stacktrace,
      },
    };
  },
};
