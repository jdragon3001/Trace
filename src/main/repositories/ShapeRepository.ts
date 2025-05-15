import { BaseRepository } from './BaseRepository';
import { ShapeData } from '../../shared/types';
import Database from 'better-sqlite3';

/**
 * ShapeRepository - Handles all database operations for Shape data
 */
export class ShapeRepository extends BaseRepository {
  private static instance: ShapeRepository;

  private constructor() {
    super();
  }

  public static getInstance(): ShapeRepository {
    if (!ShapeRepository.instance) {
      ShapeRepository.instance = new ShapeRepository();
    }
    return ShapeRepository.instance;
  }

  /**
   * Save multiple shapes for a step/image
   * @param shapes Array of shape data to save
   * @returns Array of saved shapes with IDs
   */
  public async saveShapes(shapes: ShapeData[]): Promise<ShapeData[]> {
    if (!shapes.length) return [];

    console.log(`[ShapeRepository] Save shapes called with ${shapes.length} shapes`);
    if (shapes.length > 0) {
      console.log(`[ShapeRepository] First shape data:`, JSON.stringify(shapes[0]));
    }

    // Check for missing required fields in any shape
    const missingStepIds = shapes.filter(shape => !shape.stepId);
    if (missingStepIds.length > 0) {
      console.error(`[ShapeRepository] ${missingStepIds.length} shapes missing stepId!`);
      console.error(`[ShapeRepository] Example shape without stepId:`, JSON.stringify(missingStepIds[0]));
    }

    const missingImagePaths = shapes.filter(shape => !shape.imagePath);
    if (missingImagePaths.length > 0) {
      console.error(`[ShapeRepository] ${missingImagePaths.length} shapes missing imagePath!`);
      console.error(`[ShapeRepository] Example shape without imagePath:`, JSON.stringify(missingImagePaths[0]));
    }

    // Log shape types for debugging
    const shapeTypes = shapes.map(s => s.type);
    console.log(`[ShapeRepository] Shape types in this batch: ${JSON.stringify(shapeTypes)}`);

    const result = await this.executeInTransaction(async (db) => {
      console.log(`[ShapeRepository] Saving ${shapes.length} shapes for image`);
      
      // First delete existing shapes for the same image/step
      if (shapes[0]?.imagePath) {
        console.log(`[ShapeRepository] Deleting existing shapes for image: ${shapes[0].imagePath}`);
        try {
          const countBefore = db.prepare(`SELECT COUNT(*) as count FROM shapes WHERE imagePath = ?`).get(shapes[0].imagePath) as { count: number };
          console.log(`[ShapeRepository] Found ${countBefore.count} existing shapes before deletion`);
          
          const deleteStmt = db.prepare(`DELETE FROM shapes WHERE imagePath = ?`);
          const deleteResult = deleteStmt.run(shapes[0].imagePath);
          console.log(`[ShapeRepository] Deleted ${deleteResult.changes} existing shapes`);
          
          // Verify shapes were deleted
          const countAfter = db.prepare(`SELECT COUNT(*) as count FROM shapes WHERE imagePath = ?`).get(shapes[0].imagePath) as { count: number };
          console.log(`[ShapeRepository] Found ${countAfter.count} existing shapes after deletion (should be 0)`);
        } catch (error) {
          console.error(`[ShapeRepository] Error during shape deletion:`, error);
        }
      }
      
      // Verify the shapes table exists
      try {
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shapes'").get();
        if (!tableExists) {
          console.error(`[ShapeRepository] CRITICAL ERROR: shapes table does not exist!`);
          // Try to create the table if it doesn't exist
          db.exec(`
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
            )
          `);
          console.log(`[ShapeRepository] Created shapes table`);
          return [];
        }
        console.log(`[ShapeRepository] Verified shapes table exists`);
      } catch (error) {
        console.error(`[ShapeRepository] Error checking if shapes table exists:`, error);
      }
      
      // Temporarily disable foreign key constraints for this transaction
      try {
        db.pragma('foreign_keys = OFF');
        console.log(`[ShapeRepository] Temporarily disabled foreign key constraints for shape save`);
      } catch (error) {
        console.error(`[ShapeRepository] Error disabling foreign keys:`, error);
      }
      
      const insertStmt = db.prepare(`
        INSERT INTO shapes (
          id, stepId, imagePath, type, startX, startY, endX, endY, color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const savedShapes: ShapeData[] = [];
      let insertErrors = 0;
      
      for (const shape of shapes) {
        const id = shape.id || this.generateId();
        
        // Validate required fields
        if (!shape.stepId) {
          console.error('[ShapeRepository] Missing stepId for shape:', shape);
          insertErrors++;
          continue; // Skip this shape
        }
        
        if (!shape.imagePath) {
          console.error('[ShapeRepository] Missing imagePath for shape:', shape);
          insertErrors++;
          continue; // Skip this shape
        }
        
        // Insert or replace the shape
        try {
          console.log(`[ShapeRepository] Inserting shape: ${id}, type: ${shape.type}, color: ${shape.color}`);
          console.log(`[ShapeRepository] Shape coordinates: start(${shape.start.x}, ${shape.start.y}), end(${shape.end.x}, ${shape.end.y})`);
          
          insertStmt.run(
            id,
            shape.stepId,
            shape.imagePath,
            shape.type,
            shape.start.x,
            shape.start.y,
            shape.end.x,
            shape.end.y,
            shape.color
          );
          
          // Add to result with ID
          savedShapes.push({
            ...shape,
            id
          });
        } catch (error) {
          console.error(`[ShapeRepository] Error saving shape:`, error);
          insertErrors++;
        }
      }
      
      // Re-enable foreign key constraints
      try {
        db.pragma('foreign_keys = ON');
        console.log(`[ShapeRepository] Re-enabled foreign key constraints after shape save`);
      } catch (error) {
        console.error(`[ShapeRepository] Error re-enabling foreign keys:`, error);
      }
   
      console.log(`[ShapeRepository] Successfully saved ${savedShapes.length} shapes with ${insertErrors} errors`);
      if (savedShapes.length > 0) {
        console.log(`[ShapeRepository] First saved shape:`, JSON.stringify(savedShapes[0]));
      }
      
      // Verify shapes were saved to database
      if (shapes[0]?.imagePath) {
        const verifyCount = db.prepare(`SELECT COUNT(*) as count FROM shapes WHERE imagePath = ?`).get(shapes[0].imagePath) as { count: number };
        console.log(`[ShapeRepository] Verification: found ${verifyCount.count} shapes in database after save (should be ${savedShapes.length})`);
        
        // Additional verification - retrieve first shape to confirm it was properly inserted
        if (verifyCount.count > 0 && shapes[0]?.id) {
          const verifyShape = db.prepare(`SELECT * FROM shapes WHERE id = ?`).get(savedShapes[0].id);
          console.log(`[ShapeRepository] Verification: retrieved first shape:`, JSON.stringify(verifyShape));
        } else if (verifyCount.count === 0) {
          console.error(`[ShapeRepository] CRITICAL: No shapes found in database after save!`);
          
          // Check if direct INSERT works without using prepare
          try {
            console.log(`[ShapeRepository] Attempting direct INSERT as fallback...`);
            if (savedShapes.length > 0) {
              const shape = savedShapes[0];
              // Try a direct insertion approach as a last resort
              db.exec(`
                INSERT INTO shapes (id, stepId, imagePath, type, startX, startY, endX, endY, color)
                VALUES ('${shape.id}', '${shape.stepId}', '${shape.imagePath}', '${shape.type}', 
                ${shape.start.x}, ${shape.start.y}, ${shape.end.x}, ${shape.end.y}, '${shape.color}')
              `);
              console.log(`[ShapeRepository] Fallback direct INSERT attempted`);
              
              // Verify fallback INSERT worked
              const verifyFallback = db.prepare(`SELECT COUNT(*) as count FROM shapes WHERE id = ?`).get(shape.id) as { count: number };
              console.log(`[ShapeRepository] Fallback verification: ${verifyFallback.count} shapes found`);
            }
          } catch (fallbackError) {
            console.error(`[ShapeRepository] Fallback INSERT failed:`, fallbackError);
          }
          
          // Check all database tables for debugging
          try {
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
            console.log(`[ShapeRepository] Database tables:`, tables.map(t => t.name).join(', '));
            
            // Check if the shapes table structure is correct
            try {
              const tableInfo = db.prepare("PRAGMA table_info(shapes)").all();
              console.log(`[ShapeRepository] Shapes table structure:`, JSON.stringify(tableInfo));
            } catch (error) {
              console.error(`[ShapeRepository] Error getting table info:`, error);
            }
          } catch (error) {
            console.error(`[ShapeRepository] Error listing tables:`, error);
          }
        }
      }
      
      return savedShapes;
    }, 'Error saving shapes');
    
    // Return an empty array as fallback if the transaction didn't return shapes
    return result || [];
  }

  /**
   * Get all shapes for a specific image path
   * @param imagePath Path to the image
   * @param stepId Optional step ID to filter by. If provided, only shapes for that step will be returned
   * @returns Array of shapes or empty array if none found
   */
  public async getShapesByImagePath(imagePath: string, stepId?: string): Promise<ShapeData[]> {
    const result = await this.executeDbOperation(async (db) => {
      if (stepId) {
        console.log(`[ShapeRepository] Getting shapes for image: ${imagePath} and step: ${stepId}`);
        
        // If stepId is provided, filter by both imagePath and stepId
        const stmt = db.prepare(`
          SELECT * FROM shapes WHERE imagePath = ? AND stepId = ?
        `);
        
        const results = stmt.all(imagePath, stepId) as any[];
        
        if (!Array.isArray(results)) {
          console.warn('[ShapeRepository] getShapesByImagePath returned non-array result');
          return [];
        }
        
        console.log(`[ShapeRepository] Found ${results.length} raw results for image: ${imagePath} and step: ${stepId}`);
        if (results.length > 0) {
          console.log(`[ShapeRepository] First shape data:`, JSON.stringify(results[0]));
        }
        
        const shapes = results.map(row => ({
          id: row.id,
          stepId: row.stepId,
          imagePath: row.imagePath,
          type: row.type as 'ellipse' | 'arrow' | 'line' | 'rectangle',
          start: { x: row.startX, y: row.startY },
          end: { x: row.endX, y: row.endY },
          color: row.color
        }));
        
        console.log(`[ShapeRepository] Found ${shapes.length} shapes for image: ${imagePath} and step: ${stepId}`);
        if (shapes.length > 0) {
          console.log(`[ShapeRepository] First converted shape:`, JSON.stringify(shapes[0]));
        }
        
        return shapes;
      } else {
        console.log(`[ShapeRepository] Getting shapes for image: ${imagePath} (all steps)`);
        
        // If stepId is not provided, just filter by imagePath (legacy behavior)
        const stmt = db.prepare(`
          SELECT * FROM shapes WHERE imagePath = ?
        `);
        
        const results = stmt.all(imagePath) as any[];
        
        if (!Array.isArray(results)) {
          console.warn('[ShapeRepository] getShapesByImagePath returned non-array result');
          return [];
        }
        
        console.log(`[ShapeRepository] Found ${results.length} raw results for image: ${imagePath}`);
        if (results.length > 0) {
          console.warn(`[ShapeRepository] WARNING: Returning ALL shapes for image regardless of step!`);
          console.log(`[ShapeRepository] First shape data:`, JSON.stringify(results[0]));
        }
        
        const shapes = results.map(row => ({
          id: row.id,
          stepId: row.stepId,
          imagePath: row.imagePath,
          type: row.type as 'ellipse' | 'arrow' | 'line' | 'rectangle',
          start: { x: row.startX, y: row.startY },
          end: { x: row.endX, y: row.endY },
          color: row.color
        }));
        
        console.log(`[ShapeRepository] Found ${shapes.length} shapes for image: ${imagePath}`);
        if (shapes.length > 0) {
          console.log(`[ShapeRepository] First converted shape:`, JSON.stringify(shapes[0]));
        }
        
        return shapes;
      }
    }, `Error fetching shapes for image ${imagePath}`);
    
    return result || [];
  }

  /**
   * Get all shapes for a specific step
   * @param stepId ID of the step
   * @returns Array of shapes or empty array if none found
   */
  public async getShapesByStepId(stepId: string): Promise<ShapeData[]> {
    const result = await this.executeDbOperation(async (db) => {
      console.log(`[ShapeRepository] Getting shapes for step: ${stepId}`);
      
      const stmt = db.prepare(`
        SELECT * FROM shapes WHERE stepId = ?
      `);
      
      const results = stmt.all(stepId) as any[];
      
      if (!Array.isArray(results)) {
        console.warn('[ShapeRepository] getShapesByStepId returned non-array result');
        return [];
      }
      
      const shapes = results.map(row => ({
        id: row.id,
        stepId: row.stepId,
        imagePath: row.imagePath,
        type: row.type as 'ellipse' | 'arrow' | 'line' | 'rectangle',
        start: { x: row.startX, y: row.startY },
        end: { x: row.endX, y: row.endY },
        color: row.color
      }));
      
      console.log(`[ShapeRepository] Found ${shapes.length} shapes for step: ${stepId}`);
      return shapes;
    }, `Error fetching shapes for step ${stepId}`);
    
    return result || [];
  }

  /**
   * Delete all shapes for a specific image path
   * @param imagePath Path to the image
   * @returns true if successful, false otherwise
   */
  public async deleteShapesByImagePath(imagePath: string): Promise<boolean> {
    const result = await this.executeInTransaction(async (db) => {
      console.log(`[ShapeRepository] Deleting shapes for image: ${imagePath}`);
      
      const stmt = db.prepare(`
        DELETE FROM shapes WHERE imagePath = ?
      `);
      
      const result = stmt.run(imagePath);
      
      console.log(`[ShapeRepository] Deleted ${result.changes} shapes for image: ${imagePath}`);
      return result.changes > 0;
    }, `Error deleting shapes for image ${imagePath}`);
    
    return result === true;
  }

  /**
   * Delete all shapes for a specific step
   * @param stepId ID of the step
   * @returns true if successful, false otherwise
   */
  public async deleteShapesByStepId(stepId: string): Promise<boolean> {
    const result = await this.executeInTransaction(async (db) => {
      console.log(`[ShapeRepository] Deleting shapes for step: ${stepId}`);
      
      const stmt = db.prepare(`
        DELETE FROM shapes WHERE stepId = ?
      `);
      
      const result = stmt.run(stepId);
      
      console.log(`[ShapeRepository] Deleted ${result.changes} shapes for step: ${stepId}`);
      return result.changes > 0;
    }, `Error deleting shapes for step ${stepId}`);
    
    return result === true;
  }
} 