import sharp from 'sharp';
import { MousePosition } from '../../shared/types';

class ImageService {
  private readonly CIRCLE_SIZE = 24; // pixels
  private readonly CIRCLE_COLOR = { r: 255, g: 0, b: 0, alpha: 1 }; // Red
  private readonly TEXT_COLOR = { r: 255, g: 255, b: 255, alpha: 1 }; // White

  public async drawCircle(
    imagePath: string,
    position: MousePosition,
    stepNumber: number
  ): Promise<void> {
    try {
      const fs = require('fs').promises;
      const imageBuffer = await fs.readFile(imagePath);
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
      await fs.writeFile(imagePath, modifiedImageBuffer);
    } catch (error) {
      console.error('Failed to draw circle:', error);
      throw new Error('Failed to draw circle on image');
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
}

export default new ImageService(); 