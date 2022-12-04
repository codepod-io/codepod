const os = require("os");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = function override(config, env) {
  let options = {
    languages: [
      "json",
      "javascript",
      "racket",
      "julia",
      "python",
      "scheme",
      // FIXME no racket lang support
      "racket",
    ],
  };
  // This is a hack to fix the issue with hot reloading on Windows WSL (Docker)
  // See: https://github.com/microsoft/WSL/issues/4739
  // To prevent performance issues, we will only enable this on Windows WSL
  const isWSL =
    process.platform === "linux" && os.release().includes("microsoft");
  if (isWSL) {
    config.watchOptions = {
      ignored: /node_modules/,
      poll: true,
    };
  }
  // by default load all the languages
  config.plugins.push(new MonacoWebpackPlugin());
  config.resolve.fallback = {
    fs: false,
    path: false,
  };
  return config;
};
