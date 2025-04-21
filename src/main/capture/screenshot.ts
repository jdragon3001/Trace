import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs/promises';

// Ensure screenshots directory exists
const screenshotsDir = path.join(app.getPath('userData'), 'screenshots');

async function ensureScreenshotsDirExists() {
  try {
    await fs.access(screenshotsDir);
  } catch {
    await fs.mkdir(screenshotsDir, { recursive: true });
  }
}

export async function captureScreen(): Promise<string> {
  await ensureScreenshotsDirExists();

  // Capture screenshot
  const buffer = await screenshot();
  
  // Generate unique filename
  const filename = `screenshot_${Date.now()}.png`;
  const filepath = path.join(screenshotsDir, filename);

  // Process with sharp (add circle later)
  await sharp(buffer)
    .png()
    .toFile(filepath);

  return filepath;
}

export async function addCircleToScreenshot(
  screenshotPath: string,
  x: number,
  y: number,
  stepNumber: number
): Promise<string> {
  const image = sharp(screenshotPath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not get image dimensions');
  }

  // Create SVG circle with number
  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <circle
        cx="${x}"
        cy="${y}"
        r="12"
        fill="red"
        fill-opacity="0.7"
      />
      <text
        x="${x}"
        y="${y + 5}"
        font-family="Arial"
        font-size="16"
        fill="white"
        text-anchor="middle"
      >${stepNumber}</text>
    </svg>
  `;

  // Composite the circle onto the screenshot
  const outputPath = screenshotPath.replace('.png', '_annotated.png');
  await image
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .toFile(outputPath);

  return outputPath;
} 