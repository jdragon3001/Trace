import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseService, Project, Tutorial, Step } from './DatabaseService';

interface OldProject {
  id: string;
  name: string;
  path: string;
  lastModified: Date;
  steps: OldStep[];
}

interface OldStep {
  id: string;
  number: number;
  timestamp: string;
  screenshotPath: string;
  mousePosition: { x: number; y: number };
  windowTitle: string;
  description: string;
  keyboardShortcut?: string;
}

export class MigrationService {
  private static instance: MigrationService;
  private databaseService: DatabaseService;
  private oldProjectsPath: string;
  private oldProjectsListPath: string;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.oldProjectsPath = path.join(app.getPath('userData'), 'projects');
    this.oldProjectsListPath = path.join(this.oldProjectsPath, 'projects-list.json');
  }

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  public async migrateOldData(): Promise<{ projects: number, tutorials: number, steps: number }> {
    console.log('[MigrationService] Starting migration of old data');
    
    try {
      const dataPath = path.join(this.oldProjectsPath, 'data');
      
      // Check if old data directory exists
      if (!fs.existsSync(dataPath)) {
        console.log('[MigrationService] No old data to migrate');
        return { projects: 0, tutorials: 0, steps: 0 };
      }
      
      // Get project directories
      const projectDirs = fs.readdirSync(dataPath)
        .filter(dir => fs.statSync(path.join(dataPath, dir)).isDirectory());
      
      let projectsCount = 0;
      let tutorialsCount = 0;
      let stepsCount = 0;

      // Begin a transaction for the entire migration
      this.databaseService.beginTransaction();

      try {
        for (const projectDir of projectDirs) {
          try {
            const projectPath = path.join(dataPath, projectDir);
            const projectFilePath = path.join(projectPath, 'project.json');
            
            // Skip if project.json doesn't exist
            if (!fs.existsSync(projectFilePath)) continue;
            
            // Read project data
            const projectData = JSON.parse(fs.readFileSync(projectFilePath, 'utf8'));
            
            // Check if project already exists
            const existingProject = this.databaseService.getProject(projectData.id);
            
            // If project doesn't exist, create it
            if (!existingProject) {
              console.log(`[MigrationService] Migrating project: ${projectData.name}`);
              const project = await this.databaseService.createProject({
                id: projectData.id,
                name: projectData.name,
                description: projectData.description,
                createdAt: projectData.createdAt,
                updatedAt: projectData.updatedAt
              });
              projectsCount++;

              // Migrate tutorials
              const tutorialsDir = path.join(projectPath, 'tutorials');
              if (fs.existsSync(tutorialsDir)) {
                const tutorialFiles = fs.readdirSync(tutorialsDir)
                  .filter(file => file.endsWith('.json'));
                
                for (const tutorialFile of tutorialFiles) {
                  const tutorialPath = path.join(tutorialsDir, tutorialFile);
                  const tutorialData = JSON.parse(fs.readFileSync(tutorialPath, 'utf8'));
                  
                  console.log(`[MigrationService] Migrating tutorial: ${tutorialData.name}`);
                  const tutorial = await this.databaseService.createTutorial({
                    id: tutorialData.id,
                    projectId: project.id,
                    name: tutorialData.name,
                    description: tutorialData.description,
                    createdAt: tutorialData.createdAt,
                    updatedAt: tutorialData.updatedAt
                  });
                  tutorialsCount++;

                  // Migrate steps
                  if (tutorialData.steps && Array.isArray(tutorialData.steps)) {
                    for (const stepData of tutorialData.steps) {
                      // Copy screenshot files if they exist
                      let screenshotPath = stepData.screenshotPath || '';
                      if (screenshotPath) {
                        const oldScreenshotPath = path.join(this.oldProjectsPath, screenshotPath);
                        const newScreenshotPath = path.join(this.oldProjectsPath, path.basename(screenshotPath));
                        
                        if (fs.existsSync(oldScreenshotPath)) {
                          try {
                            fs.copyFileSync(oldScreenshotPath, newScreenshotPath);
                            // Update path to point to the new location
                            screenshotPath = path.basename(screenshotPath);
                          } catch (err: any) {
                            console.error(`[MigrationService] Error copying screenshot: ${err.message}`);
                            // Keep original path if copy fails
                          }
                        }
                      }
                      
                      await this.databaseService.createStep({
                        id: stepData.id,
                        tutorialId: tutorial.id,
                        order: stepData.order,
                        screenshotPath: screenshotPath || null,
                        actionText: stepData.actionText || null,
                        timestamp: stepData.timestamp || new Date().toISOString(),
                        mousePosition: stepData.mousePosition || null,
                        windowTitle: stepData.windowTitle || null,
                        keyboardShortcut: stepData.keyboardShortcut || null
                      });
                      stepsCount++;
                    }
                  }
                }
              }
            } else {
              console.log(`[MigrationService] Project already exists: ${projectData.name}`);
            }
          } catch (err: any) {
            console.error(`[MigrationService] Error migrating project ${projectDir}: ${err.message}`);
            // Continue with next project
          }
        }

        // Commit the transaction if everything was successful
        this.databaseService.commitTransaction();
        console.log(`Migration completed: ${projectsCount} projects, ${tutorialsCount} tutorials, ${stepsCount} steps`);
        
        return { projects: projectsCount, tutorials: tutorialsCount, steps: stepsCount };
      } catch (error) {
        // Rollback on error
        this.databaseService.rollbackTransaction();
        console.error('Error during migration, rolling back:', error);
        throw error;
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  public backupOldProjects(): string | null {
    // Create a backup of the old projects directory
    if (!fs.existsSync(this.oldProjectsPath)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(app.getPath('userData'), `projects-backup-${timestamp}`);
    
    fs.cpSync(this.oldProjectsPath, backupDir, { recursive: true });
    
    return backupDir;
  }
} 