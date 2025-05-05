// Simple adapter to load better-sqlite3 without relying on bindings discovery
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function createDatabase(filePath, options = {}) {
  // Find the exact location of better_sqlite3.node
  const basePath = app.isPackaged 
    ? process.resourcesPath
    : path.join(process.cwd());
  
  // Get the direct path to the binary
  const binaryPath = path.join(
    basePath, 
    'node_modules', 
    'better-sqlite3', 
    'build', 
    'Release', 
    'better_sqlite3.node'
  );
  
  console.log(`[DB-ADAPTER] Using direct path to better-sqlite3 native module: ${binaryPath}`);
  
  if (!fs.existsSync(binaryPath)) {
    console.error(`[DB-ADAPTER] Native module not found at: ${binaryPath}`);
    throw new Error(`SQLite native module not found at: ${binaryPath}`);
  }
  
  try {
    // Set environment variable to point to our binary
    process.env.BETTER_SQLITE3_BINARY = binaryPath;
    
    // Dynamically load the module with binary path
    const Database = require('better-sqlite3');
    return new Database(filePath, {
      ...options,
      nativeBinding: binaryPath // Direct override
    });
  } catch (err) {
    console.error('[DB-ADAPTER] Failed to initialize database:', err);
    throw err;
  }
}

module.exports = { createDatabase }; 