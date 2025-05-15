import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { MousePosition } from '../../shared/types';
import { app } from 'electron';

export class ImageService {
  private readonly CIRCLE_SIZE = 24; // pixels
  private readonly CIRCLE_COLOR = { r: 255, g: 0, b: 0, alpha: 1 }; // Red
  private readonly TEXT_COLOR = { r: 255, g: 255, b: 255, alpha: 1 }; // White

  constructor(private tempDir: string) {}

  /**
   * Draw a circle directly on the image
   * Note: This still uses the old method for backward compatibility
   * Consider using saveClickMarkerData for new code which makes markers editable
   */
  public async drawCircle(
    imagePath: string,
    position: MousePosition,
    stepNumber: number
  ): Promise<void> {
    try {
      const imageBuffer = await fs.promises.readFile(imagePath);
      const image = sharp(imageBuffer);

      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image metadata');
      }

      // Create SVG circle with number
      const svg = this.createCircleSvg(stepNumber);

      // Calculate position ensuring circle stays within bounds
      const x = Math.min(Math.max(position.x - this.CIRCLE_SIZE / 2, 0), metadata.width - this.CIRCLE_SIZE);
      const y = Math.min(Math.max(position.y - this.CIRCLE_SIZE / 2, 0), metadata.height - this.CIRCLE_SIZE);

      // Composite the circle onto the image
      const modifiedImageBuffer = await image
        .composite([
          {
            input: Buffer.from(svg),
            top: Math.round(y),
            left: Math.round(x)
          }
        ])
        .toBuffer();

      // Write the modified buffer back to the original file path
      await fs.promises.writeFile(imagePath, modifiedImageBuffer);
      
      // Also save the click marker data for use with markup tool
      await this.saveClickMarkerData(imagePath, position, stepNumber);
    } catch (error) {
      console.error('Failed to draw circle:', error);
      throw new Error('Failed to draw circle on image');
    }
  }

  /**
   * Save click marker data associated with an image for use with the markup tool
   * This allows click markers to be edited with the markup tool
   */
  public async saveClickMarkerData(
    imagePath: string,
    position: MousePosition,
    stepNumber: number
  ): Promise<void> {
    try {
      const radius = this.CIRCLE_SIZE / 2;
      const metadata = await sharp(await fs.promises.readFile(imagePath)).metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image metadata');
      }
      
      // Create a shape in format compatible with markup tool
      const shape = {
        id: `click_marker_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'ellipse',
        start: position, // Center position
        end: { 
          x: position.x + radius, 
          y: position.y + radius 
        },
        color: `rgba(${this.CIRCLE_COLOR.r}, ${this.CIRCLE_COLOR.g}, ${this.CIRCLE_COLOR.b}, ${this.CIRCLE_COLOR.alpha})`,
        stepNumber: stepNumber // Add step number as metadata
      };
      
      // Create data filename by appending .shapes.json to image path
      const dataFilePath = `${imagePath}.shapes.json`;
      
      // Save shapes data to file
      let shapes = [];
      if (fs.existsSync(dataFilePath)) {
        // If file exists, read existing shapes
        try {
          const existingData = await fs.promises.readFile(dataFilePath, 'utf8');
          shapes = JSON.parse(existingData);
        } catch (parseError) {
          console.error('Failed to parse existing shapes data:', parseError);
          // Continue with empty shapes array if parsing failed
        }
      }
      
      // Add the new shape and write back to file
      shapes.push(shape);
      await fs.promises.writeFile(dataFilePath, JSON.stringify(shapes, null, 2));
      console.log(`Click marker data saved to ${dataFilePath}`);
    } catch (error) {
      console.error('Failed to save click marker data:', error);
      throw new Error('Failed to save click marker data');
    }
  }

  private createCircleSvg(stepNumber: number): string {
    const size = this.CIRCLE_SIZE;
    const radius = size / 2;
    const fontSize = size / 2;

    return `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle
          cx="${radius}"
          cy="${radius}"
          r="${radius - 1}"
          fill="rgba(${this.CIRCLE_COLOR.r}, ${this.CIRCLE_COLOR.g}, ${this.CIRCLE_COLOR.b}, ${this.CIRCLE_COLOR.alpha})"
        />
        <text
          x="50%"
          y="50%"
          font-family="Arial"
          font-size="${fontSize}px"
          fill="rgba(${this.TEXT_COLOR.r}, ${this.TEXT_COLOR.g}, ${this.TEXT_COLOR.b}, ${this.TEXT_COLOR.alpha})"
          text-anchor="middle"
          dominant-baseline="central"
        >${stepNumber}</text>
      </svg>
    `;
  }
  
  /**
   * Draw an editable click marker instead of embedding it in the image
   * This creates a circle that can be edited with the markup tool
   */
  public async createEditableClickMarker(
    imagePath: string,
    position: MousePosition,
    stepNumber: number
  ): Promise<void> {
    try {
      // Save the click marker data without modifying the image
      await this.saveClickMarkerData(imagePath, position, stepNumber);
    } catch (error) {
      console.error('Failed to create editable click marker:', error);
      throw new Error('Failed to create editable click marker');
    }
  }

  /**
   * Converts an image file to a data URL
   * @param imagePath Path to the image file
   * @returns Promise resolving to the data URL or null if conversion fails
   */
  public static async imagePathToDataUrl(imagePath: string): Promise<string | null> {
    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.error(`[ImageService] Image file not found: ${imagePath}`);
        return null;
      }

      // Read the file
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Determine mime type based on file extension
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/png'; // Default
      
      if (ext === '.jpg' || ext === '.jpeg') {
        mimeType = 'image/jpeg';
      } else if (ext === '.gif') {
        mimeType = 'image/gif';
      } else if (ext === '.bmp') {
        mimeType = 'image/bmp';
      } else if (ext === '.webp') {
        mimeType = 'image/webp';
      }
      
      // Convert to base64 and create data URL
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      return dataUrl;
    } catch (error) {
      console.error(`[ImageService] Error converting image to data URL:`, error);
      return null;
    }
  }

  /**
   * Copies an image file to the appropriate tutorial directory and returns the new path
   * @param options Options for copying the image
   * @returns The path to the copied image file
   */
  public static async copyImageFile(options: {
    sourcePath: string;
    tutorialId: string;
    stepId: string;
    makeBackup?: boolean;
  }): Promise<string> {
    try {
      const { sourcePath, tutorialId, stepId, makeBackup = false } = options;
      
      console.log(`[ImageService] Copying image file from ${sourcePath} for step ${stepId}`);
      
      // Ensure source file exists
      if (!fs.existsSync(sourcePath)) {
        console.error(`[ImageService] Source file does not exist: ${sourcePath}`);
        return '';
      }
      
      // Verify source file is readable
      try {
        const fileStats = fs.statSync(sourcePath);
        console.log(`[ImageService] Source file exists (size: ${fileStats.size} bytes)`);
        
        // Read a small portion to verify it's readable
        const testBuffer = Buffer.alloc(10);
        const fd = fs.openSync(sourcePath, 'r');
        fs.readSync(fd, testBuffer, 0, 10, 0);
        fs.closeSync(fd);
      } catch (fileError) {
        console.error(`[ImageService] Cannot read source file:`, fileError);
        return '';
      }
      
      // Create directory for tutorial images if it doesn't exist
      try {
        const tutorialDir = path.join(app.getPath('userData'), 'tutorials', tutorialId, 'images');
        console.log(`[ImageService] Ensuring tutorial directory exists: ${tutorialDir}`);
        
        if (!fs.existsSync(tutorialDir)) {
          fs.mkdirSync(tutorialDir, { recursive: true });
          console.log(`[ImageService] Created tutorial directory: ${tutorialDir}`);
        }
        
        // Determine file extension
        const ext = path.extname(sourcePath).toLowerCase() || '.png';
        
        // Generate target filename
        const targetFilename = `step_${stepId}${ext}`;
        const targetPath = path.join(tutorialDir, targetFilename);
        console.log(`[ImageService] Target file path: ${targetPath}`);
        
        // Backup existing file if needed
        if (makeBackup && fs.existsSync(targetPath)) {
          const backupPath = path.join(tutorialDir, `${targetFilename}.backup-${Date.now()}`);
          console.log(`[ImageService] Creating backup at: ${backupPath}`);
          fs.copyFileSync(targetPath, backupPath);
        }
        
        // Copy the file
        console.log(`[ImageService] Copying file from ${sourcePath} to ${targetPath}`);
        fs.copyFileSync(sourcePath, targetPath);
        
        // Verify the copy was successful
        if (fs.existsSync(targetPath)) {
          const targetStats = fs.statSync(targetPath);
          console.log(`[ImageService] File copied successfully (size: ${targetStats.size} bytes)`);
          return targetPath;
        } else {
          console.error(`[ImageService] File copy failed: Target file doesn't exist`);
          return '';
        }
      } catch (dirError) {
        console.error(`[ImageService] Error creating directory or copying file:`, dirError);
        
        // Try using the temp directory as a fallback
        try {
          const tempDir = this.getTempDir();
          const ext = path.extname(sourcePath).toLowerCase() || '.png';
          const fallbackFilename = `emergency_step_${stepId}${ext}`;
          const fallbackPath = path.join(tempDir, fallbackFilename);
          
          console.log(`[ImageService] Using fallback location: ${fallbackPath}`);
          fs.copyFileSync(sourcePath, fallbackPath);
          
          return fallbackPath;
        } catch (fallbackError) {
          console.error(`[ImageService] Fallback copy also failed:`, fallbackError);
          return '';
        }
      }
    } catch (error) {
      console.error('[ImageService] Error copying image file:', error);
      return '';
    }
  }

  /**
   * Gets a valid temporary directory path with fallbacks
   * @returns A valid temporary directory path
   */
  private static getTempDir(): string {
    try {
      // Try to use Electron's app.getPath('temp')
      const tempDir = path.join(app.getPath('temp'), 'openscribe');
      console.log(`[ImageService] Using temp directory: ${tempDir}`);
      return tempDir;
    } catch (error) {
      console.error('[ImageService] Error getting temp directory from app:', error);
      
      // Fallback 1: Try OS temp dir environment variable
      try {
        const osTempDir = process.env.TEMP || process.env.TMP || '/tmp';
        const tempDir = path.join(osTempDir, 'openscribe');
        console.log(`[ImageService] Using fallback temp directory: ${tempDir}`);
        return tempDir;
      } catch (fallbackError) {
        console.error('[ImageService] Error using fallback temp directory:', fallbackError);
        
        // Fallback 2: Use userData directory (will always be writable)
        const userDataDir = path.join(app.getPath('userData'), 'temp');
        console.log(`[ImageService] Using userData temp directory: ${userDataDir}`);
        return userDataDir;
      }
    }
  }

  /**
   * Saves a data URL to a temporary file and returns the file path
   * @param options Options containing the data URL and file type
   * @returns The path to the saved temporary file
   */
  public static async saveDataUrlToTempFile(options: {
    dataUrl: string;
    fileType: string;
  }): Promise<string> {
    try {
      const { dataUrl, fileType } = options;
      
      console.log(`[ImageService] Saving data URL to temp file (type: ${fileType})`);
      
      if (!dataUrl || typeof dataUrl !== 'string') {
        console.error('[ImageService] Invalid data URL provided:', typeof dataUrl);
        return '';
      }
      
      if (!dataUrl.startsWith('data:image/')) {
        console.error('[ImageService] Data URL does not have expected format:', dataUrl.substring(0, 30) + '...');
        return '';
      }
      
      // Extract the base64 data from the data URL
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      
      if (!base64Data || base64Data.length < 100) {
        console.error('[ImageService] Extracted base64 data is too short or invalid:', base64Data.substring(0, 30) + '...');
        return '';
      }
      
      console.log(`[ImageService] Base64 data extracted (length: ${base64Data.length} chars)`);
      
      // Create buffer from base64
      const buffer = Buffer.from(base64Data, 'base64');
      
      if (!buffer || buffer.length === 0) {
        console.error('[ImageService] Failed to create buffer from base64 data');
        return '';
      }
      
      console.log(`[ImageService] Buffer created (size: ${buffer.length} bytes)`);
      
      // Create a unique filename
      const tempDir = this.getTempDir();
      if (!fs.existsSync(tempDir)) {
        console.log(`[ImageService] Creating temp directory: ${tempDir}`);
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10);
      const filename = `markup_${timestamp}_${randomString}.${fileType}`;
      const filePath = path.join(tempDir, filename);
      
      console.log(`[ImageService] Writing buffer to file: ${filePath}`);
      
      // Write the buffer to a file
      fs.writeFileSync(filePath, buffer);
      
      // Verify the file was created
      if (!fs.existsSync(filePath)) {
        console.error(`[ImageService] File was not created at: ${filePath}`);
        return '';
      }
      
      const fileStats = fs.statSync(filePath);
      console.log(`[ImageService] File created successfully (size: ${fileStats.size} bytes): ${filePath}`);
      
      return filePath;
    } catch (error) {
      console.error('[ImageService] Error saving data URL to temp file:', error);
      return '';
    }
  }
}

export default new ImageService(process.env.TEMP_DIR || ''); 