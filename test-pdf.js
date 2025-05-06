const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create a basic PDF test to see if we can generate PDFs without custom fonts
function createTestPDF() {
  console.log('Creating test PDF...');
  
  try {
    // Create a simple document with standard fonts
    const doc = new PDFDocument({
      size: 'A4',
      info: { Title: 'Test PDF', Author: 'OpenScribe' }
    });
    
    // Pipe to a file
    const outputPath = './test-output.pdf';
    const stream = fs.createWriteStream(outputPath);
    
    stream.on('error', (err) => {
      console.error('Stream error:', err);
    });
    
    doc.pipe(stream);
    
    // Use built-in standard fonts
    doc.fontSize(25)
      .font('Courier')
      .text('Testing Courier font', 100, 100);
      
    doc.fontSize(25)
      .font('Courier-Bold')
      .text('Testing Courier-Bold font', 100, 150);
      
    doc.fontSize(25)
      .font('Courier-Oblique')
      .text('Testing Courier-Oblique font', 100, 200);
    
    // Finalize the PDF
    doc.end();
    
    stream.on('finish', () => {
      console.log(`PDF created successfully at: ${outputPath}`);
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
  }
}

// Run the test
createTestPDF(); 