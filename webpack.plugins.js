/**
 * Webpack plugins (add as needed)
 */
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = [
  // Add CopyWebpackPlugin to copy PDFKit font files to the output directory
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve(__dirname, 'node_modules/pdfkit/js/data'),
        to: 'data'
      }
    ]
  })
]; 