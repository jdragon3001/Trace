import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DbConnectionManager } from './DbConnectionManager';
import { Project, Tutorial, Step, Asset } from '../../shared/types';

/**
 * DataMigrationService - Migrates data from the old database format to the new one
 * 
 * This service is responsible for:
 * 1. Reading data from the old database
 * 2. Converting it to the new format
 * 3. Writing it to the new database
 * 4. Ensuring data integrity during migration
 */
export class DataMigrationService {
  private static instance: DataMigrationService;
  private dbManager: DbConnectionManager;
  private readonly oldDbPath: string;
  private readonly newDbPath: string;
  private readonly backupPath: string;
  
  private constructor() {
    this.dbManager = DbConnectionManager.getInstance();
    
    // Define paths for old and new databases
    const userDataPath = path.join(app.getPath('userData'), 'openscribe');
    this.oldDbPath = path.join(userDataPath, 'openscribe.db');
    this.newDbPath = path.join(userDataPath, 'openscribe_new.db');
    this.backupPath = path.join(userDataPath, 'backups', `openscribe_backup_${this.getTimestamp()}.db`);
  }
  
  public static getInstance(): DataMigrationService {
    if (!DataMigrationService.instance) {
      DataMigrationService.instance = new DataMigrationService();
    }
    return DataMigrationService.instance;
  }
  
  /**
   * Generate a timestamp string for file naming
   */
  private getTimestamp(): string {
    return new Date().toISOString().replace(/:/g, '-').replace(/\./g, '_');
  }
  
  /**
   * Migrate data from old database to new one
   */
  public async migrateData(): Promise<boolean> {
    try {
      console.log('[DataMigrationService] Starting data migration');
      
      // Check if old database exists
      if (!fs.existsSync(this.oldDbPath)) {
        console.log('[DataMigrationService] No old database found, nothing to migrate');
        return true;
      }
      
      // Create backup of old database
      console.log(`[DataMigrationService] Creating backup at ${this.backupPath}`);
      fs.copyFileSync(this.oldDbPath, this.backupPath);
      
      // Extract data from old database
      const projects = await this.extractProjects();
      const tutorials = await this.extractTutorials();
      const steps = await this.extractSteps();
      const assets = await this.extractAssets();
      
      console.log(`[DataMigrationService] Extracted ${projects.length} projects, ${tutorials.length} tutorials, ${steps.length} steps, and ${assets.length} assets`);
      
      // Write data to new database
      await this.writeToNewDatabase(projects, tutorials, steps, assets);
      
      // Verify migration
      const success = await this.verifyMigration(projects, tutorials, steps, assets);
      if (success) {
        console.log('[DataMigrationService] Data migration successful');
        
        // Replace old database with new one
        if (fs.existsSync(this.oldDbPath)) {
          fs.renameSync(this.oldDbPath, `${this.oldDbPath}.old`);
        }
        fs.renameSync(this.newDbPath, this.oldDbPath);
        
        return true;
      } else {
        console.error('[DataMigrationService] Data migration verification failed');
        return false;
      }
    } catch (error) {
      console.error('[DataMigrationService] Error during data migration:', error);
      return false;
    }
  }
  
  /**
   * Extract projects from old database
   */
  private async extractProjects(): Promise<Project[]> {
    // Implementation will depend on specific database adapter and schema
    // This is a placeholder for the actual implementation
    return [];
  }
  
  /**
   * Extract tutorials from old database
   */
  private async extractTutorials(): Promise<Tutorial[]> {
    // Implementation will depend on specific database adapter and schema
    // This is a placeholder for the actual implementation
    return [];
  }
  
  /**
   * Extract steps from old database
   */
  private async extractSteps(): Promise<Step[]> {
    // Implementation will depend on specific database adapter and schema
    // This is a placeholder for the actual implementation
    return [];
  }
  
  /**
   * Extract assets from old database
   */
  private async extractAssets(): Promise<Asset[]> {
    // Implementation will depend on specific database adapter and schema
    // This is a placeholder for the actual implementation
    return [];
  }
  
  /**
   * Write extracted data to new database
   */
  private async writeToNewDatabase(
    projects: Project[],
    tutorials: Tutorial[],
    steps: Step[],
    assets: Asset[]
  ): Promise<void> {
    const db = await this.dbManager.getDatabase();
    
    try {
      // Start transaction
      db.prepare('BEGIN TRANSACTION').run();
      
      // Write projects
      const insertProject = db.prepare(`
        INSERT INTO projects (id, name, description, createdAt, updatedAt, parentId, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const project of projects) {
        insertProject.run(
          project.id,
          project.name,
          project.description || null,
          project.createdAt || new Date().toISOString(),
          project.updatedAt || new Date().toISOString(),
          null,
          project.tags ? JSON.stringify(project.tags) : null
        );
      }
      
      // Write tutorials
      const insertTutorial = db.prepare(`
        INSERT INTO tutorials (id, projectId, title, description, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const tutorial of tutorials) {
        insertTutorial.run(
          tutorial.id,
          tutorial.projectId,
          tutorial.title,
          tutorial.description || null,
          tutorial.status || 'draft',
          tutorial.createdAt || new Date().toISOString(),
          tutorial.updatedAt || new Date().toISOString()
        );
      }
      
      // Write steps
      const insertStep = db.prepare(`
        INSERT INTO steps (id, tutorialId, "order", screenshotPath, actionText, timestamp, mousePosition, windowTitle, keyboardShortcut)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const step of steps) {
        insertStep.run(
          step.id,
          step.tutorialId,
          step.order,
          step.screenshotPath || null,
          step.actionText || null,
          step.timestamp,
          step.mousePosition ? JSON.stringify(step.mousePosition) : null,
          step.windowTitle || null,
          step.keyboardShortcut || null
        );
      }
      
      // Write assets
      const insertAsset = db.prepare(`
        INSERT INTO assets (id, tutorialId, type, path, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const asset of assets) {
        insertAsset.run(
          asset.id,
          asset.tutorialId,
          asset.type,
          asset.path,
          new Date().toISOString()
        );
      }
      
      // Commit transaction
      db.prepare('COMMIT').run();
      
      console.log('[DataMigrationService] Data written to new database successfully');
    } catch (error) {
      // Rollback on error
      db.prepare('ROLLBACK').run();
      console.error('[DataMigrationService] Error writing to new database:', error);
      throw error;
    }
  }
  
  /**
   * Verify that migration was successful
   */
  private async verifyMigration(
    originalProjects: Project[],
    originalTutorials: Tutorial[],
    originalSteps: Step[],
    originalAssets: Asset[]
  ): Promise<boolean> {
    try {
      const db = await this.dbManager.getDatabase();
      
      // Verify project count
      const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
      if (projectCount.count !== originalProjects.length) {
        console.error(`[DataMigrationService] Project count mismatch: ${projectCount.count} vs ${originalProjects.length}`);
        return false;
      }
      
      // Verify tutorial count
      const tutorialCount = db.prepare('SELECT COUNT(*) as count FROM tutorials').get() as { count: number };
      if (tutorialCount.count !== originalTutorials.length) {
        console.error(`[DataMigrationService] Tutorial count mismatch: ${tutorialCount.count} vs ${originalTutorials.length}`);
        return false;
      }
      
      // Verify step count
      const stepCount = db.prepare('SELECT COUNT(*) as count FROM steps').get() as { count: number };
      if (stepCount.count !== originalSteps.length) {
        console.error(`[DataMigrationService] Step count mismatch: ${stepCount.count} vs ${originalSteps.length}`);
        return false;
      }
      
      // Verify asset count
      const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get() as { count: number };
      if (assetCount.count !== originalAssets.length) {
        console.error(`[DataMigrationService] Asset count mismatch: ${assetCount.count} vs ${originalAssets.length}`);
        return false;
      }
      
      console.log('[DataMigrationService] Migration verification passed');
      return true;
    } catch (error) {
      console.error('[DataMigrationService] Error verifying migration:', error);
      return false;
    }
  }
  
  /**
   * Check if a migration is needed
   */
  public async isMigrationNeeded(): Promise<boolean> {
    try {
      // Check if old database exists
      if (!fs.existsSync(this.oldDbPath)) {
        return false;
      }
      
      // Check if we have any data in the new database
      const db = await this.dbManager.getDatabase();
      const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
      
      // If we have projects in the new database, migration is not needed
      return projectCount.count === 0;
    } catch (error) {
      console.error('[DataMigrationService] Error checking if migration is needed:', error);
      return false;
    }
  }
} 