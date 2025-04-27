import { /*screen,*/ desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import screenshot from 'screenshot-desktop';
// import { app } from 'electron'; // app is not needed here if dir is passed in

// Export the class directly
export class ScreenshotService {
  private screenshotDir: string;

  // Accept directory path in constructor
  constructor(screenshotDir: string) {
    // Use the provided directory path
    // this.screenshotDir = path.join(app.getPath('userData'), 'screenshots');
    this.screenshotDir = screenshotDir;
    this.ensureScreenshotDir();
  }

  private async ensureScreenshotDir(): Promise<void> {
    try {
      await fs.access(this.screenshotDir);
    } catch {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    }
  }

  // Renamed from captureScreenshot to match RecordingService usage
  public async captureScreen(filepath: string): Promise<void> {
    try {
      // Capture screenshot
      const buffer = await screenshot();
      // Use the full filepath provided by the caller
      await fs.writeFile(filepath, buffer);
      console.log(`Screenshot saved to: ${filepath}`);
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

// Remove the default instance export
// export default new ScreenshotService(); 