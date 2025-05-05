import { DbConnectionManager } from '../services/DbConnectionManager';
import Database from 'better-sqlite3';

/**
 * BaseRepository - Abstract base class for database repositories
 * 
 * Provides common functionality for database operations:
 * - Standardized error handling
 * - Logging
 * - Transaction management
 */
export abstract class BaseRepository {
  protected dbManager: DbConnectionManager;

  constructor() {
    this.dbManager = DbConnectionManager.getInstance();
  }

  /**
   * Execute a database operation with proper error handling
   * @param operation The database operation to perform
   * @param errorMessage Error message to log on failure
   * @returns Result of the operation or null on error
   */
  protected async executeDbOperation<T>(
    operation: (db: Database.Database) => Promise<T> | T,
    errorMessage: string
  ): Promise<T | null> {
    try {
      const db = await this.dbManager.getDatabase();
      return await operation(db);
    } catch (error: any) {
      console.error(`[${this.constructor.name}] ${errorMessage}:`, error);
      return null;
    }
  }

  /**
   * Execute a database operation within a transaction
   * @param operation The database operation to perform
   * @param errorMessage Error message to log on failure
   * @returns Result of the operation or null on error
   */
  protected async executeInTransaction<T>(
    operation: (db: Database.Database) => Promise<T> | T,
    errorMessage: string
  ): Promise<T | null> {
    try {
      return await this.dbManager.runInTransaction(operation);
    } catch (error: any) {
      console.error(`[${this.constructor.name}] ${errorMessage}:`, error);
      return null;
    }
  }

  /**
   * Generate a unique ID for a new entity
   * @returns A unique string ID
   */
  protected generateId(): string {
    return Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Convert a potential JSON string to an object
   * @param jsonString The JSON string to parse
   * @param defaultValue Default value if parsing fails
   * @returns Parsed object or default value
   */
  protected parseJsonField<T>(jsonString: string | null | undefined, defaultValue: T): T {
    if (!jsonString) return defaultValue;
    
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.warn(`[${this.constructor.name}] Failed to parse JSON:`, error);
      return defaultValue;
    }
  }

  /**
   * Safely convert an object to a JSON string
   * @param value Object to stringify
   * @returns JSON string or null
   */
  protected stringifyField(value: any): string | null {
    if (value === undefined || value === null) return null;
    
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn(`[${this.constructor.name}] Failed to stringify value:`, error);
      return null;
    }
  }
} 