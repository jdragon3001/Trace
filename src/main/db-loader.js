// db-loader.js - Custom loader for better-sqlite3
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Function to load better-sqlite3 with proper native bindings
function loadBetterSqlite3() {
  // First, find where the actual binding file is located
  const possiblePaths = [
    // Dev environment path
    path.join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    // Production paths
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    path.join(app.getAppPath(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
  ];

  // Log the paths we're checking
  console.log('Checking for better-sqlite3 bindings in these locations:');
  possiblePaths.forEach(p => console.log(`- ${p}`));

  // Find the first path that exists
  const bindingPath = possiblePaths.find(p => fs.existsSync(p));

  if (!bindingPath) {
    console.error('Could not find better-sqlite3 native bindings!');
    console.error('Searched paths:', possiblePaths);
    throw new Error('Failed to locate better-sqlite3 native bindings');
  }

  console.log(`Found better-sqlite3 bindings at: ${bindingPath}`);

  // Set the binding path for better-sqlite3
  process.env.BETTER_SQLITE3_BINDING = bindingPath;

  // Now load the module
  try {
    const Database = require('better-sqlite3');
    console.log('Successfully loaded better-sqlite3');
    return Database;
  } catch (err) {
    console.error('Error loading better-sqlite3:', err);
    throw err;
  }
}

module.exports = loadBetterSqlite3; 