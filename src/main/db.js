// Custom binding for better-sqlite3
const path = require('path');
const sqlite3 = require('better-sqlite3');
const isDev = process.env.NODE_ENV === 'development';

// Export the Database class with proper bindings
module.exports = function(filePath, options) {
  try {
    // Attempt to use better-sqlite3 directly first
    return new sqlite3(filePath, options);
  } catch (originalError) {
    console.error('Initial SQLite binding error:', originalError);
    
    try {
      // Try alternate methods to load the binding
      const customBindingPath = isDev
        ? path.join(__dirname, '../../node_modules/better-sqlite3/build/Release/better_sqlite3.node')
        : path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node');
      
      console.log('Attempting to load SQLite from:', customBindingPath);
      
      // Try with custom binding path
      return new sqlite3(filePath, {
        ...options,
        nativeBinding: customBindingPath
      });
    } catch (fallbackError) {
      console.error('Fallback SQLite binding error:', fallbackError);
      throw new Error(`Failed to initialize SQLite database: ${originalError.message}\nFallback error: ${fallbackError.message}`);
    }
  }
}; 