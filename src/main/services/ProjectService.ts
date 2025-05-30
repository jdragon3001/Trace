import { dialog, ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcChannels } from '../../shared/constants';
import { DatabaseService, Project, Tutorial, Step } from './DatabaseService';
import { MigrationService } from './MigrationService';
import { ShapeRepository } from '../repositories/ShapeRepository';

export class ProjectService {
  private static instance: ProjectService;
  private databaseService: DatabaseService;
  private migrationService: MigrationService;
  private currentProjectId: string | null = null;
  private currentTutorialId: string | null = null;
  private userDataPath: string;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.migrationService = MigrationService.getInstance();
    this.userDataPath = path.join(app.getPath('userData'), 'openscribe');
    
    // Ensure the projects directory exists
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }
    
    // Register IPC handlers
    this.registerIpcHandlers();
    
    // Try to migrate old data
    this.tryMigrateOldData();
  }

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
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
    // Get all projects
    ipcMain.handle(IpcChannels.GET_PROJECTS, async () => {
      try {
        console.log('[ProjectService] Getting all projects');
        const projects = await this.databaseService.getAllProjects();
        console.log(`[ProjectService] Retrieved ${projects.length} projects`);
        return projects;
      } catch (error: any) {
        console.error(`[ProjectService] Error in GET_PROJECTS handler: ${error.message}`);
        return [];
      }
    });

    // Get recent projects or tutorials
    ipcMain.handle(IpcChannels.GET_RECENT_PROJECTS, async () => {
      try {
        return await this.databaseService.getRecentTutorials(10);
      } catch (error: any) {
        console.error(`[ProjectService] Error in GET_RECENT_PROJECTS handler: ${error.message}`);
        return [];
      }
    });

    // Create new project
    ipcMain.handle(IpcChannels.CREATE_PROJECT, async (_event, projectName: string, description?: string) => {
      try {
        console.log(`[ProjectService] Creating project: "${projectName}"`);
        const project = await this.createProject(projectName, description);
        console.log(`[ProjectService] Project created with ID: ${project.id}`);
        return project;
      } catch (error: any) {
        console.error(`[ProjectService] Error in CREATE_PROJECT handler: ${error.message}`);
        throw error;
      }
    });

    // Create new tutorial
    ipcMain.handle(IpcChannels.CREATE_TUTORIAL, async (_event, projectId: string, title: string) => {
      if (!projectId) {
        throw new Error('Project ID is required to create a tutorial');
      }
      
      const tutorial: Tutorial = {
        projectId,
        title,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      try {
        // Save the tutorial to the database
        const createdTutorial = await this.databaseService.createTutorial(tutorial);
        
        // Set as current tutorial - use non-null assertion since we know it has an ID
        if (createdTutorial && createdTutorial.id) {
          this.currentTutorialId = createdTutorial.id;
        }
        
        return createdTutorial;
      } catch (error) {
        console.error('[ProjectService] Error creating tutorial:', error);
        throw error;
      }
    });

    // Get tutorials by project
    ipcMain.handle(IpcChannels.GET_TUTORIALS_BY_PROJECT, async (_event, projectId: string) => {
      try {
        console.log(`[ProjectService] Getting tutorials for project: ${projectId}`);
        const tutorials = await this.databaseService.getTutorialsByProject(projectId);
        console.log(`[ProjectService] Found ${tutorials.length} tutorials for project ${projectId}`);
        return tutorials;
      } catch (error: any) {
        console.error(`[ProjectService] Error in GET_TUTORIALS_BY_PROJECT handler: ${error.message}`);
        return [];
      }
    });

    // Get a single tutorial
    ipcMain.handle(IpcChannels.GET_TUTORIAL, async (_event, tutorialId: string) => {
      try {
        console.log(`[ProjectService] Getting tutorial with ID: ${tutorialId}`);
        const tutorial = await this.databaseService.getTutorial(tutorialId);
        if (tutorial) {
          console.log(`[ProjectService] Found tutorial: ${tutorial.title}`);
        } else {
          console.log(`[ProjectService] No tutorial found with ID: ${tutorialId}`);
        }
        return tutorial;
      } catch (error: any) {
        console.error(`[ProjectService] Error in GET_TUTORIAL handler: ${error.message}`);
        return null;
      }
    });

    // Save step
    ipcMain.handle(IpcChannels.SAVE_STEP, async (_event, step: Step) => {
      return await this.saveStep(step);
    });

    // Get steps by tutorial
    ipcMain.handle(IpcChannels.GET_STEPS_BY_TUTORIAL, (_event, tutorialId: string) => {
      return this.databaseService.getStepsByTutorial(tutorialId);
    });

    // Update step
    ipcMain.handle(IpcChannels.UPDATE_STEP, (_event, step: Step) => {
      return this.databaseService.updateStep(step);
    });

    // Delete step
    ipcMain.handle(IpcChannels.DELETE_STEP, (_event, stepId: string) => {
      return this.databaseService.deleteStep(stepId);
    });

    // Reorder steps
    ipcMain.handle(IpcChannels.REORDER_STEPS, (_event, steps: Pick<Step, 'id' | 'order'>[]) => {
      this.databaseService.updateStepsOrder(steps);
      return true;
    });

    // Shape data handlers
    ipcMain.handle(IpcChannels.SAVE_SHAPES, async (_event, stepId: string, imagePath: string, shapes: any[]) => {
      try {
        return await this.saveShapesForImage(stepId, imagePath, shapes);
      } catch (error) {
        console.error('[ProjectService] Error in SAVE_SHAPES handler:', error);
        throw error;
      }
    });
    
    ipcMain.handle(IpcChannels.GET_SHAPES_BY_IMAGE, async (_event, imagePath: string, stepId?: string) => {
      try {
        return await this.getShapesByImagePath(imagePath, stepId);
      } catch (error) {
        console.error('[ProjectService] Error in GET_SHAPES_BY_IMAGE handler:', error);
        return [];
      }
    });
    
    ipcMain.handle(IpcChannels.GET_SHAPES_BY_STEP, async (_event, stepId: string) => {
      try {
        return await this.getShapesByStepId(stepId);
      } catch (error) {
        console.error('[ProjectService] Error in GET_SHAPES_BY_STEP handler:', error);
        return [];
      }
    });

    // Get current project and tutorial
    ipcMain.handle(IpcChannels.GET_CURRENT_PROJECT, async () => {
      if (!this.currentProjectId) return null;
      return await this.databaseService.getProject(this.currentProjectId);
    });

    ipcMain.handle(IpcChannels.GET_CURRENT_TUTORIAL, async () => {
      if (!this.currentTutorialId) return null;
      return await this.databaseService.getTutorial(this.currentTutorialId);
    });

    // Set current project and tutorial
    ipcMain.handle(IpcChannels.SET_CURRENT_PROJECT, async (_event, projectId: string) => {
      try {
        console.log(`[ProjectService] Setting current project: ${projectId}`);
        this.currentProjectId = projectId;
        const project = await this.databaseService.getProject(projectId);
        console.log(`[ProjectService] Current project set: ${project?.name || 'unknown'}`);
        return project;
      } catch (error: any) {
        console.error(`[ProjectService] Error setting current project: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle(IpcChannels.SET_CURRENT_TUTORIAL, async (_event, tutorialId: string) => {
      try {
        console.log(`[ProjectService] Setting current tutorial: ${tutorialId}`);
        this.currentTutorialId = tutorialId;
        const tutorial = await this.databaseService.getTutorial(tutorialId);
        console.log(`[ProjectService] Current tutorial set: ${tutorial?.title || 'unknown'}`);
        return tutorial;
      } catch (error: any) {
        console.error(`[ProjectService] Error setting current tutorial: ${error.message}`);
        throw error;
      }
    });

    // Delete project or tutorial
    ipcMain.handle(IpcChannels.DELETE_PROJECT, async (_event, projectId: string) => {
      return await this.deleteProject(projectId);
    });

    ipcMain.handle(IpcChannels.DELETE_TUTORIAL, async (_event, tutorialId: string) => {
      if (!tutorialId) {
        console.error('[ProjectService] DELETE_TUTORIAL received undefined tutorialId');
        return false;
      }
      return await this.deleteTutorial(tutorialId);
    });
  }

  private async createProject(name: string, description?: string): Promise<Project> {
    const project: Project = {
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const createdProject = await this.databaseService.createProject(project);
    if (createdProject.id) {
      this.currentProjectId = createdProject.id;
    }
    
    return createdProject;
  }

  private async createTutorial(projectId: string, title: string): Promise<Tutorial> {
    const tutorial: Omit<Tutorial, "id"> = {
      projectId,
      title,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save tutorial to database
    const createdTutorial = await this.databaseService.createTutorial(tutorial);
    
    // Set current tutorial ID
    if (createdTutorial && createdTutorial.id) {
      this.currentTutorialId = createdTutorial.id;
    }
    
    return createdTutorial;
  }

  private async saveStep(step: Step): Promise<Step> {
    try {
      console.log(`[ProjectService] Saving step for tutorial: ${step.tutorialId}`);

      // Verify this step belongs to a valid tutorial
      if (!step.tutorialId) {
        console.error('[ProjectService] Cannot save step: Missing tutorialId');
        throw new Error('Missing tutorialId when saving step');
      }

      // Validate that we're only saving steps to the current tutorial
      if (this.currentTutorialId && step.tutorialId !== this.currentTutorialId) {
        console.warn(`[ProjectService] Step tutorialId (${step.tutorialId}) doesn't match current tutorial (${this.currentTutorialId})`);
        
        // Override with current tutorial to enforce consistency
        console.log(`[ProjectService] Correcting step.tutorialId to match current tutorial: ${this.currentTutorialId}`);
        step.tutorialId = this.currentTutorialId;
      }

      // Save the step
      if (step.id) {
        console.log(`[ProjectService] Updating existing step ${step.id}`);
        return await this.databaseService.updateStep(step);
      } else {
        console.log(`[ProjectService] Creating new step for tutorial ${step.tutorialId}`);
        return await this.databaseService.createStep(step);
      }
    } catch (error) {
      console.error('[ProjectService] Error in saveStep:', error);
      throw error;
    }
  }

  private async deleteProject(projectId: string): Promise<boolean> {
    // Get all tutorials for this project to clean up screenshots
    const tutorials = await this.databaseService.getTutorialsByProject(projectId);
    
    // Confirmation dialog
    const totalTutorials = tutorials.length;
    let totalSteps = 0;
    
    for (const tutorial of tutorials) {
      if (tutorial.id) {
        const steps = await this.databaseService.getStepsByTutorial(tutorial.id);
        totalSteps += steps.length;
      }
    }
    
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Delete Project',
      message: `Are you sure you want to delete this project?`,
      detail: `This will delete ${totalTutorials} tutorial(s) and ${totalSteps} step(s). This action cannot be undone.`,
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0
    });
    
    if (response !== 1) {
      return false;
    }
    
    // If confirmed, delete from database
    const deleted = await this.databaseService.deleteProject(projectId);
    
    // Clear current project if it was the deleted one
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null;
      this.currentTutorialId = null;
    }
    
    return deleted;
  }

  private async deleteTutorial(tutorialId: string): Promise<boolean> {
    if (!tutorialId) {
      console.error('[ProjectService] Cannot delete tutorial: No tutorial ID provided');
      return false;
    }
    
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
    if (this.currentTutorialId === tutorialId) {
      this.currentTutorialId = null;
    }
    
    return deleted;
  }

  public async getCurrentProject(): Promise<Project | null> {
    if (!this.currentProjectId) return null;
    return await this.databaseService.getProject(this.currentProjectId);
  }

  public async getCurrentTutorial(): Promise<Tutorial | null> {
    if (!this.currentTutorialId) return null;
    return await this.databaseService.getTutorial(this.currentTutorialId);
  }

  // Get current project ID
  public getCurrentProjectId(): string | null {
    return this.currentProjectId || null;
  }
  
  // Get current tutorial ID
  public getCurrentTutorialId(): string | null {
    return this.currentTutorialId || null;
  }

  /**
   * Get the database service instance
   * @returns The DatabaseService instance
   */
  public getDatabaseService(): DatabaseService {
    return this.databaseService;
  }

  /**
   * Save shapes for a specific image
   * @param stepId ID of the step
   * @param imagePath Path to the image
   * @param shapes Array of shape data
   * @returns The saved shapes with IDs
   */
  private async saveShapesForImage(stepId: string, imagePath: string, shapes: any[]): Promise<any[]> {
    try {
      console.log(`[ProjectService] Saving ${shapes.length} shapes for image: ${imagePath}, step: ${stepId}`);
      
      if (!stepId) {
        console.error('[ProjectService] Cannot save shapes: Missing stepId');
        throw new Error('Missing stepId when saving shapes');
      }
      
      if (!imagePath) {
        console.error('[ProjectService] Cannot save shapes: Missing imagePath');
        throw new Error('Missing imagePath when saving shapes');
      }
      
      // Delegate to the database service
      const savedShapes = await this.databaseService.saveShapes(stepId, imagePath, shapes);
      
      console.log(`[ProjectService] Successfully saved ${savedShapes.length} shapes`);
      return savedShapes;
    } catch (error) {
      console.error('[ProjectService] Error saving shapes:', error);
      throw error;
    }
  }
  
  /**
   * Get shapes for a specific image
   * @param imagePath Path to the image
   * @param stepId Optional step ID to filter shapes by
   * @returns Array of shapes for the image
   */
  private async getShapesByImagePath(imagePath: string, stepId?: string): Promise<any[]> {
    try {
      console.log(`[ProjectService] Getting shapes for image: ${imagePath}${stepId ? ` and step: ${stepId}` : ''}`);
      
      if (!imagePath) {
        console.error('[ProjectService] Cannot get shapes: Missing imagePath');
        return [];
      }
      
      // Delegate to the database service
      const shapes = await this.databaseService.getShapesByImage(imagePath, stepId);
      
      console.log(`[ProjectService] Found ${shapes.length} shapes for image: ${imagePath}${stepId ? ` and step: ${stepId}` : ''}`);
      return shapes;
    } catch (error) {
      console.error('[ProjectService] Error getting shapes by image path:', error);
      return [];
    }
  }
  
  /**
   * Get shapes for a specific step
   * @param stepId ID of the step
   * @returns Array of shapes for the step
   */
  private async getShapesByStepId(stepId: string): Promise<any[]> {
    try {
      console.log(`[ProjectService] Getting shapes for step: ${stepId}`);
      
      if (!stepId) {
        console.error('[ProjectService] Cannot get shapes: Missing stepId');
        return [];
      }
      
      // Delegate to the database service
      const shapes = await this.databaseService.getShapesByStep(stepId);
      
      console.log(`[ProjectService] Found ${shapes.length} shapes for step: ${stepId}`);
      return shapes;
    } catch (error) {
      console.error('[ProjectService] Error getting shapes by step ID:', error);
      return [];
    }
  }
}

export default ProjectService; 