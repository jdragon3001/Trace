import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * DbConnectionManager - Handles database connection management
 * 
 * This class is responsible for:
 * 1. Creating and maintaining the SQLite connection
 * 2. Providing transaction support
 * 3. Handling connection errors and retries
 * 4. Managing connection pooling (for future scaling)
 */
export class DbConnectionManager {
  private static instance: DbConnectionManager;
  private db: Database.Database | null = null;
  private dbPath: string;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private connectionRetries = 0;
  private readonly MAX_RETRIES = 3;

  private constructor() {
    // Ensure app data directory exists
    const userDataPath = path.join(app.getPath('userData'), 'openscribe');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.dbPath = path.join(userDataPath, 'openscribe.db');
    console.log(`[DbConnectionManager] Database path: ${this.dbPath}`);
    
    // Start initialization
    this.initPromise = this.initialize();
  }

  public static getInstance(): DbConnectionManager {
    if (!DbConnectionManager.instance) {
      console.log('[DbConnectionManager] Creating new instance');
      DbConnectionManager.instance = new DbConnectionManager();
    }
    return DbConnectionManager.instance;
  }

  /**
   * Initialize the database connection
   */
  private async initialize(): Promise<void> {
    try {
      console.log(`[DbConnectionManager] Initializing database connection to ${this.dbPath}`);
      
      // Create SQLite connection with WAL journal mode for better concurrency
      this.db = new Database(this.dbPath, { 
        verbose: console.log,
        fileMustExist: false
      });
      
      // Configure database settings
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      // Verify connection
      const result = this.db.prepare('SELECT sqlite_version() as version').get() as { version: string };
      console.log(`[DbConnectionManager] Connected to SQLite version: ${result.version}`);
      
      this.isInitialized = true;
      console.log('[DbConnectionManager] Database connection successfully initialized');
    } catch (error) {
      console.error('[DbConnectionManager] Failed to initialize database:', error);
      
      // Try to recover with a retry mechanism
      if (this.connectionRetries < this.MAX_RETRIES) {
        this.connectionRetries++;
        console.log(`[DbConnectionManager] Retrying connection (${this.connectionRetries}/${this.MAX_RETRIES})...`);
        
        // Close any existing connection that might be corrupted
        await this.closeConnection();
        
        // Wait a moment before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Recursive retry
        return this.initialize();
      }
      
      throw error;
    }
  }

  /**
   * Ensure the database is initialized before performing operations
   */
  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && this.initPromise) {
      console.log('[DbConnectionManager] Waiting for database initialization...');
      await this.initPromise;
    }
    
    if (!this.isInitialized || !this.db) {
      throw new Error('Database failed to initialize properly');
    }
  }

  /**
   * Get the database instance for operations
   */
  public async getDatabase(): Promise<Database.Database> {
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('Database is not initialized');
    }
    return this.db;
  }

  /**
   * Run a function within a transaction
   * @param operation Function to run within transaction
   * @returns Result of the operation
   */
  public async runInTransaction<T>(operation: (db: Database.Database) => T): Promise<T> {
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('Database is not initialized');
    }
    
    try {
      // Begin transaction
      this.db.prepare('BEGIN TRANSACTION').run();
      
      // Run the operation
      const result = operation(this.db);
      
      // Commit transaction
      this.db.prepare('COMMIT').run();
      
      return result;
    } catch (error) {
      // Rollback on error
      if (this.db) {
        try {
          this.db.prepare('ROLLBACK').run();
        } catch (rollbackError) {
          console.error('[DbConnectionManager] Failed to rollback transaction:', rollbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  public async closeConnection(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.isInitialized = false;
      } catch (error) {
        console.error('[DbConnectionManager] Error closing database connection:', error);
      }
    }
  }

  /**
   * Create tables if they don't exist
   */
  public async createTablesIfNotExist(): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('Database is not initialized');
    }
    
    try {
      // Create tables with explicit column types and constraints
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          parentId TEXT,
          tags TEXT
        );
        
        CREATE TABLE IF NOT EXISTS tutorials (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
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
        
        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          tutorialId TEXT NOT NULL,
          path TEXT NOT NULL,
          type TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (tutorialId) REFERENCES tutorials(id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS shapes (
          id TEXT PRIMARY KEY,
          stepId TEXT NOT NULL,
          imagePath TEXT NOT NULL,
          type TEXT NOT NULL,
          startX REAL NOT NULL,
          startY REAL NOT NULL,
          endX REAL NOT NULL,
          endY REAL NOT NULL,
          color TEXT NOT NULL,
          FOREIGN KEY (stepId) REFERENCES steps(id) ON DELETE CASCADE
        );
      `);
      
      // Create indexes for performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tutorials_projectId ON tutorials(projectId);
        CREATE INDEX IF NOT EXISTS idx_steps_tutorialId ON steps(tutorialId);
        CREATE INDEX IF NOT EXISTS idx_steps_order ON steps("order");
        CREATE INDEX IF NOT EXISTS idx_assets_tutorialId ON assets(tutorialId);
        CREATE INDEX IF NOT EXISTS idx_shapes_stepId ON shapes(stepId);
        CREATE INDEX IF NOT EXISTS idx_shapes_imagePath ON shapes(imagePath);
      `);
      
      console.log('[DbConnectionManager] Database tables and indexes created successfully');
    } catch (error) {
      console.error('[DbConnectionManager] Failed to create tables:', error);
      throw error;
    }
  }

  /**
   * Run database integrity check
   * @returns Results of integrity check
   */
  public async checkIntegrity(): Promise<{ ok: boolean; issues: string[] }> {
    await this.ensureInitialized();
    if (!this.db) {
      return { ok: false, issues: ['Database is not initialized'] };
    }
    
    try {
      const result = this.db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
      const issues = result.filter(row => row.integrity_check !== 'ok').map(row => row.integrity_check);
      
      return {
        ok: issues.length === 0,
        issues
      };
    } catch (error: any) {
      return {
        ok: false,
        issues: [`Error running integrity check: ${error.message}`]
      };
    }
  }

  /**
   * Get the database file path
   * @returns The path to the database file
   */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Check if the shapes table exists and create it if not
   */
  public async checkShapesTable(): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('Database is not initialized');
    }
    
    try {
      // Check if the shapes table exists
      const tableExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shapes'").get() as { name: string } | undefined;
      console.log(`[DbConnectionManager] Shapes table exists: ${!!tableExists}`);
      
      if (!tableExists) {
        console.log('[DbConnectionManager] Creating shapes table...');
        
        // Create shapes table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS shapes (
            id TEXT PRIMARY KEY,
            stepId TEXT NOT NULL,
            imagePath TEXT NOT NULL,
            type TEXT NOT NULL,
            startX REAL NOT NULL,
            startY REAL NOT NULL,
            endX REAL NOT NULL,
            endY REAL NOT NULL,
            color TEXT NOT NULL
          );
          
          CREATE INDEX IF NOT EXISTS idx_shapes_stepId ON shapes(stepId);
          CREATE INDEX IF NOT EXISTS idx_shapes_imagePath ON shapes(imagePath);
        `);
        
        console.log('[DbConnectionManager] Shapes table created successfully');
      } else {
        // Check table structure
        const tableInfo = this.db.prepare("PRAGMA table_info(shapes)").all() as Array<{ name: string, type: string }>;
        console.log(`[DbConnectionManager] Shapes table structure:`, JSON.stringify(tableInfo));
        
        // Check if the table has the required columns
        const requiredColumns = ['id', 'stepId', 'imagePath', 'type', 'startX', 'startY', 'endX', 'endY', 'color'];
        const missingColumns = requiredColumns.filter(col => !tableInfo.find(info => info.name === col));
        
        if (missingColumns.length > 0) {
          console.error(`[DbConnectionManager] Shapes table is missing columns: ${missingColumns.join(', ')}`);
        } else {
          console.log('[DbConnectionManager] Shapes table structure is valid');
        }
      }
    } catch (error) {
      console.error('[DbConnectionManager] Error checking shapes table:', error);
      throw error;
    }
  }
} 