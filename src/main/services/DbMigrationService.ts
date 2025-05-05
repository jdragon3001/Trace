import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { DbConnectionManager } from './DbConnectionManager';

/**
 * DbMigrationService - Handles database schema migrations
 * 
 * This service is responsible for:
 * 1. Initializing the database schema
 * 2. Upgrading schema versions when needed
 * 3. Data migrations between schema versions
 * 4. Database backups before migrations
 */
export class DbMigrationService {
  private static instance: DbMigrationService;
  private dbManager: DbConnectionManager;
  private backupDir: string;
  
  // Current schema version - increment when schema changes
  private readonly CURRENT_SCHEMA_VERSION = 1;

  private constructor() {
    this.dbManager = DbConnectionManager.getInstance();
    
    // Create backup directory if it doesn't exist
    const userDataPath = path.join(app.getPath('userData'), 'openscribe');
    this.backupDir = path.join(userDataPath, 'backups');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  public static getInstance(): DbMigrationService {
    if (!DbMigrationService.instance) {
      DbMigrationService.instance = new DbMigrationService();
    }
    return DbMigrationService.instance;
  }

  /**
   * Initialize or migrate the database as needed
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[DbMigrationService] Initializing database...');
      
      // First, ensure the database connection is ready
      await this.dbManager.ensureInitialized();
      
      // Create schema version table if it doesn't exist
      await this.createVersionTable();
      
      // Check current schema version
      const currentVersion = await this.getCurrentSchemaVersion();
      console.log(`[DbMigrationService] Current schema version: ${currentVersion}`);
      
      if (currentVersion === 0) {
        // New database, create all tables
        console.log('[DbMigrationService] New database detected, creating schema...');
        await this.createInitialSchema();
      } else if (currentVersion < this.CURRENT_SCHEMA_VERSION) {
        // Existing database needs migration
        console.log(`[DbMigrationService] Database needs migration from v${currentVersion} to v${this.CURRENT_SCHEMA_VERSION}`);
        await this.migrateSchema(currentVersion);
      } else {
        console.log('[DbMigrationService] Database schema is up to date');
      }
      
      // Run integrity checks
      const integrityResult = await this.dbManager.checkIntegrity();
      if (!integrityResult.ok) {
        console.error('[DbMigrationService] Database integrity check failed:', integrityResult.issues);
        throw new Error(`Database integrity check failed: ${integrityResult.issues.join(', ')}`);
      }
      
      console.log('[DbMigrationService] Database initialization complete');
    } catch (error) {
      console.error('[DbMigrationService] Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Create the schema version tracking table
   */
  private async createVersionTable(): Promise<void> {
    const db = await this.dbManager.getDatabase();
    
    try {
      // Create schema_version table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          version INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    } catch (error) {
      console.error('[DbMigrationService] Error creating version table:', error);
      throw error;
    }
  }

  /**
   * Get the current schema version from the database
   * @returns Current schema version (0 if not set)
   */
  private async getCurrentSchemaVersion(): Promise<number> {
    const db = await this.dbManager.getDatabase();
    
    try {
      const versionRow = db.prepare('SELECT version FROM schema_version WHERE id = 1').get() as { version: number } | undefined;
      
      if (!versionRow) {
        return 0; // No version set yet (new database)
      }
      
      return versionRow.version;
    } catch (error) {
      console.error('[DbMigrationService] Error getting schema version:', error);
      return 0; // Assume new database on error
    }
  }

  /**
   * Update the schema version in the database
   * @param version New schema version
   */
  private async updateSchemaVersion(version: number): Promise<void> {
    const db = await this.dbManager.getDatabase();
    
    try {
      const now = new Date().toISOString();
      
      // Use REPLACE to handle both insert and update cases
      db.prepare(`
        REPLACE INTO schema_version (id, version, updated_at) 
        VALUES (1, ?, ?)
      `).run(version, now);
      
      console.log(`[DbMigrationService] Schema version updated to ${version}`);
    } catch (error) {
      console.error('[DbMigrationService] Error updating schema version:', error);
      throw error;
    }
  }

  /**
   * Create backup of the database before migration
   */
  private async createBackup(): Promise<string> {
    try {
      const db = await this.dbManager.getDatabase();
      const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
      const backupPath = path.join(this.backupDir, `openscribe_backup_${timestamp}.db`);
      
      // Create backup using SQLite's backup API
      await new Promise<void>((resolve, reject) => {
        // Since this is a better-sqlite3 Database instance, we need to use its API
        // This is a placeholder - implement the actual backup method for your DB adapter
        try {
          // For filesystem-based backup
          const dbPath = path.join(app.getPath('userData'), 'openscribe', 'openscribe.db');
          fs.copyFileSync(dbPath, backupPath);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      
      console.log(`[DbMigrationService] Created backup at ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('[DbMigrationService] Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Create the initial database schema
   */
  private async createInitialSchema(): Promise<void> {
    console.log('[DbMigrationService] Creating initial schema (v1)...');
    
    try {
      // Create tables
      await this.dbManager.createTablesIfNotExist();
      
      // Set schema version
      await this.updateSchemaVersion(1);
      
      console.log('[DbMigrationService] Initial schema created successfully');
    } catch (error) {
      console.error('[DbMigrationService] Error creating initial schema:', error);
      throw error;
    }
  }

  /**
   * Migrate the database schema from one version to another
   * @param fromVersion Current schema version
   */
  private async migrateSchema(fromVersion: number): Promise<void> {
    if (fromVersion >= this.CURRENT_SCHEMA_VERSION) {
      console.log('[DbMigrationService] No migration needed');
      return;
    }
    
    try {
      // Create backup before migration
      await this.createBackup();
      
      // Apply migrations sequentially
      for (let version = fromVersion + 1; version <= this.CURRENT_SCHEMA_VERSION; version++) {
        console.log(`[DbMigrationService] Migrating to schema v${version}...`);
        
        switch (version) {
          case 1:
            // Already handled by createInitialSchema
            break;
            
          // Add cases for future versions here
          // case 2:
          //   await this.migrateToV2();
          //   break;
            
          default:
            console.warn(`[DbMigrationService] No migration defined for version ${version}`);
        }
        
        // Update schema version after each successful migration
        await this.updateSchemaVersion(version);
        console.log(`[DbMigrationService] Migration to v${version} complete`);
      }
    } catch (error) {
      console.error('[DbMigrationService] Error during schema migration:', error);
      throw error;
    }
  }
  
  // Methods for specific migrations can be added below
  // private async migrateToV2(): Promise<void> { ... }
} 