import * as fs from 'fs';
import * as path from 'path';
import { app, dialog, ipcMain } from 'electron';
import { Step, Tutorial } from '../../shared/types';
import { ImageService } from './ImageService';
import PDFDocument from 'pdfkit';
import * as docx from 'docx';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, SectionType, PageNumber, ShadingType, BorderStyle, PageBreak } from 'docx';
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
      
      if (!shapeDataFromRenderer || typeof shapeDataFromRenderer !== 'object') {
        console.error('[ExportService] Invalid shape data received from renderer', shapeDataFromRenderer);
        return false;
      }
      
      const shapeKeys = Object.keys(shapeDataFromRenderer);
      console.log(`[ExportService] Received ${shapeKeys.length} shape entries`);
      
      // Log a few sample entries
      if (shapeKeys.length > 0) {
        const sampleKeys = shapeKeys.slice(0, 3);
        sampleKeys.forEach(key => {
          const shapes = shapeDataFromRenderer[key];
          console.log(`[ExportService] Key "${key}" has ${shapes.length} shapes`);
        });
      }
      
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
      // Ensure we have shape data to work with
      if (!this.shapeData || typeof this.shapeData !== 'object') {
        console.log(`[ExportService] No shape data is available for any images`);
        return imagePath;
      }

      // Check if we have shape data for this image
      // First try direct path lookup
      let shapes = this.shapeData[imagePath];
      
      // If no shapes found by direct path, try checking for step ID + path pattern
      if (!shapes || shapes.length === 0) {
        // Look for entries with format "stepId:imagePath"
        const matchingKeys = Object.keys(this.shapeData).filter(key => {
          return key.includes(`:${imagePath}`) || key.endsWith(imagePath);
        });
        
        if (matchingKeys.length > 0) {
          console.log(`[ExportService] Found shapes using pattern match for: ${imagePath}`);
          console.log(`[ExportService] Matched keys: ${matchingKeys.join(', ')}`);
          
          // Use the first matching key's shapes
          shapes = this.shapeData[matchingKeys[0]];
        }
      }
      
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
      const primaryColor = "2c5282"; // Blue
      const accentColor = "4299e1"; // Lighter Blue
      const textColor = "333333";   // Dark Gray
      const lightGrayColor = "e2e8f0";
      const whiteColor = "FFFFFF";
      const stepNumberColor = textColor; // Changed from "2c5282" (blue) to black

      const sections: docx.ISectionOptions[] = [];
      const titlePageChildren: Paragraph[] = [];

      // ---- START TITLE PAGE ----

      // Decorative Header Bar (using a paragraph with shading)
      titlePageChildren.push(new Paragraph({
        children: [new TextRun("\t")], // Needs some content
        shading: {
          type: ShadingType.SOLID,
          color: primaryColor,
          fill: primaryColor,
        },
        spacing: { before: 0, after: 0 },
        // Approximate height of 100 PDF units by font size and spacing
        // This is tricky in DOCX, often best done with a table or image
      }));
      // To make the header bar appear taller, we can add empty paragraphs or adjust spacing.
      // For simplicity, we'll rely on the single shaded paragraph. A more robust way
      // would be a 1x1 table with cell shading and fixed height.

      // Spacing after header bar
      titlePageChildren.push(new Paragraph({ spacing: { before: 200 * 6 } })); // Approx 60pt (PDF had moveDown(3))

      // Decorative element above title (short line)
       titlePageChildren.push(new Paragraph({
        children: [new TextRun({ text: "" })], // Empty run for border
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 },
        border: {
            top: { style: BorderStyle.SINGLE, size: 18, color: accentColor }, // size is in 1/8th of a point
        },
        // To make it appear like a short line, this is not ideal.
        // A shape or a very short table would be better.
        // For now, a full width border.
      }));


      // Tutorial Title
      titlePageChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: options.docTitle || tutorial.title,
              size: 32 * 2, // PDF: 32pt
              bold: true,
              color: primaryColor,
              font: "Helvetica",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }, // Approx 10pt
        })
      );
      
      // Decorative line under title
      titlePageChildren.push(new Paragraph({
        children: [new TextRun("")],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 * 3 }, // Approx 30pt
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 12, color: accentColor },
        }
      }));


      // Generated Date
      const currentDate = new Date().toLocaleDateString();
      titlePageChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on ${currentDate}`,
              size: 12 * 2, // PDF: 12pt
              color: textColor,
              font: "Helvetica",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 * 2 }, // Approx 20pt
        })
      );

      // Tutorial Description
      if (tutorial.description) {
        titlePageChildren.push(
          new Paragraph({ // Container for border/shading
            children: [
              new TextRun({
                text: tutorial.description,
                size: 12 * 2, // PDF: 12pt
                italics: true,
                color: "505050",
                font: "Helvetica",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200, line: 240 * 1.5 }, // Spacing for the box, line for approximate height
            shading: { // Simulates the background box
              type: ShadingType.SOLID,
              color: whiteColor, // White background
              fill: whiteColor,
            },
             border: { // Border for the box
                top: { style: BorderStyle.SINGLE, size: 4, color: lightGrayColor },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: lightGrayColor },
                left: { style: BorderStyle.SINGLE, size: 4, color: lightGrayColor },
                right: { style: BorderStyle.SINGLE, size: 4, color: lightGrayColor },
            },
            indent: { left: 720, right: 720 } // Approx 1 inch margins for the box
          })
        );
      }
      
      // Add a page break after the title page content to ensure footer is on this page
      titlePageChildren.push(new Paragraph({ children: [new PageBreak()] }));


      sections.push({
        properties: {
          type: SectionType.NEXT_PAGE, // Starts title page on its own page
        },
        headers: { default: new docx.Header({ children: [] }) }, // Empty header, must have children array
        footers: {
          default: new docx.Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Tutorial Documentation", size: 10 * 2, color: "666666", font: "Helvetica" }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: titlePageChildren,
      });
      // ---- END TITLE PAGE ----


      // ---- START STEPS SECTION ----
      const stepPageChildren: Paragraph[] = [];
      const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];

        if (i > 0) { // Page break before each step (except the first actual step)
          stepPageChildren.push(new Paragraph({ children: [new PageBreak()] }));
        }

        const parseActionText = (text: string) => {
          if (!text) return { title: text, description: '' };
          const titleMatch = text.match(/^\[TITLE\](.*?)(\[DESC\]|$)/s);
          if (titleMatch && titleMatch[1].trim()) {
            const title = titleMatch[1].trim();
            const descMatch = text.match(/\[DESC\](.*?)$/s);
            const description = descMatch && descMatch[1].trim() ? descMatch[1].trim() : '';
            return { title, description };
          }
          return { title: text, description: '' };
        };

        const { title: stepTitle, description: stepDescription } = parseActionText(step.actionText);

        // Step Header
        const stepHeaderRuns: TextRun[] = [];
        if (options.includeStepNumbers) {
          stepHeaderRuns.push(new TextRun({
            text: `Step ${i + 1} | `,
            size: 16 * 2, // PDF: 16pt
            bold: true,
            color: stepNumberColor,
            font: "Helvetica",
          }));
        }
        stepHeaderRuns.push(new TextRun({
          text: stepTitle,
          size: 16 * 2, // PDF: 16pt
          bold: false, // Title part is not bold in PDF (Helvetica regular)
          color: textColor,
          font: "Helvetica",
        }));
        stepPageChildren.push(new Paragraph({ children: stepHeaderRuns, spacing: { after: 200 } }));


        // Screenshot
        if (options.includeScreenshots && step.screenshotPath && fs.existsSync(step.screenshotPath)) {
          try {
            const imageBase64 = await ImageService.imagePathToDataUrl(step.screenshotPath);
            if (imageBase64) {
              const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
              const imageBuffer = Buffer.from(base64Data, 'base64');
              stepPageChildren.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: imageBuffer,
                      transformation: { // PDF uses fit [500, 200]
                        width: 500, 
                        height: 200, // Aspect ratio might be skewed, docx handles this by max width/height
                      },
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 300 }, // Approx 15pt (PDF: moveDown(1.5))
                })
              );
            }
          } catch (imgError) {
            console.error(`Error adding image for step ${i + 1}:`, imgError);
            stepPageChildren.push(new Paragraph({ text: "[Error: Screenshot could not be loaded]", alignment: AlignmentType.CENTER, spacing: { after: 200 }}));
          }
        } else {
             stepPageChildren.push(new Paragraph({ text: "", spacing: { after: 300 } })); // Add spacing even if no image
        }


        // Description
        if (stepDescription) {
          stepPageChildren.push(new Paragraph({ spacing: { after: 100 } })); // Space before description text
          
          // Add the description without a title header
          stepPageChildren.push(
            new Paragraph({
              children: [new TextRun({ text: stepDescription, size: 11 * 2, color: textColor, font: "Helvetica" })],
              spacing: { after: 200 }, // paragraphGap: 5 in PDF is approx 10pt
            })
          );
        }
        
        // Separator line after each step
        stepPageChildren.push(new Paragraph({
            children: [], // No text needed, just border
            spacing: { before: 200, after: 100 }, // PDF: moveDown(1.5) before, moveDown(0.5) after
            border: {
                bottom: { color: '222222', style: BorderStyle.SINGLE, size: 6 } // 50% thinner (was 12)
            },
            indent: { left: 120, right: 120 } // Reduce indent for wider line (approx 0.17 inch)
        }));
      }

      sections.push({
        properties: {}, // Default properties for subsequent pages
        headers: { default: new docx.Header({ children: [] }) }, // Empty header, must have children array
        footers: {
          default: new docx.Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 9*2, color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 9*2, color: "888888" }),
                  new TextRun({ text: " of ", size: 9*2, color: "888888" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 9*2, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        children: stepPageChildren,
      });
      // ---- END STEPS SECTION ----

      const doc = new Document({
        creator: "OpenScribe",
        title: options.docTitle || tutorial.title,
        description: tutorial.description || "Tutorial Documentation",
        sections: sections,
        styles: {
          paragraphStyles: [
            {
              id: "defaultFooter",
              name: "Default Footer Style",
              basedOn: "Normal",
              next: "Normal",
              run: { size: 9*2, color: "888888", font: "Helvetica" },
              paragraph: { alignment: AlignmentType.CENTER },
            }
          ]
        }
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);
    } catch (error) {
      console.error('DOCX export failed:', error);
      throw error;
    }
  }
}

export default ExportService; 