/**
 * Test script for validating database functionality in OpenScribe
 * - Tests SQLite connection
 * - Creates test projects and tutorials
 * - Verifies relationships between projects and tutorials
 */

const fs = require('fs');
const path = require('path');
const { createDatabase } = require('./main/services/sqlite-adapter');
const { app } = require('electron');

// Mock app if running standalone (not within Electron)
if (!app) {
  global.app = {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(__dirname, 'temp');
      }
      return path.join(__dirname, 'temp');
    }
  };
}

// Create database connection
const dbPath = path.join(global.app.getPath('userData'), 'openscribe_test.db');
console.log(`Database test path: ${dbPath}`);

// Ensure directory exists
const dirPath = path.dirname(dbPath);
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// Initialize database
const db = createDatabase(dbPath);

// Schema definition
const schema = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  tags TEXT
);

CREATE TABLE IF NOT EXISTS tutorials (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  tutorialId TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  screenshotPath TEXT,
  actionText TEXT,
  timestamp TEXT NOT NULL,
  mousePosition TEXT,
  windowTitle TEXT,
  keyboardShortcut TEXT,
  FOREIGN KEY (tutorialId) REFERENCES tutorials(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutorials_projectId ON tutorials(projectId);
CREATE INDEX IF NOT EXISTS idx_steps_tutorialId ON steps(tutorialId);
CREATE INDEX IF NOT EXISTS idx_steps_order ON steps("order");
`;

// Helper function to generate unique id
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Test functions
async function runTests() {
  try {
    console.log('Starting database tests...');
    
    // Initialize schema
    await db.exec(schema);
    console.log('Database schema created successfully');
    
    // Test 1: Create project
    const projectId = generateId();
    const insertProject = db.prepare(`
      INSERT INTO projects (id, name, description, createdAt, updatedAt, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    await insertProject.run(
      projectId, 
      'Test Project',
      'Project for testing database functionality',
      new Date().toISOString(),
      new Date().toISOString(),
      JSON.stringify(['test', 'validation'])
    );
    console.log(`Test 1: Project created with id ${projectId}`);
    
    // Test 2: Create tutorials for the project
    const tutorialIds = [];
    const insertTutorial = db.prepare(`
      INSERT INTO tutorials (id, projectId, title, description, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (let i = 0; i < 3; i++) {
      const tutorialId = generateId();
      await insertTutorial.run(
        tutorialId,
        projectId,
        `Tutorial ${i + 1}`,
        `Test tutorial ${i + 1} description`,
        'draft',
        new Date().toISOString(),
        new Date().toISOString()
      );
      tutorialIds.push(tutorialId);
    }
    console.log(`Test 2: Created ${tutorialIds.length} tutorials`);
    
    // Test 3: Verify project retrieval
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    console.log('Test 3: Retrieved project:', project);
    
    // Test 4: Verify tutorials by project retrieval
    const tutorials = await db.prepare('SELECT * FROM tutorials WHERE projectId = ?').all(projectId);
    console.log(`Test 4: Retrieved ${tutorials.length} tutorials for project ${projectId}`);
    console.log('Tutorials:', tutorials);
    
    // Test 5: Create steps for a tutorial
    const stepInsert = db.prepare(`
      INSERT INTO steps (id, tutorialId, "order", screenshotPath, actionText, timestamp, mousePosition, windowTitle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (let i = 0; i < 5; i++) {
      await stepInsert.run(
        generateId(),
        tutorialIds[0],
        i + 1,
        `path/to/screenshot_${i + 1}.png`,
        `Action ${i + 1} description`,
        new Date().toISOString(),
        JSON.stringify({ x: 100 + i, y: 200 + i }),
        `Window Title ${i}`
      );
    }
    console.log(`Test 5: Created 5 steps for tutorial ${tutorialIds[0]}`);
    
    // Test 6: Retrieve steps for tutorial
    const steps = await db.prepare('SELECT * FROM steps WHERE tutorialId = ? ORDER BY "order"').all(tutorialIds[0]);
    console.log(`Test 6: Retrieved ${steps.length} steps for tutorial ${tutorialIds[0]}`);
    console.log('Steps:', steps);
    
    // Test 7: Close connection
    await db.close();
    console.log('Test 7: Database connection closed successfully');
    
    console.log('All database tests completed successfully!');
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
}); 