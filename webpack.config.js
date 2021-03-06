const path = require('path');

module.exports = {
  mode: "none",
  entry: './src/nc.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'scripts'),
    chunkFormat: "module"
  },
  experiments: {
    outputModule: true,
  },
  externalsType: 'module',
  externals: {
    "mojang-minecraft": "mojang-minecraft",
    "mojang-minecraft-ui":"mojang-minecraft-ui"
  },
  target: "es2020"
};