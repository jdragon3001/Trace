import { DbMigrationService } from './DbMigrationService';
import { StepRepository } from '../repositories/StepRepository';
import path from 'path';
import { app } from 'electron';
import { DbConnectionManager } from './DbConnectionManager';

// Import our custom SQLite adapter instead of better-sqlite3
import { createDatabase } from '../services/sqlite-adapter';

// Core entity interfaces
export interface Project {
  id?: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[]; // Stored as JSON string in DB
  parentId?: string;
}

export interface Tutorial {
  id?: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'draft' | 'ready' | 'exported';
  createdAt?: string;
  updatedAt?: string;
}

export interface Step {
  id?: string;
  tutorialId: string;
  order: number;
  screenshotPath: string;
  actionText: string;
  timestamp: string;
  mousePosition?: { x: number; y: number }; // Stored as JSON
  windowTitle?: string;
  keyboardShortcut?: string;
}

export interface Asset {
  id?: string;
  tutorialId: string;
  type: string;
  path: string;
}

/**
 * DatabaseService - Central service for database operations
 * 
 * This service:
 * 1. Initializes the database and schema
 * 2. Provides high-level database operations for the application
 * 3. Coordinates between different repositories
 * 4. Manages cached data
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private migrationService: DbMigrationService;
  private stepRepository: StepRepository;
  private dbManager: DbConnectionManager;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  
  // Cache for frequently used data
  private currentProjectId: string | null = null;
  private currentTutorialId: string | null = null;
  
  private constructor() {
    this.migrationService = DbMigrationService.getInstance();
    this.stepRepository = StepRepository.getInstance();
    this.dbManager = DbConnectionManager.getInstance();
    
    // Start initialization process
    this.initPromise = this.initialize();
  }
  
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      console.log('[DatabaseService] Creating new instance');
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
  
  /**
   * Initialize the database
   */
  private async initialize(): Promise<void> {
    try {
      console.log('[DatabaseService] Initializing database...');
      
      // Initialize schema through migration service
      await this.migrationService.initialize();
      
      this.initialized = true;
      console.log('[DatabaseService] Database initialization complete');
    } catch (error) {
      console.error('[DatabaseService] Database initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Ensure the database is initialized before performing operations
   */
  public async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      console.log('[DatabaseService] Waiting for database initialization...');
      await this.initPromise;
    }
    
    if (!this.initialized) {
      throw new Error('Database failed to initialize properly');
    }
  }
  
  // Step Operations
  
  /**
   * Create a new step
   */
  public async createStep(step: Omit<Step, 'id'> & { id?: string }): Promise<Step> {
    await this.ensureInitialized();
    
    try {
      const result = await this.stepRepository.createStep(step);
      if (!result) {
        throw new Error(`Failed to create step for tutorial ${step.tutorialId}`);
      }
      return result;
    } catch (error: any) {
      console.error('[DatabaseService] Error creating step:', error);
      throw error;
    }
  }
  
  /**
   * Get a step by ID
   */
  public async getStep(id: string): Promise<Step | null> {
    await this.ensureInitialized();
    return this.stepRepository.getStep(id);
  }
  
  /**
   * Get all steps for a tutorial
   */
  public async getStepsByTutorial(tutorialId: string): Promise<Step[]> {
    await this.ensureInitialized();
    
    try {
      console.log(`[DatabaseService] Getting steps for tutorial: ${tutorialId}`);
      const steps = await this.stepRepository.getStepsByTutorial(tutorialId);
      console.log(`[DatabaseService] Found ${steps.length} steps`);
      return steps;
    } catch (error: any) {
      console.error(`[DatabaseService] Error getting steps for tutorial ${tutorialId}:`, error);
      return [];
    }
  }
  
  /**
   * Update an existing step
   */
  public async updateStep(step: Step): Promise<Step> {
    await this.ensureInitialized();
    
    try {
      const result = await this.stepRepository.updateStep(step);
      if (!result) {
        throw new Error(`Failed to update step ${step.id}`);
      }
      return result;
    } catch (error: any) {
      console.error('[DatabaseService] Error updating step:', error);
      throw error;
    }
  }
  
  /**
   * Delete a step
   */
  public async deleteStep(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      return await this.stepRepository.deleteStep(id);
    } catch (error: any) {
      console.error('[DatabaseService] Error deleting step:', error);
      return false;
    }
  }
  
  /**
   * Update the order of multiple steps
   */
  public async updateStepsOrder(steps: Pick<Step, 'id' | 'order'>[]): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      return await this.stepRepository.updateStepsOrder(steps);
    } catch (error: any) {
      console.error('[DatabaseService] Error updating steps order:', error);
      return false;
    }
  }
  
  // State Management
  
  /**
   * Set current project ID
   */
  public setCurrentProject(projectId: string | null): void {
    this.currentProjectId = projectId;
    console.log(`[DatabaseService] Current project set to: ${projectId}`);
  }
  
  /**
   * Get current project ID
   */
  public getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }
  
  /**
   * Set current tutorial ID
   */
  public setCurrentTutorial(tutorialId: string | null): void {
    this.currentTutorialId = tutorialId;
    console.log(`[DatabaseService] Current tutorial set to: ${tutorialId}`);
  }
  
  /**
   * Get current tutorial ID
   */
  public getCurrentTutorialId(): string | null {
    return this.currentTutorialId;
  }
  
  // Database Management
  
  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    // Close connections through repositories when needed
  }
  
  /**
   * Run database maintenance tasks
   */
  public async runMaintenance(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      console.log('[DatabaseService] Running database maintenance...');
      // Add maintenance tasks as needed
      console.log('[DatabaseService] Database maintenance complete');
    } catch (error: any) {
      console.error('[DatabaseService] Error during database maintenance:', error);
    }
  }
  
  /**
   * Create a new project
   */
  public async createProject(project: Omit<Project, 'id'> & { id?: string }): Promise<Project> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      
      // Generate ID if not provided
      const projectWithId = {
        ...project,
        id: project.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };
      
      // Run the insert query - removed tags column which doesn't exist in the database
      const insertSql = `
        INSERT INTO projects (id, name, description, createdAt, updatedAt, parentId)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.prepare(insertSql).run(
        projectWithId.id,
        projectWithId.name,
        projectWithId.description || null,
        projectWithId.createdAt || new Date().toISOString(),
        projectWithId.updatedAt || new Date().toISOString(),
        projectWithId.parentId || null
      );
      
      console.log(`[DatabaseService] Created project: ${projectWithId.name} (${projectWithId.id})`);
      
      // Set as current project
      this.setCurrentProject(projectWithId.id);
      
      return projectWithId;
    } catch (error: any) {
      console.error('[DatabaseService] Error creating project:', error);
      throw error;
    }
  }
  
  /**
   * Get all projects
   */
  public async getAllProjects(): Promise<Project[]> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      const projects = db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC').all();
      console.log(`[DatabaseService] Retrieved ${projects.length} projects`);
      
      return projects.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        parentId: row.parentId
      }));
    } catch (error: any) {
      console.error('[DatabaseService] Error retrieving projects:', error);
      return [];
    }
  }
  
  /**
   * Get recent tutorials
   */
  public async getRecentTutorials(limit: number = 5): Promise<Tutorial[]> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      const tutorials = db.prepare(`
        SELECT * FROM tutorials 
        ORDER BY updatedAt DESC 
        LIMIT ?
      `).all(limit);
      
      console.log(`[DatabaseService] Retrieved ${tutorials.length} recent tutorials`);
      
      return tutorials.map((row: any) => ({
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        description: row.description,
        status: row.status as 'draft' | 'ready' | 'exported',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error: any) {
      console.error('[DatabaseService] Error retrieving recent tutorials:', error);
      return [];
    }
  }

  /**
   * Get a project by ID
   */
  public async getProject(id: string): Promise<Project | null> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
      
      if (!project) {
        console.log(`[DatabaseService] Project with ID ${id} not found`);
        return null;
      }
      
      console.log(`[DatabaseService] Retrieved project: ${project.name} (${project.id})`);
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        parentId: project.parentId
      };
    } catch (error: any) {
      console.error(`[DatabaseService] Error retrieving project with ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new tutorial
   */
  public async createTutorial(tutorial: Omit<Tutorial, 'id'> & { id?: string }): Promise<Tutorial> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      
      // Generate ID if not provided
      const tutorialWithId = {
        ...tutorial,
        id: tutorial.id || `tut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };
      
      // Run the insert query
      const insertSql = `
        INSERT INTO tutorials (id, projectId, title, description, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.prepare(insertSql).run(
        tutorialWithId.id,
        tutorialWithId.projectId,
        tutorialWithId.title,
        tutorialWithId.description || null,
        tutorialWithId.status,
        tutorialWithId.createdAt || new Date().toISOString(),
        tutorialWithId.updatedAt || new Date().toISOString()
      );
      
      console.log(`[DatabaseService] Created tutorial: ${tutorialWithId.title} (${tutorialWithId.id}) for project ${tutorialWithId.projectId}`);
      
      // Set as current tutorial
      this.setCurrentTutorial(tutorialWithId.id);
      
      return tutorialWithId;
    } catch (error: any) {
      console.error('[DatabaseService] Error creating tutorial:', error);
      throw error;
    }
  }

  /**
   * Get tutorials for a project
   */
  public async getTutorialsByProject(projectId: string): Promise<Tutorial[]> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      const tutorials = db.prepare('SELECT * FROM tutorials WHERE projectId = ? ORDER BY updatedAt DESC').all(projectId);
      console.log(`[DatabaseService] Retrieved ${tutorials.length} tutorials for project ${projectId}`);
      
      return tutorials.map((row: any) => ({
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        description: row.description,
        status: row.status as 'draft' | 'ready' | 'exported',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error: any) {
      console.error(`[DatabaseService] Error retrieving tutorials for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Get a tutorial by ID
   */
  public async getTutorial(id: string): Promise<Tutorial | null> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      const tutorial = db.prepare(`
        SELECT * FROM tutorials WHERE id = ?
      `).get(id);
      
      if (!tutorial) {
        return null;
      }
      
      return tutorial as Tutorial;
    } catch (error: any) {
      console.error(`[DatabaseService] Error getting tutorial ${id}:`, error);
      return null;
    }
  }

  /**
   * Update an existing tutorial
   */
  public async updateTutorial(tutorial: Tutorial): Promise<Tutorial> {
    await this.ensureInitialized();
    
    try {
      if (!tutorial.id) {
        throw new Error('Tutorial ID is required for update');
      }
      
      const db = await this.dbManager.getDatabase();
      
      // Ensure updatedAt is set
      const updatedTutorial = {
        ...tutorial,
        updatedAt: tutorial.updatedAt || new Date().toISOString()
      };
      
      const result = db.prepare(`
        UPDATE tutorials
        SET projectId = ?,
            title = ?,
            description = ?,
            status = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(
        updatedTutorial.projectId,
        updatedTutorial.title,
        updatedTutorial.description || null,
        updatedTutorial.status,
        updatedTutorial.updatedAt,
        updatedTutorial.id
      );
      
      if (result.changes === 0) {
        throw new Error(`Failed to update tutorial ${tutorial.id}`);
      }
      
      return updatedTutorial;
    } catch (error: any) {
      console.error('[DatabaseService] Error updating tutorial:', error);
      throw error;
    }
  }

  /**
   * Delete a tutorial
   */
  public async deleteTutorial(tutorialId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      
      // First, get all steps to clean up resources if needed
      const steps = await this.getStepsByTutorial(tutorialId);
      console.log(`[DatabaseService] Deleting tutorial ${tutorialId} with ${steps.length} steps`);
      
      // Delete the tutorial (cascading delete will remove steps due to FK constraints)
      const result = db.prepare('DELETE FROM tutorials WHERE id = ?').run(tutorialId);
      
      // Check if anything was deleted
      const success = result.changes > 0;
      
      if (success) {
        console.log(`[DatabaseService] Successfully deleted tutorial ${tutorialId}`);
        
        // Clear current tutorial if it was the one deleted
        if (this.currentTutorialId === tutorialId) {
          this.setCurrentTutorial(null);
        }
      } else {
        console.log(`[DatabaseService] No tutorial found with ID ${tutorialId} to delete`);
      }
      
      return success;
    } catch (error: any) {
      console.error(`[DatabaseService] Error deleting tutorial ${tutorialId}:`, error);
      return false;
    }
  }
  
  /**
   * Delete a project by ID
   */
  public async deleteProject(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const db = await this.dbManager.getDatabase();
      
      // First, get all tutorials to know what's being deleted
      const tutorials = await this.getTutorialsByProject(projectId);
      console.log(`[DatabaseService] Deleting project ${projectId} with ${tutorials.length} tutorials`);
      
      // Delete the project (cascading delete will remove tutorials and steps due to FK constraints)
      const result = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      
      // Check if anything was deleted
      const success = result.changes > 0;
      
      if (success) {
        console.log(`[DatabaseService] Successfully deleted project ${projectId}`);
        
        // Clear current project if it was the one deleted
        if (this.currentProjectId === projectId) {
          this.setCurrentProject(null);
          this.setCurrentTutorial(null);
        }
      } else {
        console.log(`[DatabaseService] No project found with ID ${projectId} to delete`);
      }
      
      return success;
    } catch (error: any) {
      console.error(`[DatabaseService] Error deleting project ${projectId}:`, error);
      return false;
    }
  }
} 