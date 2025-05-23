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
  private static readonly IMAGE_DESCRIPTION_SPACING = 30; // Spacing between image and description

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
          font: 'Helvetica'
        });

        // Create write stream
        const stream = fs.createWriteStream(outputPath);
        
        // Handle errors
        stream.on('error', (err) => {
          console.error('PDF stream error:', err);
          if ((err as NodeJS.ErrnoException).code === 'EBUSY' || err.message.includes('resource busy or locked')) {
            reject(new Error(`Failed to write PDF file: EBUSY: resource busy or locked. open '${outputPath}'`));
          } else {
            reject(new Error(`Failed to write PDF file: ${err.message}`));
          }
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
    // Create a clean title page with professional styling
    
    // Use more subtle colors
    const primaryColor = '#2c5282';
    const backgroundColor = '#f8fafc';
    const textColor = '#333333';
    const accentColor = '#4299e1';
    
    // Fill the entire page with a subtle background
    doc.rect(0, 0, doc.page.width, doc.page.height)
       .fillColor(backgroundColor)
       .fill();
       
    // Add a decorative header bar
    doc.rect(0, 0, doc.page.width, 100)
       .fillColor(primaryColor)
       .fill();
       
    // Add title text - centered vertically on the page
    const centerY = doc.page.height / 2 - 100;
    
    // Add a decorative element
    doc.rect(doc.page.width / 2 - 50, centerY - 80, 100, 4)
       .fillColor(accentColor)
       .fill();
    
    // Title with proper spacing and enhanced font
    doc.y = centerY - 60;
    doc.fontSize(32)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text(options.title || tutorial.title, {
         align: 'center'
       });
    
    // Add a small decorative line under the title
    const titleWidth = doc.widthOfString(options.title || tutorial.title);
    const centerX = (doc.page.width - titleWidth) / 2;
    
    doc.moveTo(centerX, centerY)
       .lineTo(centerX + titleWidth, centerY)
       .strokeColor(accentColor)
       .lineWidth(2)
       .stroke();
       
    // Add generation date
    doc.y = centerY + 40;
    const currentDate = new Date().toLocaleDateString();
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor(textColor)
       .text(`Generated on ${currentDate}`, {
         align: 'center'
       });
    
    // Add description if available with enhanced formatting
    if (tutorial.description) {
      // Add a subtle background for the description
      const descY = centerY + 80;
      doc.y = descY;
      const descHeight = doc.heightOfString(tutorial.description, {
        width: doc.page.width - 200,
        align: 'center'
      });
      
      doc.rect(100, descY - 10, doc.page.width - 200, descHeight + 20)
         .fillColor('#ffffff')
         .fill();
         
      // Add border to description box
      doc.rect(100, descY - 10, doc.page.width - 200, descHeight + 20)
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke();
         
      // Reset position and color for description text
      doc.fontSize(12)
         .font('Helvetica-Oblique')
         .fillColor('#505050')
         .text(tutorial.description, {
           align: 'center',
           width: doc.page.width - 200
         });
    }
    
    // Add footer text
    doc.y = doc.page.height - 70;
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#666666')
       .text('Tutorial Documentation', {
         align: 'center'
       });
    
    // Add a new page for the actual content
    doc.addPage();
    
    // Reset text color for the rest of the document
    doc.fillColor('#000000');
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
      if (i > 0) { // Only add a page break for steps after the first one
        doc.addPage();
      }
      
      // Calculate page dimensions to use throughout 
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      
      // Parse actionText for title and description
      const parseActionText = (text: string) => {
        if (!text) return { title: text, description: '' };
        
        // Check if actionText follows our format: [TITLE]Title text[DESC]Description text
        const titleMatch = text.match(/^\[TITLE\](.*?)(\[DESC\]|$)/s);
        if (titleMatch && titleMatch[1].trim()) {
          // Extract title
          const title = titleMatch[1].trim();
          
          // Check for description
          const descMatch = text.match(/\[DESC\](.*?)$/s);
          const description = descMatch && descMatch[1].trim() ? descMatch[1].trim() : '';
          
          return { title, description };
        }
        
        // If not in our format, return the original text as title with no description
        return { title: text, description: '' };
      };
      
      const { title: stepTitle, description: stepDescription } = parseActionText(step.actionText);
      
      // Format step header with number and title on the same line without background
      const stepTitleY = doc.y;
      let stepHeader = options.includeNumbers ? `Step ${i + 1}: ${stepTitle}` : stepTitle;
      
      if (options.includeNumbers) {
        doc.fontSize(16)
           .fillColor('#000000')
           .font('Helvetica-Bold')
           .text(`Step ${i + 1} | `, {
             continued: true,
             align: 'left'
           })
           .fillColor('#000')
           .font('Helvetica')
           .text(stepTitle, {
             continued: false
           });
      } else {
        doc.fontSize(16)
           .fillColor('#000')
           .font('Helvetica-Bold')
           .text(stepTitle, {
             continued: false
           });
      }
      
      // Add spacing before image
      doc.moveDown(1);
      
      // Add image if enabled and available
      if (options.includeImages && step.screenshotPath && fs.existsSync(step.screenshotPath)) {
        try {
          // Get page dimensions for sizing
          const maxWidth = Math.min(pageWidth, 500); // Increased width for better visibility
          
          const imgY = doc.y;
          
          // Then draw the image centered on the background
          doc.image(step.screenshotPath, {
            fit: [maxWidth, this.IMAGE_MAX_HEIGHT],
            align: 'center'
          });
          
          // Force the position to be after the image + the image height
          doc.y = Math.max(doc.y, imgY + this.IMAGE_MAX_HEIGHT - 5);
          
          // Add extra space after the image
          doc.moveDown(1.5);
        } catch (imageError) {
          console.error(`Failed to add image for step ${i+1}:`, imageError);
          doc.fontSize(10)
             .fillColor('#ff0000')
             .text('[Error: Image could not be added]', {
               align: 'center'
             });
          doc.moveDown(1);
          doc.fillColor('#000'); // Reset color
        }
      }
      
      // Force a page break if we're too close to the bottom of the page
      if (doc.y > doc.page.height - doc.page.margins.bottom - 200) {
        doc.addPage();
      }
      
      // Store the current Y position after image for description placement
      const currentY = doc.y;
      const descriptionStartY = currentY + 10; // Add a small buffer
      
      // Add description after the image if available
      if (stepDescription) {
        const descY = descriptionStartY;
        
        // Reset Y position to ensure we start at the right place
        doc.y = descY;
        
        doc.moveDown(0.5);
        
        // Display the description without the header
        doc.fontSize(11)
           .fillColor('#333')
           .font('Helvetica')
           .text(stepDescription, {
             continued: false,
             align: 'left',
             indent: 0,
             paragraphGap: 5
           });
      }
      
      // Add a subtle separator line after each step (image or description)
      doc.moveDown(1.5); // Ensure enough space before the line
      // Draw a darker, thicker, and wider separator line
      const lineInset = 16; // 16pt from each edge (smaller than default margin)
      doc.strokeColor('#222222')
         .moveTo(doc.page.margins.left - lineInset, doc.y)
         .lineTo(doc.page.width - doc.page.margins.right + lineInset, doc.y)
         .lineWidth(1)
         .stroke();
      doc.moveDown(0.5); // Space after line before footer or next step
      
      // Add a page footer with step number/total
      const bottomPosition = doc.page.height - doc.page.margins.bottom - 20;
      const currentPositionY = doc.y;
      
      doc.y = bottomPosition;
      doc.fontSize(9)
         .fillColor('#888')
         .text(`Page ${i + 2} of ${sortedSteps.length + 1}`, { // +1 for title page
           align: 'center'
         });
      
      // Reset position for next page
      doc.y = currentPositionY;
    }
  }
} 