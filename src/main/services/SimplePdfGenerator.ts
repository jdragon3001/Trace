import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import { Step, Tutorial } from '../../shared/types';

export interface PdfOptions {
  title: string;
  includeImages: boolean;
  includeNumbers: boolean;
}

/**
 * A simplified PDF generator that avoids font-related issues
 * by using only standard fonts and minimal formatting
 */
export class SimplePdfGenerator {
  // Constants for layout measurements
  private static readonly IMAGE_MAX_HEIGHT = 200; // Reduced from 300px
  private static readonly PAGE_MARGIN_BOTTOM = 80;
  private static readonly SECTION_SPACING = 30;
  private static readonly STEP_SPACING = 40;

  /**
   * Generate a PDF document with the given tutorial and steps
   */
  public static async generate(
    outputPath: string,
    tutorial: Tutorial,
    steps: Step[],
    options: PdfOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create PDF document with minimal settings
        const doc = new PDFDocument({
          autoFirstPage: true,
          margins: { top: 50, bottom: 50, left: 72, right: 72 },
          size: 'letter',
          bufferPages: true,
          // Font subset features cause issues, so we'll use standard fonts only
          font: 'Courier'
        });

        // Create write stream
        const stream = fs.createWriteStream(outputPath);
        
        // Handle errors
        stream.on('error', (err) => {
          console.error('PDF stream error:', err);
          reject(new Error(`Failed to write PDF file: ${err.message}`));
        });
        
        // Pipe document to output file
        doc.pipe(stream);
        
        // Add metadata
        doc.info.Title = options.title || tutorial.title;
        doc.info.Author = 'OpenScribe';
        
        // Add document header
        this.addDocumentHeader(doc, tutorial, options);
        
        // Add steps with proper spacing
        this.addSteps(doc, steps, options);
        
        // Finalize the document
        doc.end();
        
        // Handle completion
        stream.on('finish', () => {
          console.log(`PDF generated at: ${outputPath}`);
          resolve(outputPath);
        });
        
      } catch (error) {
        console.error('PDF generation error:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Add document header with title and description
   */
  private static addDocumentHeader(
    doc: PDFKit.PDFDocument, 
    tutorial: Tutorial, 
    options: PdfOptions
  ): void {
    // Title page with ample margins
    doc.moveDown(2);
    doc.fontSize(24).text(options.title || tutorial.title, {
      align: 'center'
    });
    doc.moveDown(2);
    
    // Add description if available with fixed spacing
    if (tutorial.description) {
      doc.fontSize(12).text(tutorial.description, {
        align: 'center'
      });
      doc.moveDown(2);
    } else {
      doc.moveDown(1);
    }
    
    // Add separator line
    doc.moveTo(72, doc.y)
       .lineTo(doc.page.width - 72, doc.y)
       .stroke();
    doc.moveDown(2);
  }
  
  /**
   * Add steps to the document with proper spacing
   */
  private static addSteps(
    doc: PDFKit.PDFDocument, 
    steps: Step[], 
    options: PdfOptions
  ): void {
    // Sort steps by order
    const sortedSteps = steps.sort((a, b) => a.order - b.order);
    
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      
      // Start a new page for each step to ensure clean separation
      if (i > 0) {
        doc.addPage();
      }
      
      // Add step header with number if enabled
      if (options.includeNumbers) {
        doc.fontSize(16).text(`Step ${i + 1}: ${step.actionText}`, {
          continued: false
        });
      } else {
        doc.fontSize(16).text(step.actionText, {
          continued: false
        });
      }
      doc.moveDown(2);
      
      // Add image if enabled and available
      if (options.includeImages && step.screenshotPath && fs.existsSync(step.screenshotPath)) {
        try {
          // Get page dimensions for sizing
          const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const maxWidth = Math.min(pageWidth, 450); // Limit width to 450px or page width
          
          // Calculate dimensions to maintain aspect ratio while limiting height
          doc.image(step.screenshotPath, {
            fit: [maxWidth, this.IMAGE_MAX_HEIGHT],
            align: 'center'
          });
          
          // Add extra space after the image
          doc.moveDown(3);
        } catch (imageError) {
          console.error(`Failed to add image for step ${i+1}:`, imageError);
          doc.fontSize(10).text('[Error: Image could not be added]', {
            align: 'center'
          });
          doc.moveDown(1);
        }
      }
    }
  }
} 