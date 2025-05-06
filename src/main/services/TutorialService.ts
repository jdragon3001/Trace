import { dialog, ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcChannels } from '../../shared/constants';
import { DatabaseService, Tutorial, Step } from './DatabaseService';
import { MigrationService } from './MigrationService';

export class TutorialService {
  private static instance: TutorialService;
  private databaseService: DatabaseService;
  private migrationService: MigrationService;
  private currentTutorialId: string | null = null;
  private userDataPath: string;
  private currentProjectId: string | null = null;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.migrationService = MigrationService.getInstance();
    this.userDataPath = path.join(app.getPath('userData'), 'openscribe');
    
    // Ensure the data directory exists
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }
    
    // Register IPC handlers
    this.registerIpcHandlers();
    
    // Try to migrate old data
    this.tryMigrateOldData();
  }

  public static getInstance(): TutorialService {
    if (!TutorialService.instance) {
      TutorialService.instance = new TutorialService();
    }
    return TutorialService.instance;
  }

  private async tryMigrateOldData(): Promise<void> {
    try {
      // Backup old projects first
      const backupPath = this.migrationService.backupOldProjects();
      if (backupPath) {
        console.log(`Backed up old projects to ${backupPath}`);
        
        // Perform migration
        const migrationResult = await this.migrationService.migrateOldData();
        console.log(`Migration result:`, migrationResult);
      }
    } catch (error) {
      console.error('Error during migration attempt:', error);
    }
  }

  private registerIpcHandlers(): void {
    // Get all tutorials
    // Commented out because DatabaseService doesn't have an getAllTutorials method
    /*
    ipcMain.handle(IpcChannels.GET_TUTORIALS, async () => {
      try {
        console.log('[TutorialService] Retrieving all tutorials...');
        const tutorials = await this.databaseService.getAllTutorials();
        console.log(`[TutorialService] Retrieved ${tutorials.length} tutorials`);
        return tutorials;
      } catch (error) {
        console.error('[TutorialService] Error retrieving tutorials:', error);
        return []; // Return empty array instead of throwing to prevent UI errors
      }
    });
    */

    // Get recent tutorials
    ipcMain.handle(IpcChannels.GET_RECENT_TUTORIALS, async () => {
      try {
        console.log('[TutorialService] Retrieving recent tutorials...');
        const tutorials = await this.databaseService.getRecentTutorials(10);
        console.log(`[TutorialService] Retrieved ${tutorials.length} recent tutorials`);
        return tutorials;
      } catch (error) {
        console.error('[TutorialService] Error retrieving recent tutorials:', error);
        return []; // Return empty array instead of throwing to prevent UI errors
      }
    });

    // Create new tutorial
    ipcMain.handle(IpcChannels.CREATE_TUTORIAL, async (_event, title: string, description?: string) => {
      try {
        console.log(`[TutorialService] Creating tutorial: "${title}"`);
        const tutorial = await this.createTutorial(title, description);
        console.log(`[TutorialService] Tutorial created with ID: ${tutorial.id}`);
        return tutorial;
      } catch (error) {
        console.error('[TutorialService] Error creating tutorial:', error);
        throw error; // Rethrow to show error in UI
      }
    });

    // Save step
    // DUPLICATED: This handler is already registered in ProjectService
    // Commented out to avoid duplicate handler registration
    /*
    ipcMain.handle(IpcChannels.SAVE_STEP, (_event, step: Step) => {
      return this.saveStep(step);
    });
    */

    // Get steps by tutorial
    // DUPLICATED: This handler is already registered in ProjectService
    // Commented out to avoid duplicate handler registration
    /*
    ipcMain.handle(IpcChannels.GET_STEPS_BY_TUTORIAL, async (_event, tutorialId: string) => {
      return await this.databaseService.getStepsByTutorial(tutorialId);
    });
    */

    // Update step
    // DUPLICATED: This handler is already registered in ProjectService
    // Commented out to avoid duplicate handler registration
    /*
    ipcMain.handle(IpcChannels.UPDATE_STEP, (_event, step: Step) => {
      return this.databaseService.updateStep(step);
    });
    */

    // Delete step
    // DUPLICATED: This handler is already registered in ProjectService
    // Commented out to avoid duplicate handler registration
    /*
    ipcMain.handle(IpcChannels.DELETE_STEP, (_event, stepId: string) => {
      return this.databaseService.deleteStep(stepId);
    });
    */

    // Reorder steps
    // DUPLICATED: This handler is already registered in ProjectService
    // Commented out to avoid duplicate handler registration
    /*
    ipcMain.handle(IpcChannels.REORDER_STEPS, (_event, steps: Pick<Step, 'id' | 'order'>[]) => {
      this.databaseService.updateStepsOrder(steps);
      return true;
    });
    */

    // Get current tutorial
    ipcMain.handle(IpcChannels.GET_CURRENT_TUTORIAL, () => {
      if (!this.currentTutorialId) return null;
      return this.databaseService.getTutorial(this.currentTutorialId);
    });

    // Set current tutorial
    ipcMain.handle(IpcChannels.SET_CURRENT_TUTORIAL, (_event, tutorialId: string) => {
      this.currentTutorialId = tutorialId;
      return this.databaseService.getTutorial(tutorialId);
    });

    // Delete tutorial
    ipcMain.handle(IpcChannels.DELETE_TUTORIAL, async (_event, tutorialId: string) => {
      return await this.deleteTutorial(tutorialId);
    });
  }

  private async createTutorial(title: string, description?: string): Promise<Tutorial> {
    const tutorial: Omit<Tutorial, 'id'> = {
      projectId: this.currentProjectId || '',  // Use current project if available
      title,
      description,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (!tutorial.projectId) {
      throw new Error('Project ID is required to create a tutorial');
    }
    
    const createdTutorial = await this.databaseService.createTutorial(tutorial);
    
    // Set as current tutorial
    if (createdTutorial.id) {
      this.currentTutorialId = createdTutorial.id;
    }
    
    return createdTutorial;
  }

  private async saveStep(step: Step): Promise<Step> {
    if (step.id) {
      return await this.databaseService.updateStep(step);
    } else {
      return await this.databaseService.createStep(step);
    }
  }

  private async deleteTutorial(tutorialId: string): Promise<boolean> {
    // Get all steps to know how many will be deleted
    const steps = await this.databaseService.getStepsByTutorial(tutorialId);
    
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Delete Tutorial',
      message: `Are you sure you want to delete this tutorial?`,
      detail: `This will delete ${steps.length} step(s). This action cannot be undone.`,
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0
    });
    
    if (response !== 1) {
      return false;
    }
    
    // If confirmed, delete from database
    const deleted = await this.databaseService.deleteTutorial(tutorialId);
    
    // Clear current tutorial if it was the deleted one
    if (deleted && this.currentTutorialId === tutorialId) {
      this.currentTutorialId = null;
    }
    
    return deleted;
  }

  public async getCurrentTutorial(): Promise<Tutorial | null> {
    if (!this.currentTutorialId) return null;
    return await this.databaseService.getTutorial(this.currentTutorialId);
  }
}

export default TutorialService; 