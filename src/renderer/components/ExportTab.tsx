import React, { useState, useEffect, useRef } from 'react';
import { useStepsStore } from '../store/useStepsStore';
import { Tutorial, Step } from '../../shared/types';
import { drawShape } from '../utils/shapeDrawing';
import { FileBusyError } from './FileBusyError';

// Placeholder icon
const ImageIcon = () => <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>;

// Toggle Switch Component
const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void }> = ({ label, enabled, onChange }) => {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <button
        type="button"
        className={`${enabled ? 'bg-indigo-600' : 'bg-gray-200'}
          relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
      >
        <span
          aria-hidden="true"
          className={`${enabled ? 'translate-x-5' : 'translate-x-0'}
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
        />
      </button>
    </div>
  );
};

interface ExportTabProps {
  tutorialId?: string;
}

// PreviewCanvas component
export const PreviewCanvas: React.FC<{
  imageUrl: string;
  shapes: any[];
  width: number;
  height: number;
}> = ({ imageUrl, shapes, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Add state to track the actual rendered dimensions
  const [actualDimensions, setActualDimensions] = useState({ width, height });
  
  useEffect(() => {
    console.log('[PreviewCanvas] Rendering preview:', { 
      imageUrl: imageUrl.substring(0, 30) + '...', 
      shapeCount: shapes.length, 
      requestedWidth: width,
      requestedHeight: height,
      actualWidth: actualDimensions.width,
      actualHeight: actualDimensions.height
    });
    
    // Log shape coordinates for debugging
    if (shapes.length > 0) {
      console.log('[PreviewCanvas] First shape coordinates:', {
        start: shapes[0].start,
        end: shapes[0].end
      });
    }
    
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Load the image
    const img = new Image();
    img.onload = () => {
      // Calculate the scaling to maintain aspect ratio
      const imgAspectRatio = img.width / img.height;
      const canvasAspectRatio = width / height;
      
      let drawWidth = width;
      let drawHeight = height;
      
      // Adjust dimensions to maintain aspect ratio
      if (imgAspectRatio > canvasAspectRatio) {
        // Image is wider than canvas area
        drawWidth = width;
        drawHeight = width / imgAspectRatio;
      } else {
        // Image is taller than canvas area
        drawHeight = height;
        drawWidth = height * imgAspectRatio;
      }
      
      // Update the canvas size to match the drawing dimensions
      canvas.width = drawWidth;
      canvas.height = drawHeight;
      
      // Store actual dimensions for scaling shapes
      setActualDimensions({ width: drawWidth, height: drawHeight });
      
      // Calculate centering position
      const x = (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2;
      
      // Draw the image
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      
      // Draw the shapes
      if (shapes && shapes.length > 0) {
        shapes.forEach(shape => {
          // Scale shape coordinates to match the drawn image dimensions
          const scaledShape = {
            ...shape,
            start: {
              x: (shape.start.x * drawWidth) / img.width,
              y: (shape.start.y * drawHeight) / img.height
            },
            end: {
              x: (shape.end.x * drawWidth) / img.width,
              y: (shape.end.y * drawHeight) / img.height
            }
          };
          
          drawShape(ctx, shape.type, scaledShape.start, scaledShape.end, shape.color, false);
        });
      }
    };
    
    img.src = imageUrl;
  }, [imageUrl, shapes, width, height]);
  
  return (
    <div className="relative flex items-center justify-center overflow-hidden" style={{ width: '100%', height: 'auto', minHeight: '100px' }}>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="max-w-full object-contain"
      />
    </div>
  );
};

interface ExportResult {
  success: boolean;
  message: string;
  filePath?: string;
}

export const ExportTab: React.FC<ExportTabProps> = ({ tutorialId }) => {
  const [docTitle, setDocTitle] = useState('My Documentation');
  const [includeScreenshots, setIncludeScreenshots] = useState(true);
  const [includeStepNumbers, setIncludeStepNumbers] = useState(true);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'DOCX'>('PDF');
  const [isLoading, setIsLoading] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [hasMarkupAnnotations, setHasMarkupAnnotations] = useState(false);
  
  // Get the store state for shape data to check if we have any markup
  const imageShapeData = useStepsStore(state => state.imageShapeData);

  // Load tutorial details and steps when tutorialId changes
  useEffect(() => {
    if (tutorialId) {
      loadTutorialData();
    }
  }, [tutorialId]);
  
  // Check if there are markup annotations available
  useEffect(() => {
    // The shape data is an object with image paths as keys and arrays of shapes as values
    const shapeDataEntries = Object.entries(imageShapeData);
    const hasShapes = shapeDataEntries.some(([_, shapes]) => shapes && shapes.length > 0);
    setHasMarkupAnnotations(hasShapes);
  }, [imageShapeData]);

  const loadTutorialData = async () => {
    if (!tutorialId) return;

    try {
      // Load tutorial details
      const tutorialData = await window.electronAPI.getTutorial(tutorialId);
      setTutorial(tutorialData);
      
      // Set doc title based on tutorial title
      if (tutorialData?.title) {
        setDocTitle(tutorialData.title);
      }
      
      // Load steps for this tutorial
      const stepsData = await window.electronAPI.getStepsByTutorial(tutorialId);
      setSteps(stepsData);
    } catch (error) {
      console.error('Error loading tutorial data:', error);
    }
  };

  const handleExport = async () => {
    if (!tutorialId || !tutorial) {
      setExportResult({
        success: false,
        message: 'No tutorial selected for export.',
      });
      return;
    }
    
    setIsLoading(true);
    setExportResult(null);
    
    try {
      // Explicitly send shape data to main process
      console.log(`[ExportTab] Sending markup data to main process. Keys: ${Object.keys(imageShapeData).length}`);
      
      // Verify we have shapes to send
      let totalShapes = 0;
      Object.values(imageShapeData).forEach(shapes => {
        if (Array.isArray(shapes)) {
          totalShapes += shapes.length;
        }
      });
      
      console.log(`[ExportTab] Total shapes to send: ${totalShapes}`);
      
      // Send the shape data to the main process
      await window.electronAPI.prepareShapesForExport(tutorialId, imageShapeData);
      
      // Call export service via IPC
      const options = {
        docTitle,
        includeScreenshots,
        includeStepNumbers,
        exportFormat,
      };
      
      const filePath = await window.electronAPI.exportTutorial(tutorialId, options);
      
      setExportResult({
        success: true,
        message: `Successfully exported tutorial to ${filePath}`,
        filePath,
      });
      
      // Update tutorial status to 'exported' if needed
      if (tutorial.status !== 'exported') {
        await window.electronAPI.updateTutorialStatus(tutorialId, 'exported');
        // Refresh tutorial data
        loadTutorialData();
      }
    } catch (error) {
      console.error('Export failed:', error);
      
      let errorMessage = `Export failed: ${(error as Error).message || 'Unknown error'}`;
      let filePath: string | undefined;
      
      // Provide friendly messages for common errors
      const errorText = (error as Error).message || '';
      if (errorText.includes('resource busy or locked') || errorText.includes('File busy:')) {
        errorMessage = 'Export failed: The target file is currently open. Please close the file and try again.';
        
        // Try to extract file path from error message
        const match = errorText.match(/'([^']+)'/);
        if (match && match[1]) {
          filePath = match[1];
        }
      } else if (errorText.includes('Export cancelled by user') || errorText.includes('cancelled by user')) {
        // Show a simple message when user cancels
        errorMessage = 'Export cancelled';
      }
      
      setExportResult({
        success: false,
        message: errorMessage,
        filePath
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      <div className="w-full pt-12 pb-16 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-medium text-gray-800 mb-2">Export Documentation</h1>
        <p className="text-gray-600 mb-10">Export your documentation as PDF or DOCX</p>

        <div className="text-center p-12 border border-gray-200 rounded-lg bg-white w-4/5 max-w-xl shadow-sm">
          <div className="space-y-6">
            {/* Document Settings */} 
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
              <h3 className="font-medium text-gray-900">Document Settings</h3>
              <div>
                <label htmlFor="doc-title" className="block text-sm font-medium text-gray-700">Document Title</label>
                <input
                  type="text"
                  id="doc-title"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Export Format */} 
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
              <h3 className="font-medium text-gray-900">Export Format</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setExportFormat('PDF')}
                  className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${exportFormat === 'PDF' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  PDF
                </button>
                <button 
                  onClick={() => setExportFormat('DOCX')}
                  className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${exportFormat === 'DOCX' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  DOCX
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {exportFormat === 'PDF' 
                  ? 'Export as PDF for a fixed layout that looks the same on all devices. Best for sharing and printing.'
                  : 'Export as DOCX for editing in Microsoft Word or other compatible applications.'
                }
              </p>
            </div>

            {/* Export Result */}
            {exportResult && (
              <>
                {exportResult.success ? (
                  <div className="p-4 rounded-md bg-green-50 text-green-800">
                    <p className="text-sm">{exportResult.message}</p>
                  </div>
                ) : (
                  <>
                    {exportResult.message.includes('file is currently open') ? (
                      <FileBusyError className="mb-4" fileName={exportResult.filePath} />
                    ) : exportResult.message === 'Export cancelled' ? (
                      <div className="p-4 rounded-md bg-gray-50 border border-gray-200 text-gray-600">
                        <p className="text-sm">Export cancelled</p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-md bg-red-50 text-red-800">
                        <p className="text-sm">{exportResult.message}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Export Button */} 
            <button
              onClick={handleExport}
              disabled={isLoading || !tutorialId}
              className={`w-full ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : !tutorialId
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gray-800 hover:bg-gray-900'
              } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline relative`}
            >
              {isLoading ? (
                <>
                  <span className="inline-block animate-spin mr-2">↻</span>
                  Exporting...
                </>
              ) : (
                'Export Documentation'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 