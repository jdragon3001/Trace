const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('Starting SQLite test');

// Create temp directory
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const dbPath = path.join(tempDir, 'test.db');
console.log(`Database path: ${dbPath}`);

try {
  // Create database
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to open database:', err);
      process.exit(1);
    }
    console.log('Connected to database');
    
    // Create table
    db.run('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)', (err) => {
      if (err) {
        console.error('Failed to create table:', err);
        db.close();
        process.exit(1);
      }
      console.log('Table created');
      
      // Insert data
      db.run('INSERT INTO test (name) VALUES (?)', ['test data'], function(err) {
        if (err) {
          console.error('Failed to insert data:', err);
          db.close();
          process.exit(1);
        }
        console.log(`Data inserted, ID: ${this.lastID}`);
        
        // Query data
        db.all('SELECT * FROM test', [], (err, rows) => {
          if (err) {
            console.error('Failed to query data:', err);
            db.close();
            process.exit(1);
          }
          console.log('Query results:', rows);
          
          // Close database
          db.close((err) => {
            if (err) {
              console.error('Failed to close database:', err);
              process.exit(1);
            }
            console.log('Database closed');
            console.log('Test completed successfully');
          });
        });
      });
    });
  });
} catch (error) {
  console.error('Uncaught error:', error);
} 