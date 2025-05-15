import React, { useState, useEffect, useRef } from 'react';
import { useStepsStore } from '../store/useStepsStore';
import { Tutorial, Step } from '../../shared/types';
import { drawShape } from '../utils/shapeDrawing';

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

export const ExportTab: React.FC<ExportTabProps> = ({ tutorialId }) => {
  const [docTitle, setDocTitle] = useState('My Documentation');
  const [includeScreenshots, setIncludeScreenshots] = useState(true);
  const [includeStepNumbers, setIncludeStepNumbers] = useState(true);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'DOCX'>('PDF');
  const [isLoading, setIsLoading] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});
  const [hasMarkupAnnotations, setHasMarkupAnnotations] = useState(false);
  const [showMarkupInPreview, setShowMarkupInPreview] = useState(false);
  
  // Get the store state for shape data to check if we have any markup
  const imageShapeData = useStepsStore(state => state.imageShapeData);

  // Add refs for preview canvases
  const previewCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

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
      
      // Load screenshot data URLs
      const dataUrls: Record<string, string> = {};
      for (const step of stepsData) {
        if (step.screenshotPath && step.id) {
          try {
            const dataUrl = await window.electronAPI.loadImageAsDataUrl(step.screenshotPath);
            if (dataUrl) {
              dataUrls[step.id] = dataUrl;
            }
          } catch (error) {
            console.error(`Failed to load image for step ${step.id}:`, error);
          }
        }
      }
      setImageDataUrls(dataUrls);
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
      });
      
      // Update tutorial status to 'exported' if needed
      if (tutorial.status !== 'exported') {
        await window.electronAPI.updateTutorialStatus(tutorialId, 'exported');
        // Refresh tutorial data
        loadTutorialData();
      }
    } catch (error) {
      console.error('Export failed:', error);
      setExportResult({
        success: false,
        message: `Export failed: ${(error as Error).message || 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get a sample of steps for preview
  const previewSteps = steps.length > 0 
    ? [...steps].sort((a, b) => a.order - b.order).slice(0, 3) 
    : [];

  // Draw markup on preview canvases when enabled
  useEffect(() => {
    previewSteps.forEach((step) => {
      const key = String(step.id);
      const canvas = previewCanvasRefs.current[key];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new window.Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (showMarkupInPreview) {
          let shapes: any[] = [];
          if (step.screenshotPath && step.id && typeof step.screenshotPath === 'string' && imageShapeData && typeof imageShapeData === 'object') {
            const key = `${step.id}:${step.screenshotPath}`;
            shapes = imageShapeData[key] || [];
          }
          shapes.forEach(shape => {
            drawShape(ctx, shape.type, shape.start, shape.end, shape.color, false);
          });
        }
      };
      img.src = imageDataUrls[String(step.id)];
    });
  }, [showMarkupInPreview, previewSteps, imageDataUrls, imageShapeData]);

  return (
    <div className="p-6 bg-white h-full flex space-x-6">
      {/* Left Column: Settings */} 
      <div className="w-1/3 flex-shrink-0 flex flex-col space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">Export Documentation</h2>
        <p className="text-sm text-gray-600">Export your documentation as PDF or DOCX</p>

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
          {/* Hidden options - we'll keep these enabled but not visible */}
          <div className="hidden">
            <ToggleSwitch label="Include Screenshots" enabled={includeScreenshots} onChange={setIncludeScreenshots} />
            <ToggleSwitch label="Include Step Numbers" enabled={includeStepNumbers} onChange={setIncludeStepNumbers} />
            
            {/* Markup section */}
            {hasMarkupAnnotations && (
              <div className="border-t border-gray-200 pt-3 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Markup Annotations</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Available
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Your markup annotations will be applied to screenshots during export.
                </p>
                <div className="mt-2">
                  <ToggleSwitch 
                    label="Show markup in preview" 
                    enabled={showMarkupInPreview} 
                    onChange={setShowMarkupInPreview} 
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    (Preview markup is simulated and may differ from final export)
                  </p>
                </div>
              </div>
            )}
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
          <div className={`p-4 rounded-md ${exportResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p className="text-sm">{exportResult.message}</p>
          </div>
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

      {/* Right Column: Preview */} 
      <div className="flex-1 border border-gray-200 rounded-lg bg-gray-50 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-gray-900">Preview</h3>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Full Preview</button>
        </div>
        
        <div className="flex-1 bg-white border border-gray-200 rounded overflow-y-auto p-4 space-y-3">
          <h4 className="font-bold text-lg mb-4">{docTitle}</h4>
          
          {previewSteps.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>No steps available for preview.</p>
              <p className="text-sm mt-2">Add steps to your tutorial to see a preview.</p>
            </div>
          ) : (
            previewSteps.map((step, index) => (
              <div key={step.id} className="mb-4">
                <div className="flex space-x-3">
                  <span className="font-medium text-gray-700">{index + 1}</span>
                  <span className="text-gray-800">
                    {(() => {
                      // Parse actionText for title
                      let displayText = step.actionText || '';
                      if (step.actionText) {
                        const titleMatch = step.actionText.match(/^\[TITLE\](.*?)(\[DESC\]|$)/s);
                        if (titleMatch && titleMatch[1].trim()) {
                          displayText = titleMatch[1].trim();
                        }
                      }
                      return displayText;
                    })()}
                  </span>
                </div>
                <div className="pl-6 py-2">
                  {step.screenshotPath && step.id && imageDataUrls[String(step.id)] ? (
                    <PreviewCanvas
                      imageUrl={imageDataUrls[String(step.id)]}
                      shapes={step.id && step.screenshotPath ? (imageShapeData[`${step.id}:${step.screenshotPath}`] || []) : []}
                      width={200}
                      height={150}
                    />
                  ) : (
                    <div className="w-full aspect-video bg-gray-100 border rounded flex items-center justify-center">
                      <ImageIcon />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {steps.length > 3 && (
            <div className="text-center py-3 text-gray-500 text-sm">
              <p>... and {steps.length - 3} more steps</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 