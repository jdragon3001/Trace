import { ProjectService } from './services/ProjectService';
import { DatabaseService } from './services/DatabaseService';
import { MigrationService } from './services/MigrationService';
import { DataMigrationService } from './services/DataMigrationService';
import { app, dialog } from 'electron';

// Run our SQLite test first
console.log('Running SQLite diagnostics...');
require('./test-sqlite');

// Initialize services when app is ready
app.whenReady().then(async () => {
  try {
    // Initialize database
    console.log('Initializing DatabaseService...');
    const dbService = DatabaseService.getInstance();
    await dbService.ensureInitialized();
    console.log('DatabaseService initialized successfully!');
    
    // Initialize other services
    console.log('Initializing ProjectService...');
    ProjectService.getInstance();
    console.log('ProjectService initialized successfully!');
    
    // MigrationService is initialized by ProjectService
    
    // Check if data migration is needed
    const migrationService = DataMigrationService.getInstance();
    const migrationNeeded = await migrationService.isMigrationNeeded();
    
    if (migrationNeeded) {
      console.log('Data migration needed, starting migration...');
      const success = await migrationService.migrateData();
      if (success) {
        console.log('Data migration completed successfully');
      } else {
        console.error('Data migration failed');
      }
    }
    
    // Continue with application startup
    // Create the main window and set up other app initialization
    
  } catch (error) {
    console.error('Failed to initialize services:', error);
    
    // Show an error dialog when running in a packaged app
    if (!app.isPackaged) {
      console.error('Database initialization error. Check the console logs for details.');
    } else {
      dialog.showErrorBox(
        'Database Error',
        `Failed to initialize the database: ${error instanceof Error ? error.message : String(error)}\n\nThe application may not function properly.`
      );
    }
  }
}); 