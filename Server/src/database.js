const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db = null;

// Initialize database connection
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DATABASE_PATH || './data/license.db';
    const dbDir = path.dirname(dbPath);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('📄 Connected to SQLite database');
      createTables()
        .then(resolve)
        .catch(reject);
    });
  });
}

// Create all necessary tables
async function createTables() {
  try {
    // First create all tables
    const tableQueries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        stripe_customer_id TEXT,
        email_verified BOOLEAN DEFAULT FALSE
      )`,
      
      // Subscriptions table
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_subscription_id TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'inactive',
        plan_id TEXT,
        plan_name TEXT,
        current_period_start DATETIME,
        current_period_end DATETIME,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        machine_limit INTEGER DEFAULT 2,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      
      // Machines table
      `CREATE TABLE IF NOT EXISTS machines (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        machine_id TEXT NOT NULL,
        machine_name TEXT,
        os_version TEXT,
        cpu_info TEXT,
        hostname TEXT,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, machine_id)
      )`,
      
      // License tokens table (for offline validation)
      `CREATE TABLE IF NOT EXISTS license_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        machine_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      
      // Audit log table
      `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    // Execute table creation queries one by one
    for (const query of tableQueries) {
      await new Promise((resolve, reject) => {
        db.run(query, (err) => {
          if (err) {
            console.error('Error creating table:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    console.log('✅ Database tables created successfully');

    // Now create indexes after tables are created
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id)',
      'CREATE INDEX IF NOT EXISTS idx_machines_user_id ON machines(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_machines_machine_id ON machines(machine_id)',
      'CREATE INDEX IF NOT EXISTS idx_license_tokens_user_machine ON license_tokens(user_id, machine_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)'
    ];

    // Execute index creation queries one by one
    for (const query of indexes) {
      await new Promise((resolve, reject) => {
        db.run(query, (err) => {
          if (err) {
            console.error('Error creating index:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    console.log('✅ Database indexes created successfully');

  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Database helper functions
const dbHelpers = {
  // Get database instance
  getDb() {
    return db;
  },

  // Run a query with parameters
  run(query, params = []) {
    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  },

  // Get a single row
  get(query, params = []) {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Get all rows
  all(query, params = []) {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  // Close database connection
  close() {
    return new Promise((resolve, reject) => {
      if (db) {
        db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('📄 Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
};

module.exports = {
  initializeDatabase,
  ...dbHelpers
}; 