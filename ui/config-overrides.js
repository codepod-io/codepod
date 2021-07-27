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
  // by default load all the languages
  config.plugins.push(new MonacoWebpackPlugin());
  return config;
};
