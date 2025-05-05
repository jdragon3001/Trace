import { BaseRepository } from './BaseRepository';
import { Step } from '../../shared/types';
import Database from 'better-sqlite3';

/**
 * StepRepository - Handles all database operations for Steps
 */
export class StepRepository extends BaseRepository {
  private static instance: StepRepository;

  private constructor() {
    super();
  }

  public static getInstance(): StepRepository {
    if (!StepRepository.instance) {
      StepRepository.instance = new StepRepository();
    }
    return StepRepository.instance;
  }

  /**
   * Create a new step
   * @param step Step data to save
   * @returns Created step with ID or null on failure
   */
  public async createStep(step: Omit<Step, 'id'> & { id?: string }): Promise<Step | null> {
    return this.executeInTransaction(async (db) => {
      // Verify the tutorial exists before adding a step
      const tutorialExists = await this.verifyTutorialExists(db, step.tutorialId);
      if (!tutorialExists) {
        throw new Error(`Cannot create step: Tutorial with ID ${step.tutorialId} does not exist`);
      }

      const id = step.id || this.generateId();
      
      const stmt = db.prepare(`
        INSERT INTO steps (id, tutorialId, "order", screenshotPath, actionText, timestamp, mousePosition, windowTitle, keyboardShortcut)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Log the step creation attempt
      console.log(`[StepRepository] Creating step for tutorial ${step.tutorialId}, order: ${step.order}`);
      
      try {
        stmt.run(
          id,
          step.tutorialId,
          step.order,
          step.screenshotPath || null,
          step.actionText || null,
          step.timestamp,
          step.mousePosition ? this.stringifyField(step.mousePosition) : null,
          step.windowTitle || null,
          step.keyboardShortcut || null
        );
        
        console.log(`[StepRepository] Successfully created step with ID: ${id}`);
        
        // Return the created step with ID
        return {
          id,
          tutorialId: step.tutorialId,
          order: step.order,
          screenshotPath: step.screenshotPath || '',
          actionText: step.actionText || '',
          timestamp: step.timestamp,
          mousePosition: step.mousePosition,
          windowTitle: step.windowTitle,
          keyboardShortcut: step.keyboardShortcut
        };
      } catch (error: any) {
        console.error(`[StepRepository] Failed to create step: ${error.message}`);
        throw error;
      }
    }, 'Error creating step');
  }

  /**
   * Get all steps for a tutorial, ordered by their position
   * @param tutorialId ID of the tutorial
   * @returns Array of steps or empty array on failure
   */
  public async getStepsByTutorial(tutorialId: string): Promise<Step[]> {
    const result = await this.executeDbOperation(async (db) => {
      console.log(`[StepRepository] Getting steps for tutorial: ${tutorialId}`);
      
      try {
        // First verify if the tutorial exists
        const tutorialExists = await this.verifyTutorialExists(db, tutorialId);
        if (!tutorialExists) {
          console.warn(`[StepRepository] Tutorial ${tutorialId} does not exist, returning empty steps array`);
          return [];
        }

        // Execute the query with detailed logging
        console.log(`[StepRepository] Executing SQL query: SELECT * FROM steps WHERE tutorialId = '${tutorialId}' ORDER BY "order" ASC`);
        const stmt = db.prepare('SELECT * FROM steps WHERE tutorialId = ? ORDER BY "order" ASC');
        const steps = stmt.all(tutorialId) as any[] || [];
        
        console.log(`[StepRepository] Raw query result:`, JSON.stringify(steps));
        
        if (!Array.isArray(steps)) {
          console.warn('[StepRepository] getStepsByTutorial returned non-array result');
          return [];
        }
        
        const result = steps.map(step => ({
          id: step.id,
          tutorialId: step.tutorialId,
          order: step.order,
          screenshotPath: step.screenshotPath || '',
          actionText: step.actionText || '',
          timestamp: step.timestamp,
          mousePosition: this.parseJsonField(step.mousePosition, undefined),
          windowTitle: step.windowTitle || '',
          keyboardShortcut: step.keyboardShortcut || ''
        }));
        
        console.log(`[StepRepository] Found ${result.length} steps for tutorial ${tutorialId}, with IDs: ${result.map(s => s.id).join(', ')}`);
        return result;
      } catch (error) {
        console.error(`[StepRepository] Error in getStepsByTutorial query:`, error);
        return [];
      }
    }, `Error fetching steps for tutorial ${tutorialId}`);
    
    return result || [];
  }

  /**
   * Get a single step by ID
   * @param id Step ID
   * @returns Step or null if not found
   */
  public async getStep(id: string): Promise<Step | null> {
    return this.executeDbOperation(async (db) => {
      console.log(`[StepRepository] Getting step with ID: ${id}`);
      
      const stmt = db.prepare('SELECT * FROM steps WHERE id = ?');
      const step = stmt.get(id) as any;
      
      if (!step) {
        console.log(`[StepRepository] No step found with ID: ${id}`);
        return null;
      }
      
      return {
        id: step.id,
        tutorialId: step.tutorialId,
        order: step.order,
        screenshotPath: step.screenshotPath || '',
        actionText: step.actionText || '',
        timestamp: step.timestamp,
        mousePosition: this.parseJsonField(step.mousePosition, undefined),
        windowTitle: step.windowTitle || '',
        keyboardShortcut: step.keyboardShortcut || ''
      };
    }, `Error fetching step ${id}`);
  }

  /**
   * Update an existing step
   * @param step Step data to update
   * @returns Updated step or null on failure
   */
  public async updateStep(step: Step): Promise<Step | null> {
    if (!step.id) {
      console.error('[StepRepository] Cannot update step without ID');
      return null;
    }
    
    return this.executeInTransaction(async (db) => {
      // Verify the step exists
      const existingStep = await this.getStep(step.id!);
      if (!existingStep) {
        throw new Error(`Cannot update step: Step with ID ${step.id} does not exist`);
      }
      
      const stmt = db.prepare(`
        UPDATE steps
        SET tutorialId = ?, "order" = ?, screenshotPath = ?, actionText = ?,
            timestamp = ?, mousePosition = ?, windowTitle = ?, keyboardShortcut = ?
        WHERE id = ?
      `);
      
      console.log(`[StepRepository] Updating step: ${step.id}`);
      
      stmt.run(
        step.tutorialId,
        step.order,
        step.screenshotPath,
        step.actionText || null,
        step.timestamp,
        step.mousePosition ? this.stringifyField(step.mousePosition) : null,
        step.windowTitle || null,
        step.keyboardShortcut || null,
        step.id
      );
      
      console.log(`[StepRepository] Successfully updated step: ${step.id}`);
      return step;
    }, `Error updating step ${step.id}`);
  }

  /**
   * Delete a step by ID
   * @param id Step ID to delete
   * @returns true if deleted, false otherwise
   */
  public async deleteStep(id: string): Promise<boolean> {
    const result = await this.executeInTransaction(async (db) => {
      console.log(`[StepRepository] Deleting step: ${id}`);
      
      const stmt = db.prepare('DELETE FROM steps WHERE id = ?');
      const result = stmt.run(id);
      
      const success = result.changes > 0;
      console.log(`[StepRepository] Step deletion ${success ? 'successful' : 'failed'}: ${id}`);
      return success;
    }, `Error deleting step ${id}`);
    
    return result === true;
  }

  /**
   * Update the order of multiple steps in a single transaction
   * @param steps Array of step IDs and their new order
   * @returns true if successful, false otherwise
   */
  public async updateStepsOrder(steps: Pick<Step, 'id' | 'order'>[]): Promise<boolean> {
    if (!steps.length) return true;
    
    const result = await this.executeInTransaction(async (db) => {
      console.log(`[StepRepository] Updating order for ${steps.length} steps`);
      
      const stmt = db.prepare('UPDATE steps SET "order" = ? WHERE id = ?');
      
      for (const step of steps) {
        if (!step.id) {
          throw new Error('Cannot update step order: Step ID is missing');
        }
        stmt.run(step.order, step.id);
      }
      
      console.log(`[StepRepository] Successfully updated order for ${steps.length} steps`);
      return true;
    }, 'Error updating steps order');
    
    return result === true;
  }

  /**
   * Verify that a tutorial exists in the database
   * @param db Database instance
   * @param tutorialId Tutorial ID to check
   * @returns true if exists, false otherwise
   */
  private async verifyTutorialExists(db: Database.Database, tutorialId: string): Promise<boolean> {
    try {
      const stmt = db.prepare('SELECT 1 FROM tutorials WHERE id = ?');
      const result = stmt.get(tutorialId);
      return !!result;
    } catch (error) {
      console.error(`[StepRepository] Error verifying tutorial ${tutorialId}:`, error);
      return false;
    }
  }
} 