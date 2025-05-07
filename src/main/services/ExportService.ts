import * as fs from 'fs';
import * as path from 'path';
import { app, dialog, ipcMain } from 'electron';
import { Step, Tutorial } from '../../shared/types';
import { ImageService } from './ImageService';
import PDFDocument from 'pdfkit';
import * as docx from 'docx';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, SectionType } from 'docx';
import { IpcChannels } from '../../shared/constants';

// Standard 14 PDF Fonts (Standard font families that don't require embedding)
const STANDARD_FONTS = {
  sans: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique'
  },
  serif: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italic: 'Times-Italic',
    boldItalic: 'Times-BoldItalic'
  },
  mono: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italic: 'Courier-Oblique',
    boldItalic: 'Courier-BoldOblique'
  }
};

export interface ExportOptions {
  docTitle: string;
  includeScreenshots: boolean;
  includeStepNumbers: boolean;
  exportFormat: 'PDF' | 'DOCX';
}

export class ExportService {
  private static instance: ExportService;
  private shapeData: Record<string, Array<any>> = {};

  private constructor() {
    this.registerIpcHandlers();
  }

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  private registerIpcHandlers() {
    // Register IPC handler to receive shape data from renderer
    ipcMain.handle(IpcChannels.EXPORT_PREPARE_SHAPES, (_event, tutorialId: string, shapeDataFromRenderer: Record<string, Array<any>>) => {
      console.log(`[ExportService] Received shape data for tutorial ${tutorialId}`);
      this.shapeData = shapeDataFromRenderer;
      return true;
    });
  }

  /**
   * Apply shapes to an image before export
   * @param imagePath Path to the original image
   * @returns Path to the modified image with shapes applied, or original path if no shapes to apply
   */
  private async applyShapesToImage(imagePath: string): Promise<string> {
    try {
      // Check if we have shape data for this image
      const shapes = this.shapeData[imagePath];
      if (!shapes || shapes.length === 0) {
        console.log(`[ExportService] No shapes to apply for image: ${imagePath}`);
        return imagePath;
      }

      console.log(`[ExportService] Applying ${shapes.length} shapes to image: ${imagePath}`);

      // Generate temp path for the output image
      const tempDir = app.getPath('temp');
      const outputPath = path.join(tempDir, `export_${Date.now()}_${path.basename(imagePath)}`);

      // Convert the image to data URL
      const imageBase64 = await ImageService.imagePathToDataUrl(imagePath);
      if (!imageBase64) {
        console.error(`[ExportService] Failed to convert image to data URL: ${imagePath}`);
        return imagePath;
      }

      // Create a temporary worker window to render the shapes
      const { BrowserWindow } = require('electron');
      const renderWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      // Load a simple HTML file with canvas rendering code
      const renderHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shape Renderer</title>
      </head>
      <body>
        <canvas id="canvas"></canvas>
        <script>
          const { ipcRenderer } = require('electron');
          
          // Listen for render request
          ipcRenderer.on('render-shapes', async (event, { imageDataUrl, shapes }) => {
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            
            // Load the image
            const img = new Image();
            img.onload = () => {
              // Set canvas size to match image
              canvas.width = img.width;
              canvas.height = img.height;
              
              // Draw the image
              ctx.drawImage(img, 0, 0);
              
              // Draw all shapes
              shapes.forEach(shape => {
                drawShape(ctx, shape.type, shape.start, shape.end, shape.color);
              });
              
              // Get the final image data
              const dataUrl = canvas.toDataURL('image/png');
              
              // Send back the result
              ipcRenderer.send('shapes-rendered', { dataUrl });
            };
            
            img.src = imageDataUrl;
          });
          
          // Function to draw shapes
          function drawShape(ctx, type, start, end, color) {
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 3;
            
            switch (type) {
              case 'ellipse':
                const radiusX = Math.abs(end.x - start.x);
                const radiusY = Math.abs(end.y - start.y);
                ctx.beginPath();
                ctx.ellipse(start.x, start.y, radiusX, radiusY, 0, 0, 2 * Math.PI);
                ctx.stroke();
                break;
                
              case 'rectangle':
                const left = Math.min(start.x, end.x);
                const top = Math.min(start.y, end.y);
                const width = Math.abs(end.x - start.x);
                const height = Math.abs(end.y - start.y);
                ctx.beginPath();
                ctx.rect(left, top, width, height);
                ctx.stroke();
                break;
                
              case 'line':
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
                break;
                
              case 'arrow':
                // Draw the line
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
                
                // Draw the arrowhead
                const angle = Math.atan2(end.y - start.y, end.x - start.x);
                const headLength = 15;
                
                ctx.beginPath();
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(
                  end.x - headLength * Math.cos(angle - Math.PI / 6),
                  end.y - headLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                  end.x - headLength * Math.cos(angle + Math.PI / 6),
                  end.y - headLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
                break;
            }
          }
        </script>
      </body>
      </html>
      `;

      // Create a temporary HTML file
      const tempHtmlPath = path.join(tempDir, `render_${Date.now()}.html`);
      fs.writeFileSync(tempHtmlPath, renderHtml);
      
      // Load the HTML file
      await renderWindow.loadFile(tempHtmlPath);
      
      // Return a promise that resolves when the rendering is complete
      return new Promise((resolve, reject) => {
        // Set up IPC listeners
        const { ipcMain } = require('electron');
        
        // Listen for the render result
        const listener = (_event: any, { dataUrl }: { dataUrl: string }) => {
          // Save the data URL to a file
          try {
            // Extract base64 data without header
            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // Write to file
            fs.writeFileSync(outputPath, imageBuffer);
            
            // Clean up
            ipcMain.removeListener('shapes-rendered', listener);
            renderWindow.close();
            fs.unlinkSync(tempHtmlPath);
            
            resolve(outputPath);
          } catch (error) {
            reject(error);
          }
        };
        
        ipcMain.once('shapes-rendered', listener);
        
        // Send the render request
        renderWindow.webContents.send('render-shapes', {
          imageDataUrl: imageBase64,
          shapes
        });
      });
    } catch (error) {
      console.error(`[ExportService] Error applying shapes to image:`, error);
      return imagePath;
    }
  }

  /**
   * Exports a tutorial as a PDF or DOCX file
   * @param tutorial The tutorial to export
   * @param steps The steps of the tutorial
   * @param options Export options
   * @returns Path to the exported file
   */
  public async exportTutorial(
    tutorial: Tutorial,
    steps: Step[],
    options: ExportOptions
  ): Promise<string> {
    try {
      // Ask user where to save the file
      // Use Downloads folder as the default location per user preference
      const defaultPath = path.join(
        app.getPath('downloads'), // Use Downloads folder instead of Documents
        `${tutorial.title || options.docTitle}.${options.exportFormat.toLowerCase()}`
      );

      const saveDialogResult = await dialog.showSaveDialog({
        title: `Export as ${options.exportFormat}`,
        defaultPath,
        filters: [
          { name: options.exportFormat, extensions: [options.exportFormat.toLowerCase()] }
        ],
      });

      if (!saveDialogResult.filePath) {
        throw new Error('Export cancelled by user');
      }

      const filePath = saveDialogResult.filePath;
      
      // Verify the directory exists and is writable
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Export directory does not exist: ${dirPath}`);
      }
      
      // Try to create a test file to verify write permissions
      try {
        const testPath = path.join(dirPath, '.export_test');
        fs.writeFileSync(testPath, 'test');
        fs.unlinkSync(testPath);
      } catch (error) {
        console.error('Cannot write to export directory:', error);
        throw new Error(`Cannot write to the selected directory. Please check permissions for: ${dirPath}`);
      }
      
      // Sort steps by order
      const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

      // If we have any shapes data, apply them to the images
      if (options.includeScreenshots) {
        // Create a copy of steps with shape-rendered images
        for (let i = 0; i < sortedSteps.length; i++) {
          if (sortedSteps[i].screenshotPath) {
            // Apply shapes if any exist
            const processedImagePath = await this.applyShapesToImage(sortedSteps[i].screenshotPath);
            sortedSteps[i] = {
              ...sortedSteps[i],
              screenshotPath: processedImagePath
            };
          }
        }
      }
      
      // Export based on selected format
      if (options.exportFormat === 'PDF') {
        await this.exportAsPDF(filePath, tutorial, sortedSteps, options);
      } else {
        await this.exportAsDOCX(filePath, tutorial, sortedSteps, options);
      }

      return filePath;
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Exports a tutorial as a PDF file
   */
  private async exportAsPDF(
    filePath: string,
    tutorial: Tutorial,
    steps: Step[],
    options: ExportOptions
  ): Promise<void> {
    try {
      console.log('Starting PDF export process...');
      
      // Skip trying the standard PDFKit approach since it's failing
      // and directly use our simplified generator with guaranteed fonts
      const { SimplePdfGenerator } = await import('./SimplePdfGenerator');
      
      console.log('Using SimplePdfGenerator for PDF export');
      
      // Use the simplified generator which avoids font issues
      await SimplePdfGenerator.generate(
        filePath,
        tutorial,
        steps,
        {
          title: options.docTitle || tutorial.title,
          includeImages: options.includeScreenshots,
          includeNumbers: options.includeStepNumbers
        }
      );
      
      console.log('PDF successfully generated using simplified generator');
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error;
    }
  }

  /**
   * Standard PDF export implementation using PDFKit with standard fonts
   * Note: This is currently not used due to font loading issues
   */
  private standardPdfExport(
    filePath: string,
    tutorial: Tutorial,
    steps: Step[],
    options: ExportOptions
  ): Promise<void> {
    // This method is kept for reference but not used currently
    return new Promise<void>((resolve, reject) => {
      // Implementation removed to prevent it from being used
      reject(new Error('Standard PDF export is disabled due to font issues'));
    });
  }

  /**
   * Exports a tutorial as a DOCX file
   */
  private async exportAsDOCX(
    filePath: string,
    tutorial: Tutorial,
    steps: Step[],
    options: ExportOptions
  ): Promise<void> {
    try {
      // Document sections
      const docElements: docx.ISectionOptions[] = [];
      
      // Create content elements
      const children: docx.Paragraph[] = [];
      
      // Add title
      children.push(
        new Paragraph({
          text: options.docTitle || tutorial.title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400, before: 400 },
        })
      );
      
      // Add description if available
      if (tutorial.description) {
        children.push(
          new Paragraph({
            text: tutorial.description,
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          })
        );
      }
      
      // Sort steps by order
      const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
      
      // Add steps - one per page for better readability
      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        
        // Add page break between steps (except before the first step)
        if (i > 0) {
          children.push(
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            })
          );
        }
        
        // Step title with number (if enabled)
        const stepText = options.includeStepNumbers 
          ? `Step ${i + 1}: ${step.actionText}` 
          : step.actionText;
          
        children.push(
          new Paragraph({
            text: stepText,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 300, before: 200 },
          })
        );
        
        // Add screenshot if option is enabled
        if (options.includeScreenshots && step.screenshotPath) {
          try {
            // Check if file exists
            if (fs.existsSync(step.screenshotPath)) {
              // Convert image to base64 for docx processing
              const imageBase64 = await ImageService.imagePathToDataUrl(step.screenshotPath);
              
              if (imageBase64) {
                // Extract base64 data without header
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');
                
                // Add image paragraph with centered alignment
                // Use smaller dimensions for better readability
                children.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: imageBuffer,
                        transformation: {
                          width: 450,
                          height: 250,
                        },
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                  })
                );
              }
            }
          } catch (imgError) {
            console.error(`Error adding image for step ${i + 1}:`, imgError);
            
            // Add error message instead
            children.push(
              new Paragraph({
                text: "[Error: Screenshot could not be loaded]",
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 },
              })
            );
          }
        }
      }
      
      // Create the document
      const doc = new Document({
        sections: [{
          properties: {
            type: SectionType.CONTINUOUS,
          },
          children: children,
        }],
      });
      
      // Generate and save the document
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);
    } catch (error) {
      console.error('DOCX export failed:', error);
      throw error;
    }
  }
}

export default ExportService; 