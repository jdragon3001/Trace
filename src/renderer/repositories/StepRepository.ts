import { RecordingStep } from '../../shared/types';

// Define a version of Step with required id for internal use
interface Step {
  id: string;  // Non-optional id
  tutorialId: string;
  order: number;
  screenshotPath: string;
  actionText: string;
  timestamp: string;
  mousePosition?: { x: number; y: number };
  windowTitle?: string;
  keyboardShortcut?: string;
}

// Use original Step type from shared/types for external API compatibility
import { Step as SharedStep } from '../../shared/types';

/**
 * StepRepository (Client) - Manages step data in the renderer process
 * 
 * This repository:
 * 1. Provides an interface for working with steps in the renderer
 * 2. Handles communication with the main process
 * 3. Manages local caching of step data
 * 4. Ensures data consistency
 */
export class StepRepository {
  private static instance: StepRepository;
  private steps: Map<string, Step> = new Map();
  private stepsByTutorial: Map<string, string[]> = new Map();
  private currentTutorialId: string | null = null;
  
  private constructor() {}
  
  public static getInstance(): StepRepository {
    if (!StepRepository.instance) {
      StepRepository.instance = new StepRepository();
    }
    return StepRepository.instance;
  }
  
  /**
   * Set the current tutorial ID for context
   */
  public setCurrentTutorial(tutorialId: string | null): void {
    this.currentTutorialId = tutorialId;
    console.log(`[StepRepository] Current tutorial set to: ${tutorialId}`);
  }
  
  /**
   * Get the current tutorial ID
   */
  public getCurrentTutorial(): string | null {
    return this.currentTutorialId;
  }
  
  /**
   * Load all steps for a tutorial from the main process
   */
  public async loadStepsForTutorial(tutorialId: string): Promise<SharedStep[]> {
    try {
      console.log(`[StepRepository] Loading steps for tutorial: ${tutorialId}`);
      
      // Clear existing cached steps for this tutorial
      this.clearStepsForTutorial(tutorialId);
      
      // Get steps from main process
      const steps = await window.electronAPI.getStepsByTutorial(tutorialId);
      console.log(`[StepRepository] Loaded ${steps.length} steps for tutorial ${tutorialId}`);
      
      // Cache steps (only those with IDs)
      steps.forEach(step => {
        if (step.id) {
          this.cacheStep(step as Step);
        }
      });
      
      // Set current tutorial
      this.setCurrentTutorial(tutorialId);
      
      return steps;
    } catch (error) {
      console.error(`[StepRepository] Error loading steps for tutorial ${tutorialId}:`, error);
      return [];
    }
  }
  
  /**
   * Get all steps for the current tutorial from cache
   */
  public getStepsForCurrentTutorial(): Step[] {
    if (!this.currentTutorialId) return [];
    
    const stepIds = this.stepsByTutorial.get(this.currentTutorialId) || [];
    const steps = stepIds
      .map(id => this.steps.get(id))
      .filter((step): step is Step => step !== undefined)
      .sort((a, b) => a.order - b.order);
    
    return steps;
  }
  
  /**
   * Add a new step for the current tutorial
   */
  public async createStep(stepData: Omit<SharedStep, 'id'>): Promise<SharedStep | null> {
    try {
      console.log(`[StepRepository] Creating step for tutorial: ${stepData.tutorialId}`);
      
      // Call main process to create step
      const newStep = await window.electronAPI.saveStep(stepData);
      
      if (!newStep || !newStep.id) {
        console.error('[StepRepository] Failed to create step - no ID returned');
        return null;
      }
      
      // Cache the new step
      this.cacheStep(newStep as Step);
      
      console.log(`[StepRepository] Step created with ID: ${newStep.id}`);
      return newStep;
    } catch (error) {
      console.error('[StepRepository] Error creating step:', error);
      return null;
    }
  }
  
  /**
   * Update an existing step
   */
  public async updateStep(step: SharedStep): Promise<SharedStep | null> {
    if (!step.id) {
      console.error('[StepRepository] Cannot update step without ID');
      return null;
    }
    
    try {
      console.log(`[StepRepository] Updating step: ${step.id}`);
      
      // Call main process to update step
      const updatedStep = await window.electronAPI.updateStep(step);
      
      if (!updatedStep || !updatedStep.id) {
        console.error(`[StepRepository] Failed to update step ${step.id}`);
        return null;
      }
      
      // Update cache
      this.cacheStep(updatedStep as Step);
      
      console.log(`[StepRepository] Step ${step.id} updated successfully`);
      return updatedStep;
    } catch (error) {
      console.error(`[StepRepository] Error updating step ${step.id}:`, error);
      return null;
    }
  }
  
  /**
   * Delete a step
   */
  public async deleteStep(stepId: string): Promise<boolean> {
    try {
      console.log(`[StepRepository] Deleting step: ${stepId}`);
      
      // Get the step before deleting (for tutorialId)
      const step = this.steps.get(stepId);
      if (!step) {
        console.warn(`[StepRepository] Step ${stepId} not found in cache, can't delete`);
        return false;
      }
      
      // Call main process to delete step
      const success = await window.electronAPI.deleteStep(stepId);
      
      if (success) {
        // Remove from cache
        this.removeStepFromCache(stepId, step.tutorialId);
        console.log(`[StepRepository] Step ${stepId} deleted successfully`);
      } else {
        console.error(`[StepRepository] Failed to delete step ${stepId}`);
      }
      
      return success;
    } catch (error) {
      console.error(`[StepRepository] Error deleting step ${stepId}:`, error);
      return false;
    }
  }
  
  /**
   * Update the order of multiple steps
   */
  public async updateStepsOrder(steps: Pick<SharedStep, 'id' | 'order'>[]): Promise<boolean> {
    try {
      // Filter out any steps without IDs
      const validSteps = steps.filter((step): step is {id: string, order: number} => !!step.id);
      
      if (validSteps.length === 0) {
        console.warn('[StepRepository] No valid steps with IDs to update order');
        return false;
      }
      
      console.log(`[StepRepository] Updating order for ${validSteps.length} steps`);
      
      // Call main process to update order
      const success = await window.electronAPI.reorderSteps(validSteps);
      
      if (success) {
        // Update order in cache
        validSteps.forEach(({ id, order }) => {
          const step = this.steps.get(id);
          if (step) {
            step.order = order;
            this.steps.set(id, step);
          }
        });
        
        console.log(`[StepRepository] Step order updated successfully`);
      } else {
        console.error('[StepRepository] Failed to update step order');
      }
      
      return success;
    } catch (error) {
      console.error('[StepRepository] Error updating step order:', error);
      return false;
    }
  }
  
  /**
   * Convert a RecordingStep to a database Step
   */
  public convertRecordingStepToStep(recordingStep: RecordingStep, tutorialId: string): Omit<SharedStep, 'id'> {
    return {
      tutorialId,
      order: recordingStep.number,
      screenshotPath: recordingStep.screenshotPath,
      actionText: recordingStep.description || '',
      timestamp: recordingStep.timestamp,
      mousePosition: recordingStep.mousePosition,
      windowTitle: recordingStep.windowTitle || '',
      keyboardShortcut: recordingStep.keyboardShortcut || ''
    };
  }
  
  /**
   * Add or update a step in the cache
   */
  private cacheStep(step: Step): void {
    // Add to steps map
    this.steps.set(step.id, step);
    
    // Add to tutorial map
    let tutorialSteps = this.stepsByTutorial.get(step.tutorialId) || [];
    if (!tutorialSteps.includes(step.id)) {
      tutorialSteps.push(step.id);
      this.stepsByTutorial.set(step.tutorialId, tutorialSteps);
    }
  }
  
  /**
   * Remove a step from the cache
   */
  private removeStepFromCache(stepId: string, tutorialId: string): void {
    // Remove from steps map
    this.steps.delete(stepId);
    
    // Remove from tutorial map
    const tutorialSteps = this.stepsByTutorial.get(tutorialId) || [];
    const updatedSteps = tutorialSteps.filter(id => id !== stepId);
    this.stepsByTutorial.set(tutorialId, updatedSteps);
  }
  
  /**
   * Clear all steps for a tutorial from cache
   */
  private clearStepsForTutorial(tutorialId: string): void {
    const stepIds = this.stepsByTutorial.get(tutorialId) || [];
    
    // Remove all steps from steps map
    stepIds.forEach(id => this.steps.delete(id));
    
    // Clear tutorial map entry
    this.stepsByTutorial.set(tutorialId, []);
  }
  
  /**
   * Clear all steps from cache
   */
  public clearCache(): void {
    console.log('[StepRepository] Clearing cache');
    this.steps.clear();
    this.stepsByTutorial.clear();
    this.currentTutorialId = null;
  }
  
  /**
   * Get a step by its ID
   * First checks the cache, then falls back to the main process if needed
   */
  public async getStepById(stepId: string): Promise<SharedStep | null> {
    console.log(`[StepRepository] Getting step by ID: ${stepId}`);
    
    // Check cache first
    const cachedStep = this.steps.get(stepId);
    if (cachedStep) {
      console.log(`[StepRepository] Step ${stepId} found in cache`);
      return cachedStep;
    }
    
    // If not in cache, try to fetch it from the main process
    try {
      // First, try to get all steps if we have a current tutorial
      if (this.currentTutorialId) {
        console.log(`[StepRepository] Attempting to find step ${stepId} in current tutorial ${this.currentTutorialId}`);
        const steps = await window.electronAPI.getStepsByTutorial(this.currentTutorialId);
        const step = steps.find(s => s.id === stepId);
        
        if (step) {
          // Cache the step for future use
          this.cacheStep(step as Step);
          console.log(`[StepRepository] Step ${stepId} found in tutorial ${this.currentTutorialId}`);
          return step;
        }
      }
      
      // If no current tutorial or step not found in current tutorial,
      // we need to try a different approach - get all tutorials
      console.log(`[StepRepository] Step ${stepId} not found in current tutorial. Trying to find it in all tutorials.`);
      
      // This requires an API to get all tutorials, which you might need to implement
      try {
        // Get all projects first
        const projects = await window.electronAPI.getProjects();
        
        // For each project, get tutorials and check their steps
        for (const project of projects) {
          if (!project.id) continue;
          
          const tutorials = await window.electronAPI.getTutorialsByProject(project.id);
          
          for (const tutorial of tutorials) {
            if (!tutorial.id) continue;
            
            console.log(`[StepRepository] Checking tutorial ${tutorial.id} for step ${stepId}`);
            const steps = await window.electronAPI.getStepsByTutorial(tutorial.id);
            const step = steps.find(s => s.id === stepId);
            
            if (step) {
              // Cache the step for future use
              this.cacheStep(step as Step);
              console.log(`[StepRepository] Step ${stepId} found in tutorial ${tutorial.id}`);
              return step;
            }
          }
        }
      } catch (error) {
        console.error(`[StepRepository] Error searching for step ${stepId} across tutorials:`, error);
      }
      
      // If we got here, the step wasn't found
      console.warn(`[StepRepository] Step ${stepId} not found in any tutorial`);
      return null;
    } catch (error) {
      console.error(`[StepRepository] Error getting step ${stepId}:`, error);
      return null;
    }
  }
} 