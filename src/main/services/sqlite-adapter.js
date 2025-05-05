// Use sqlite3 instead of better-sqlite3
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Create a simple wrapper for sqlite3
function createDatabase(filePath) {
  console.log(`[sqlite-adapter] Creating database at: ${filePath}`);
  
  // Ensure directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    console.log(`[sqlite-adapter] Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Create database connection
  const db = new sqlite3.Database(filePath, (err) => {
    if (err) {
      console.error(`[sqlite-adapter] Error opening database: ${err.message}`);
    } else {
      console.log(`[sqlite-adapter] Successfully opened database at ${filePath}`);
      
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');
    }
  });
  
  // Wrap db methods to handle promises
  const dbWrapper = {
    prepare: (sql) => {
      console.log(`[sqlite-adapter] Preparing SQL: ${sql}`);
      
      return {
        // Run a statement with parameters
        run: (...params) => {
          return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
              if (err) {
                console.error(`[sqlite-adapter] Error running SQL: ${err.message}`);
                reject(err);
              } else {
                resolve({
                  changes: this.changes,
                  lastID: this.lastID
                });
              }
            });
          });
        },
        
        // Get a single row
        get: (...params) => {
          return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
              if (err) {
                console.error(`[sqlite-adapter] Error getting row: ${err.message}`);
                reject(err);
              } else {
                resolve(row);
              }
            });
          });
        },
        
        // Get all rows
        all: (...params) => {
          return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
              if (err) {
                console.error(`[sqlite-adapter] Error getting all rows: ${err.message}`);
                reject(err);
              } else {
                resolve(rows || []);
              }
            });
          });
        }
      };
    },
    
    // Execute raw SQL
    exec: (sql) => {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) {
            console.error(`[sqlite-adapter] Error executing SQL: ${err.message}`);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },
    
    // Close the database
    close: () => {
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) {
            console.error(`[sqlite-adapter] Error closing database: ${err.message}`);
            reject(err);
          } else {
            console.log(`[sqlite-adapter] Database closed successfully`);
            resolve();
          }
        });
      });
    },
    
    // Run a transaction
    transaction: (fn) => {
      return async (...args) => {
        try {
          await dbWrapper.exec('BEGIN TRANSACTION');
          const result = await fn(...args);
          await dbWrapper.exec('COMMIT');
          return result;
        } catch (err) {
          await dbWrapper.exec('ROLLBACK');
          throw err;
        }
      };
    }
  };
  
  return dbWrapper;
}

module.exports = { createDatabase }; 