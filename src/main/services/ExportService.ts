import * as fs from 'fs';
import * as path from 'path';
import { app, dialog } from 'electron';
import { Step, Tutorial } from '../../shared/types';
import { ImageService } from './ImageService';
import PDFDocument from 'pdfkit';
import * as docx from 'docx';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, SectionType } from 'docx';

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

  private constructor() {}

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
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