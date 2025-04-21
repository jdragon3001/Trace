import { screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import screenshot from 'screenshot-desktop';
import { app } from 'electron';

class ScreenshotService {
  private screenshotDir: string;

  constructor() {
    this.screenshotDir = path.join(app.getPath('userData'), 'screenshots');
    this.ensureScreenshotDir();
  }

  private async ensureScreenshotDir(): Promise<void> {
    try {
      await fs.access(this.screenshotDir);
    } catch {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    }
  }

  public async captureScreenshot(): Promise<string> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `screenshot_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      // Capture screenshot
      const buffer = await screenshot();
      await fs.writeFile(filepath, buffer);

      return filepath;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw new Error('Screenshot capture failed');
    }
  }

  public async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.screenshotDir);
      const deletePromises = files.map(file => 
        fs.unlink(path.join(this.screenshotDir, file))
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to cleanup screenshots:', error);
    }
  }
}

export default new ScreenshotService(); 