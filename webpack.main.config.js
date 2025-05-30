/**
 * Webpack configuration for the main process
 */
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main/index.ts',
  module: {
    rules: require('./webpack.rules'),
  },
  // Tell Webpack not to bundle these modules
  externals: {
    'global-mouse-events': 'commonjs global-mouse-events',
    'sharp': 'commonjs sharp',
    'uiohook-napi': 'commonjs uiohook-napi',
    'better-sqlite3': 'commonjs better-sqlite3',
    'sqlite3': 'commonjs sqlite3',
    // Add other native modules here if they cause issues
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  plugins: [
    // Copy PDFKit font data files
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/pdfkit/js/data'),
          to: 'data',
        },
      ],
    }),
  ],
}; 