/**
 * Webpack configuration for the renderer process
 */
const path = require('path');
const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');

// Adjusted CSS rule for Tailwind v3
rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' }, 
    { 
      loader: 'css-loader',
      options: {
        importLoaders: 1,
        sourceMap: true
      }
    }, 
    { 
      loader: 'postcss-loader',
      options: {
        sourceMap: true
      }
    }
  ],
});

module.exports = {
  target: 'web',  // Set target to web for renderer process
  module: {
    rules,
  },
  plugins: [
    ...plugins,
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      react: path.resolve(__dirname, './node_modules/react'),
    },
    fallback: {
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify'),
      buffer: require.resolve('buffer/'),
      util: require.resolve('util/'),
    }
  },
  stats: 'errors-warnings',
  devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
  optimization: {
    minimize: process.env.NODE_ENV !== 'development'
  }
}; 