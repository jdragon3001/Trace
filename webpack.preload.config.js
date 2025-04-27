/**
 * Webpack configuration for preload scripts
 */
const path = require('path');

module.exports = {
  target: 'electron-preload',
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
}; 