// Test script to verify that SQLite is working
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Wait for app to be ready
app.whenReady().then(() => {
  console.log('==========================================');
  console.log('Starting SQLite Test');
  console.log('==========================================');

  try {
    // Test using direct require first
    console.log('Method 1: Direct require...');
    const directDb = require('better-sqlite3');
    console.log('✅ Direct require successful!');
    
    // Create test DB
    const testDbPath = path.join(app.getPath('userData'), 'test.db');
    console.log(`Creating test database at: ${testDbPath}`);
    
    // Open a test connection
    const db = new directDb(testDbPath);
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const version = db.prepare('SELECT sqlite_version() as version').get().version;
    console.log(`✅ SQLite version: ${version}`);
    
    // Test creating a table
    db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)');
    console.log('✅ Table created successfully!');
    
    // Test inserting data
    const insert = db.prepare('INSERT INTO test (name) VALUES (?)');
    const insertId = insert.run('test-value').lastInsertRowid;
    console.log(`✅ Data inserted successfully! ID: ${insertId}`);
    
    // Test selecting data
    const row = db.prepare('SELECT * FROM test WHERE id = ?').get(insertId);
    console.log(`✅ Data retrieved successfully: ${JSON.stringify(row)}`);
    
    // Close the connection
    db.close();
    console.log('✅ Database connection closed!');
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('❌ SQLite test failed:', error);
    
    // Try alternate method using explicit path
    try {
      console.log('\nMethod 2: Trying with explicit path...');
      const dbPath = path.join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
      console.log(`Looking for binary at: ${dbPath}`);
      console.log(`File exists: ${fs.existsSync(dbPath)}`);
      
      // Set environment variable
      process.env.BETTER_SQLITE3_BINARY = dbPath;
      
      // Require again
      const alternateDb = require('better-sqlite3');
      console.log('✅ Alternate require successful!');
      
      // More tests could be added here
    } catch (alternateError) {
      console.error('❌ Alternate method also failed:', alternateError);
    }
  }
  
  console.log('==========================================');
});

// Export nothing - this is just a test script
module.exports = {}; 