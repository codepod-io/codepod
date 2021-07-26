// var XXX6 = 8;

// CAUTION this must be var so that it can be evaluted multiple times (during
// debugging)
var CODEPOD_MOD = CODEPOD_MOD || {};

var CODEPOD = {
  deleteNames: (ns, names) => {
    if (!CODEPOD_MOD[ns]) {
      CODEPOD_MOD[ns] = {};
    }
    for (let name of names) {
      eval(`delete CODEPOD_MOD["${ns}"].${name}`);
    }
  },
  addImport: (from, to, name) => {
    if (!CODEPOD_MOD[from]) {
      CODEPOD_MOD[from] = {};
    }
    if (!CODEPOD_MOD[to]) {
      CODEPOD_MOD[to] = {};
    }
    // console.log("CODEPOD: addImport", from, to, name);
    eval(`CODEPOD_MOD["${to}"].${name} = CODEPOD_MOD["${from}"].${name}`);
    return "OK";
  },
  deleteImport: (ns, name) => {
    if (!CODEPOD_MOD[ns]) {
      CODEPOD_MOD[ns] = {};
    }
    eval(`delete CODEPOD_MOD["${ns}"].${name}`);
  },
  eval: (code, ns, names) => {
    // ensure namespace
    if (!CODEPOD_MOD[ns]) {
      CODEPOD_MOD[ns] = {};
    }
    // console.log("=== CODEPOD: evaluate in", ns);
    // I can start to instantiate names here
    for (let k of Object.keys(CODEPOD_MOD[ns])) {
      //   console.log("=== CODEPOD: bring in", k);
      eval(`var ${k} = CODEPOD_MOD["${ns}"].${k}`);
    }
    // this is a DEF pod
    let res = eval(code);
    for (let name of names) {
      eval(`CODEPOD_MOD["${ns}"].${name} = ${name}`);
    }
    return res;
  },
};

// function CODEPOD3(code, ns, names) {
//   // ensure namespace
//   if (!CODEPOD_MOD[ns]) {
//     CODEPOD_MOD[ns] = {};
//   }
//   if (names && names.length > 0) {
//     // this is a DEF pod
//     console.log("CODEPOD: DEF pod");
//     let code1 = `
//         (() => {
//           // already defined names
//           for (let k of Object.keys(${ns})) {
//             eval("var \${k} = ${ns}.\${k}")
//           }
//           ${code}
//           ${ns} = {...${ns}, ${names.join(",")}}
//         })()
//         `;
//     console.log("CODE: ", code1);
//     eval(code1);
//   } else {
//     console.log("CODEPOD: EVAL pod");
//     let code1 = `
//         (() => {
//           // already defined names
//           for (let k of Object.keys(${ns})) {
//             eval("var \${k} = ${ns}.\${k}")
//           }
//           return eval("${code}")
//         })()
//         `;
//     console.log("CODE: ", code1);
//     return eval(code1);
//   }
// }
