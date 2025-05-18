import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { RecordingStep, Step } from '../../shared/types';
import { useStepsStore, DisplayStep } from '../store/useStepsStore';
import { StepRepository } from '../repositories/StepRepository';
import { drawShape } from '../utils/shapeDrawing';
import { PreviewCanvas } from './ExportTab';

// Modal component for enlarged images
const ImageModal: React.FC<{
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}> = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen) return null;

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center z-[1100] hover:bg-gray-300"
        onClick={e => { e.stopPropagation(); onClose(); }}
        title="Close"
      >
        ×
      </button>
      <div 
        className="w-full h-full flex items-center justify-center px-4 py-4"
        onClick={handleModalContentClick}
      >
        <img 
          src={imageUrl} 
          alt="Enlarged screenshot" 
          className="max-w-[98%] max-h-[98%] object-contain"
        />
      </div>
    </div>
  );
};

// Markup Modal component for editing images
const MarkupModal: React.FC<{
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (modifiedImageUrl: string, shapes: Array<{
    id: string;
    type: 'ellipse' | 'arrow' | 'line' | 'rectangle';
    start: { x: number, y: number };
    end: { x: number, y: number };
    color: string;
  }>) => void;
  initialShapes?: Array<{
    id: string;
    type: 'ellipse' | 'arrow' | 'line' | 'rectangle';
    start: { x: number, y: number };
    end: { x: number, y: number };
    color: string;
  }>;
}> = ({ isOpen, imageUrl, onClose, onSave, initialShapes = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'select' | 'ellipse' | 'arrow' | 'line' | 'rectangle'>('ellipse');
  const [color, setColor] = useState('#FF0000'); // Default red
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [shapes, setShapes] = useState<Array<{
    id: string;
    type: 'ellipse' | 'arrow' | 'line' | 'rectangle';
    start: { x: number, y: number };
    end: { x: number, y: number };
    color: string;
  }>>(initialShapes);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-start' | 'resize-end' | 'resize-e' | 'resize-w' | 'resize-n' | 'resize-s' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Add a debounce for shape state updates to prevent flickering
  const debouncedSetShapes = useCallback(
    (newShapes: Array<{
      id: string;
      type: 'ellipse' | 'arrow' | 'line' | 'rectangle';
      start: { x: number, y: number };
      end: { x: number, y: number };
      color: string;
    }>) => {
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(() => {
        setShapes(newShapes);
      });
    },
    [setShapes]
  );
  
  // Add state to track original image dimensions and scale factors
  const [originalImageDimensions, setOriginalImageDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState({ x: 1, y: 1 });

  // Load initialShapes when they change or modal opens
  useEffect(() => {
    if (isOpen) { // Only act when the modal is supposed to be open
      // Always synchronize the internal 'shapes' state with the 'initialShapes' prop.
      // This ensures that if 'initialShapes' is empty (e.g., for a step with no markup),
      // the modal's own 'shapes' state is also cleared.
      console.log('[MarkupModal] Syncing with initialShapes. Count:', initialShapes ? initialShapes.length : 0);
      setShapes(initialShapes ? [...initialShapes] : []); // Deep copy or set to empty array
    }
    // No specific action is needed when isOpen becomes false here, as the parent component (StepsTab)
    // handles clearing its `markupShapes` state via `closeMarkupModal`, and `openMarkupModal` 
    // will provide the correct `initialShapes` for the next opening.
  }, [initialShapes, isOpen]);

  // Load the image into canvas when opened, then apply shapes
  useEffect(() => {
    if (isOpen && imageUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        // Store original image dimensions for coordinate normalization
        setOriginalImageDimensions({ width: img.width, height: img.height });
        
        // Adjust canvas size to match image aspect ratio while fitting in viewport
        const maxWidth = window.innerWidth * 0.85;  // Increased from 0.9
        const maxHeight = window.innerHeight * 0.85;  // Increased from 0.8
        
        let width = img.width;
        let height = img.height;
        
        // Calculate aspect ratio
        const imgAspectRatio = img.width / img.height;
        
        // Resize to fit within viewport while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          
          // Use the smaller ratio to ensure both dimensions fit
          const ratio = Math.min(widthRatio, heightRatio);
          
          width = width * ratio;
          height = height * ratio;
        }
        
        // Calculate scale factors between original image and canvas
        const xScaleFactor = width / img.width;
        const yScaleFactor = height / img.height;
        setScaleFactor({ x: xScaleFactor, y: yScaleFactor });
        
        // Update canvas size
        canvas.width = width;
        canvas.height = height;
        
        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Check if we have initial shapes to reload
        if (initialShapes && initialShapes.length > 0) {
          console.log('[MarkupModal] Ensuring initial shapes are loaded after canvas resize');
          
          // Ensure we don't lose shapes due to image loading after initialShapes effect
          // When displaying shapes, we need to scale the coordinates from the original image to the canvas
          const scaledShapes = initialShapes.map(shape => ({
            ...shape,
            start: {
              x: shape.start.x * xScaleFactor,
              y: shape.start.y * yScaleFactor
            },
            end: {
              x: shape.end.x * xScaleFactor,
              y: shape.end.y * yScaleFactor
            }
          }));
          
          // Use scaled shapes for display, but keep original shapes in state
          setShapes(initialShapes);
          
          // Draw the scaled shapes
          scaledShapes.forEach(shape => {
            drawShape(ctx, shape.type, shape.start, shape.end, shape.color, false);
          });
        }
      };
      
      // Handle image loading errors
      img.onerror = () => {
        console.error('[MarkupModal] Failed to load image:', imageUrl);
      };
      
      img.src = imageUrl;
    }
  }, [isOpen, imageUrl, initialShapes]);

  // Redraw everything when shapes change or selection changes
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw the image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw all shapes
      shapes.forEach(shape => {
        const isSelected = shape.id === selectedShapeId;
        drawShape(ctx, shape.type, shape.start, shape.end, shape.color, isSelected);
      });
    };
    img.src = imageUrl;
  }, [shapes, imageUrl, selectedShapeId]);

  // Calculate distance between two points
  const getDistance = (point1: { x: number, y: number }, point2: { x: number, y: number }) => {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  };

  // Check if a point is near another point (used for handle detection)
  const isNearPoint = (point: { x: number, y: number }, target: { x: number, y: number }, threshold = 10) => {
    return getDistance(point, target) <= threshold;
  };

  // Check if a point is inside a rectangle
  const isPointInRectangle = (
    point: { x: number, y: number },
    rectStart: { x: number, y: number },
    rectEnd: { x: number, y: number }
  ) => {
    const left = Math.min(rectStart.x, rectEnd.x);
    const right = Math.max(rectStart.x, rectEnd.x);
    const top = Math.min(rectStart.y, rectEnd.y);
    const bottom = Math.max(rectStart.y, rectEnd.y);
    
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  };

  // Check if a point is near a line segment
  const isPointNearLine = (
    point: { x: number, y: number },
    lineStart: { x: number, y: number },
    lineEnd: { x: number, y: number },
    threshold = 5
  ) => {
    const lengthSquared = Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2);
    if (lengthSquared === 0) return getDistance(point, lineStart) <= threshold;
    
    // Calculate projection of point onto line
    const t = Math.max(0, Math.min(1, (
      (point.x - lineStart.x) * (lineEnd.x - lineStart.x) + 
      (point.y - lineStart.y) * (lineEnd.y - lineStart.y)
    ) / lengthSquared));
    
    const projection = {
      x: lineStart.x + t * (lineEnd.x - lineStart.x),
      y: lineStart.y + t * (lineEnd.y - lineStart.y)
    };
    
    return getDistance(point, projection) <= threshold;
  };

  // Check if a point is near a circle's perimeter
  const isPointNearCircle = (
    point: { x: number, y: number },
    center: { x: number, y: number },
    radius: number,
    threshold = 5
  ) => {
    const distance = getDistance(point, center);
    return Math.abs(distance - radius) <= threshold;
  };

  // Find shape at a specific point
  const findShapeAtPoint = (
    point: { x: number, y: number },
    shapesToCheck = shapes.map(shape => ({
      ...shape,
      start: {
        x: shape.start.x * scaleFactor.x,
        y: shape.start.y * scaleFactor.y
      },
      end: {
        x: shape.end.x * scaleFactor.x,
        y: shape.end.y * scaleFactor.y
      }
    }))
  ) => {
    // Check if we're near a handle of the selected shape first
    if (selectedShapeId) {
      const selectedShape = shapesToCheck.find(s => s.id === selectedShapeId);
      if (selectedShape) {
        // Check all handles based on shape type
        if (selectedShape.type === 'rectangle') {
          // Use direct start/end points for corner detection
          // This approach is simple and matches the resize handling
          if (isNearPoint(point, selectedShape.start)) 
            return { id: selectedShapeId, dragMode: 'resize-nw' as const };
          if (isNearPoint(point, { x: selectedShape.end.x, y: selectedShape.start.y })) 
            return { id: selectedShapeId, dragMode: 'resize-ne' as const };
          if (isNearPoint(point, { x: selectedShape.start.x, y: selectedShape.end.y })) 
            return { id: selectedShapeId, dragMode: 'resize-sw' as const };
          if (isNearPoint(point, selectedShape.end)) 
            return { id: selectedShapeId, dragMode: 'resize-se' as const };
        } 
        else if (selectedShape.type === 'line' || selectedShape.type === 'arrow') {
          // Check endpoints
          if (isNearPoint(point, selectedShape.start)) 
            return { id: selectedShapeId, dragMode: 'resize-start' as const };
          if (isNearPoint(point, selectedShape.end)) 
            return { id: selectedShapeId, dragMode: 'resize-end' as const };
        } 
        else if (selectedShape.type === 'ellipse') {
          // Get ellipse dimensions
          const rx = Math.abs(selectedShape.end.x - selectedShape.start.x);
          const ry = Math.abs(selectedShape.end.y - selectedShape.start.y);
          const centerX = selectedShape.start.x;
          const centerY = selectedShape.start.y;
          
          // Check cardinal points (E, W, N, S) for resizing with specific directions
          // East point - only modify width
          if (isNearPoint(point, { x: centerX + rx, y: centerY })) 
            return { id: selectedShapeId, dragMode: 'resize-e' as const };
          // West point - only modify width
          if (isNearPoint(point, { x: centerX - rx, y: centerY })) 
            return { id: selectedShapeId, dragMode: 'resize-w' as const };
          // North point - only modify height
          if (isNearPoint(point, { x: centerX, y: centerY - ry })) 
            return { id: selectedShapeId, dragMode: 'resize-n' as const };
          // South point - only modify height
          if (isNearPoint(point, { x: centerX, y: centerY + ry })) 
            return { id: selectedShapeId, dragMode: 'resize-s' as const };
          
          // Check if clicked near center for moving
          if (isNearPoint(point, { x: centerX, y: centerY }, 15)) 
            return { id: selectedShapeId, dragMode: 'move' as const };
        }
      }
    }
    
    // Then check if we can select any shape by clicking directly on it
    for (let i = shapesToCheck.length - 1; i >= 0; i--) {
      const shape = shapesToCheck[i];
      
      if (shape.type === 'rectangle') {
        if (isPointInRectangle(point, shape.start, shape.end)) {
          return { id: shape.id, dragMode: 'move' as const };
        }
      } 
      else if (shape.type === 'line' || shape.type === 'arrow') {
        if (isPointNearLine(point, shape.start, shape.end)) {
          return { id: shape.id, dragMode: 'move' as const };
        }
      } 
      else if (shape.type === 'ellipse') {
        if (isPointInEllipse(point, shape.start, shape.end)) {
          return { id: shape.id, dragMode: 'move' as const };
        }
      }
    }
    
    return null;
  };
  
  // Check if a point is inside an ellipse
  const isPointInEllipse = (
    point: { x: number, y: number },
    center: { x: number, y: number },
    endPoint: { x: number, y: number },
    threshold = 5
  ) => {
    const rx = Math.abs(endPoint.x - center.x);
    const ry = Math.abs(endPoint.y - center.y);
    
    if (rx === 0 || ry === 0) return false;
    
    // Normalized equation of ellipse: (x-h)²/a² + (y-k)²/b² <= 1
    const normalized = Math.pow(point.x - center.x, 2) / Math.pow(rx, 2) + 
                      Math.pow(point.y - center.y, 2) / Math.pow(ry, 2);
                      
    return normalized <= 1 + threshold/Math.min(rx, ry);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickPoint = { x, y };
    
    // If select tool is active or we're trying to select a shape
    if (tool === 'select') {
      // Convert clickPoint to scaled coordinates for shape detection
      const scaledClickPoint = {
        x: clickPoint.x,
        y: clickPoint.y
      };
      
      // We need to find shapes using the scaled coordinates
      const displayShapes = shapes.map(shape => ({
        ...shape,
        start: {
          x: shape.start.x * scaleFactor.x,
          y: shape.start.y * scaleFactor.y
        },
        end: {
          x: shape.end.x * scaleFactor.x,
          y: shape.end.y * scaleFactor.y
        }
      }));
      
      const result = findShapeAtPoint(scaledClickPoint, displayShapes);
      
      if (result) {
        // Found a shape or handle, set up for dragging
        setSelectedShapeId(result.id);
        setDragMode(result.dragMode);
        
        // Calculate offset for moving or resizing
        const shape = displayShapes.find(s => s.id === result.id);
        if (shape) {
          if (result.dragMode === 'move') {
            // For all shape types, store offset from click point to shape start
            // in canvas coordinates
            const scaledStart = {
              x: shape.start.x,
              y: shape.start.y
            };
            
            setDragOffset({
              x: clickPoint.x - scaledStart.x,
              y: clickPoint.y - scaledStart.y
            });
          } else {
            // For resizing, just reset the offset
            setDragOffset({ x: 0, y: 0 });
          }
        }
        
        setDrawing(true);
      } else {
        // Clicked empty space, deselect
        setSelectedShapeId(null);
      }
    } else {
      // Drawing a new shape
      setDrawing(true);
      // Store unscaled start position (will convert to original image coordinates when saving)
      setStartPos({ x, y });
      setSelectedShapeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const currentPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // If we're dragging a shape
    if (drawing && selectedShapeId) {
      // We need to get the shape in display coordinates
      const displayShapes = shapes.map(shape => ({
        ...shape,
        start: {
          x: shape.start.x * scaleFactor.x,
          y: shape.start.y * scaleFactor.y
        },
        end: {
          x: shape.end.x * scaleFactor.x,
          y: shape.end.y * scaleFactor.y
        }
      }));
      
      const selectedDisplayShape = displayShapes.find(s => s.id === selectedShapeId);
      if (!selectedDisplayShape) return;

      const updatedShapes = shapes.map(shape => {
        if (shape.id !== selectedShapeId) return shape;
        
        // Clone the original shape to modify
        const updatedShape = { 
          ...shape,
          start: { ...shape.start },
          end: { ...shape.end }
        };
        
        if (dragMode === 'move') {
          // Calculate the new position in canvas coordinates
          const newCanvasX = currentPos.x - dragOffset.x;
          const newCanvasY = currentPos.y - dragOffset.y;
          
          // Convert to original image coordinates
          const newImageX = newCanvasX / scaleFactor.x;
          const newImageY = newCanvasY / scaleFactor.y;
          
          if (shape.type === 'ellipse') {
            // Store the distance from start to end for the ellipse
            const dx = shape.end.x - shape.start.x;
            const dy = shape.end.y - shape.start.y;
            
            // Update start point (center of ellipse)
            updatedShape.start = {
              x: newImageX,
              y: newImageY
            };
            
            // Maintain the same radius by keeping the same distance from start to end
            updatedShape.end = {
              x: newImageX + dx,
              y: newImageY + dy
            };
          } 
          else if (shape.type === 'rectangle' || shape.type === 'line' || shape.type === 'arrow') {
            // For rectangles, lines, and arrows, move by the delta in original image coordinates
            const deltaX = (newImageX - shape.start.x);
            const deltaY = (newImageY - shape.start.y);
            
            updatedShape.start = {
              x: shape.start.x + deltaX,
              y: shape.start.y + deltaY
            };
            
            updatedShape.end = {
              x: shape.end.x + deltaX,
              y: shape.end.y + deltaY
            };
          }
        } 
        else if (dragMode && dragMode.startsWith('resize-')) {
          // Convert current position to image coordinates for proper scaling
          const currentPosInImageCoords = {
            x: currentPos.x / scaleFactor.x,
            y: currentPos.y / scaleFactor.y
          };
          
          if (shape.type === 'rectangle') {
            // Simplified approach: directly update the point based on resize mode
            // without complex orientation checks
            switch (dragMode) {
              case 'resize-nw':
                updatedShape.start = { ...currentPosInImageCoords };
                break;
              case 'resize-ne':
                updatedShape.start = { 
                  x: updatedShape.start.x,
                  y: currentPosInImageCoords.y 
                };
                updatedShape.end = { 
                  x: currentPosInImageCoords.x,
                  y: updatedShape.end.y 
                };
                break;
              case 'resize-sw':
                updatedShape.start = { 
                  x: currentPosInImageCoords.x,
                  y: updatedShape.start.y 
                };
                updatedShape.end = { 
                  x: updatedShape.end.x,
                  y: currentPosInImageCoords.y 
                };
                break;
              case 'resize-se':
                updatedShape.end = { ...currentPosInImageCoords };
                break;
            }
          }
          else if (shape.type === 'line' || shape.type === 'arrow') {
            if (dragMode === 'resize-start') {
              updatedShape.start = { ...currentPosInImageCoords };
            } else {
              updatedShape.end = { ...currentPosInImageCoords };
            }
          }
          else if (shape.type === 'ellipse') {
            // Update based on which cardinal direction is being manipulated
            // This allows for more precise control over width and height
            switch (dragMode) {
              case 'resize-end':
                // Free-form resizing in any direction
                updatedShape.end = { ...currentPosInImageCoords };
                break;
              case 'resize-e': // East - only change x (width)
                updatedShape.end = {
                  x: currentPosInImageCoords.x,
                  y: updatedShape.end.y
                };
                break;
              case 'resize-w': // West - only change x (width)
                updatedShape.end = {
                  x: 2 * shape.start.x - currentPosInImageCoords.x,
                  y: updatedShape.end.y
                };
                break;
              case 'resize-n': // North - only change y (height)
                updatedShape.end = {
                  x: updatedShape.end.x,
                  y: 2 * shape.start.y - currentPosInImageCoords.y
                };
                break;
              case 'resize-s': // South - only change y (height)
                updatedShape.end = {
                  x: updatedShape.end.x,
                  y: currentPosInImageCoords.y
                };
                break;
            }
          }
        }
        
        return updatedShape;
      });
      
      // When updating shapes, use the debounced version:
      debouncedSetShapes(updatedShapes);
    } 
    else if (drawing && tool !== 'select') {
      // We're drawing a new shape
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Redraw everything
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Draw all saved shapes in their scaled form
        shapes.forEach(shape => {
          const isSelected = shape.id === selectedShapeId;
          const scaledShape = {
            ...shape,
            start: {
              x: shape.start.x * scaleFactor.x,
              y: shape.start.y * scaleFactor.y
            },
            end: {
              x: shape.end.x * scaleFactor.x,
              y: shape.end.y * scaleFactor.y
            }
          };
          drawShape(ctx, scaledShape.type, scaledShape.start, scaledShape.end, scaledShape.color, isSelected);
        });
        
        // Draw the current shape being drawn
        drawShape(ctx, tool, startPos, currentPos, color, false);
      };
      img.src = imageUrl;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    
    if (tool !== 'select') {
      // Finishing drawing a new shape
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const endPosDisplay = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // Convert canvas coordinates to original image coordinates
      const startOriginal = {
        x: startPos.x / scaleFactor.x,
        y: startPos.y / scaleFactor.y
      };
      
      const endOriginal = {
        x: endPosDisplay.x / scaleFactor.x,
        y: endPosDisplay.y / scaleFactor.y
      };
    
      // Add the new shape to the shapes array using original image coordinates
      const newShapeId = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setShapes([...shapes, {
        id: newShapeId,
        type: tool,
        start: startOriginal,
        end: endOriginal,
        color
      }]);
      
      // Select the newly created shape
      setSelectedShapeId(newShapeId);
    }
    
    setDrawing(false);
    setDragMode(null);
  };

  // Add useEffect to redraw canvas when shapes or selected shape changes
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let mounted = true;
    
    const img = new Image();
    img.onload = () => {
      if (!mounted) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw all shapes with scaling applied
      shapes.forEach(shape => {
        if (!mounted) return;
        const isSelected = shape.id === selectedShapeId;
        const scaledShape = {
          ...shape,
          start: {
            x: shape.start.x * scaleFactor.x,
            y: shape.start.y * scaleFactor.y
          },
          end: {
            x: shape.end.x * scaleFactor.x,
            y: shape.end.y * scaleFactor.y
          }
        };
        drawShape(ctx, scaledShape.type, scaledShape.start, scaledShape.end, scaledShape.color, isSelected);
      });
    };
    img.src = imageUrl;
    
    // Cleanup function to prevent updates after unmounting
    return () => {
      mounted = false;
    };
  }, [shapes, selectedShapeId, isOpen, imageUrl, scaleFactor]);

  // Update touch handlers to match the mouse handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling/zooming
    if (!canvasRef.current || e.touches.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const touchPoint = { x, y };
    
    // If select tool is active
    if (tool === 'select') {
      // Convert touchPoint to scaled coordinates for shape detection
      const scaledTouchPoint = {
        x: touchPoint.x,
        y: touchPoint.y
      };
      
      // We need to find shapes using the scaled coordinates
      const displayShapes = shapes.map(shape => ({
        ...shape,
        start: {
          x: shape.start.x * scaleFactor.x,
          y: shape.start.y * scaleFactor.y
        },
        end: {
          x: shape.end.x * scaleFactor.x,
          y: shape.end.y * scaleFactor.y
        }
      }));
      
      const result = findShapeAtPoint(scaledTouchPoint, displayShapes);
      
      if (result) {
        // Found a shape or handle, set up for dragging
        setSelectedShapeId(result.id);
        setDragMode(result.dragMode);
        
        // Calculate offset for moving or resizing based on the display shape
        const shape = displayShapes.find(s => s.id === result.id);
        if (shape && result.dragMode === 'move') {
          setDragOffset({
            x: touchPoint.x - shape.start.x,
            y: touchPoint.y - shape.start.y
          });
        } else {
          setDragOffset({ x: 0, y: 0 });
        }
        
        setDrawing(true);
      } else {
        setSelectedShapeId(null);
      }
    } else {
      // Drawing a new shape
      setDrawing(true);
      // Store unscaled start position (will convert to original image coordinates when saving)
      setStartPos({ x, y });
      setSelectedShapeId(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing || !canvasRef.current || e.touches.length === 0) return;
    e.preventDefault(); // Prevent scrolling while drawing
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const currentPos = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    
    // Handle touch movement similar to mouse movement
    if (selectedShapeId) {
      // We need to get the shape in display coordinates
      const displayShapes = shapes.map(shape => ({
        ...shape,
        start: {
          x: shape.start.x * scaleFactor.x,
          y: shape.start.y * scaleFactor.y
        },
        end: {
          x: shape.end.x * scaleFactor.x,
          y: shape.end.y * scaleFactor.y
        }
      }));
      
      const selectedDisplayShape = displayShapes.find(s => s.id === selectedShapeId);
      if (!selectedDisplayShape) return;
      
      const updatedShapes = shapes.map(shape => {
        if (shape.id !== selectedShapeId) return shape;
        
        // Clone the original shape to modify
        const updatedShape = { 
          ...shape,
          start: { ...shape.start },
          end: { ...shape.end }
        };
        
        // Find the display version of this shape for calculations
        const displayShape = displayShapes.find(s => s.id === shape.id);
        if (!displayShape) return shape;
        
        if (dragMode === 'move') {
          // Calculate the new position in canvas coordinates
          const newCanvasX = currentPos.x - dragOffset.x;
          const newCanvasY = currentPos.y - dragOffset.y;
          
          // Convert to original image coordinates
          const newImageX = newCanvasX / scaleFactor.x;
          const newImageY = newCanvasY / scaleFactor.y;
          
          if (shape.type === 'ellipse') {
            // Store the distance from start to end for the ellipse
            const dx = shape.end.x - shape.start.x;
            const dy = shape.end.y - shape.start.y;
            
            // Update start point (center of ellipse)
            updatedShape.start = {
              x: newImageX,
              y: newImageY
            };
            
            // Maintain the same radius by keeping the same distance from start to end
            updatedShape.end = {
              x: newImageX + dx,
              y: newImageY + dy
            };
          } 
          else if (shape.type === 'rectangle' || shape.type === 'line' || shape.type === 'arrow') {
            // For rectangles, lines, and arrows, move by the delta in original image coordinates
            const deltaX = (newImageX - shape.start.x);
            const deltaY = (newImageY - shape.start.y);
            
            updatedShape.start = {
              x: shape.start.x + deltaX,
              y: shape.start.y + deltaY
            };
            
            updatedShape.end = {
              x: shape.end.x + deltaX,
              y: shape.end.y + deltaY
            };
          }
        } 
        // Handle resize operations here if needed
        else if (dragMode && dragMode.startsWith('resize-')) {
          // Convert current position to image coordinates for proper scaling
          const currentPosInImageCoords = {
            x: currentPos.x / scaleFactor.x,
            y: currentPos.y / scaleFactor.y
          };
          
          if (shape.type === 'rectangle') {
            // Simplified approach: directly update the point based on resize mode
            switch (dragMode) {
              case 'resize-nw':
                updatedShape.start = { ...currentPosInImageCoords };
                break;
              case 'resize-ne':
                updatedShape.start = { 
                  x: updatedShape.start.x,
                  y: currentPosInImageCoords.y 
                };
                updatedShape.end = { 
                  x: currentPosInImageCoords.x,
                  y: updatedShape.end.y 
                };
                break;
              case 'resize-sw':
                updatedShape.start = { 
                  x: currentPosInImageCoords.x,
                  y: updatedShape.start.y 
                };
                updatedShape.end = { 
                  x: updatedShape.end.x,
                  y: currentPosInImageCoords.y 
                };
                break;
              case 'resize-se':
                updatedShape.end = { ...currentPosInImageCoords };
                break;
            }
          }
          else if (shape.type === 'line' || shape.type === 'arrow') {
            if (dragMode === 'resize-start') {
              updatedShape.start = { ...currentPosInImageCoords };
            } else {
              updatedShape.end = { ...currentPosInImageCoords };
            }
          }
          else if (shape.type === 'ellipse') {
            // Update based on which cardinal direction is being manipulated
            switch (dragMode) {
              case 'resize-end':
                updatedShape.end = { ...currentPosInImageCoords };
                break;
              case 'resize-e': // East - only change x (width)
                updatedShape.end = {
                  x: currentPosInImageCoords.x,
                  y: updatedShape.end.y
                };
                break;
              case 'resize-w': // West - only change x (width)
                updatedShape.end = {
                  x: 2 * shape.start.x - currentPosInImageCoords.x,
                  y: updatedShape.end.y
                };
                break;
              case 'resize-n': // North - only change y (height)
                updatedShape.end = {
                  x: updatedShape.end.x,
                  y: 2 * shape.start.y - currentPosInImageCoords.y
                };
                break;
              case 'resize-s': // South - only change y (height)
                updatedShape.end = {
                  x: updatedShape.end.x,
                  y: currentPosInImageCoords.y
                };
                break;
            }
          }
        }
        
        return updatedShape;
      });
      
      // When updating shapes, use the debounced version:
      debouncedSetShapes(updatedShapes);
    } 
    else if (tool !== 'select') {
      // Drawing a new shape
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Draw all saved shapes in their scaled form
        shapes.forEach(shape => {
          const isSelected = shape.id === selectedShapeId;
          const scaledShape = {
            ...shape,
            start: {
              x: shape.start.x * scaleFactor.x,
              y: shape.start.y * scaleFactor.y
            },
            end: {
              x: shape.end.x * scaleFactor.x,
              y: shape.end.y * scaleFactor.y
            }
          };
          drawShape(ctx, scaledShape.type, scaledShape.start, scaledShape.end, scaledShape.color, isSelected);
        });
        
        // Draw the current shape being drawn
        drawShape(ctx, tool, startPos, currentPos, color, false);
      };
      img.src = imageUrl;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    
    if (tool !== 'select') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      let endPosDisplay: { x: number, y: number };
      
      if (e.changedTouches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.changedTouches[0];
        endPosDisplay = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        };
      } else {
        endPosDisplay = startPos;
      }
      
      // Convert canvas coordinates to original image coordinates
      const startOriginal = {
        x: startPos.x / scaleFactor.x,
        y: startPos.y / scaleFactor.y
      };
      
      const endOriginal = {
        x: endPosDisplay.x / scaleFactor.x,
        y: endPosDisplay.y / scaleFactor.y
      };
      
      const newShapeId = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setShapes([...shapes, {
        id: newShapeId,
        type: tool,
        start: startOriginal,
        end: endOriginal,
        color
      }]);
      
      setSelectedShapeId(newShapeId);
    }
    
    setDrawing(false);
    setDragMode(null);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;

    try {
      console.log('[MarkupModal] Preparing to save canvas as image...');
      // Get a fresh copy of the canvas data - without selection handles
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[MarkupModal] Failed to get canvas context');
        alert('Failed to save image. Please try again.');
        return;
      }
      
      // Create a temporary copy of the canvas without selection handles
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        console.error('[MarkupModal] Failed to create temporary canvas context');
        alert('Failed to save image. Please try again.');
        return;
      }
      
      // Redraw the background image
      const img = new Image();
      img.onload = () => {
        // Draw the background image
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw all shapes WITHOUT selection handles - scale them for display
        shapes.forEach(shape => {
          const scaledShape = {
            ...shape,
            start: {
              x: shape.start.x * scaleFactor.x,
              y: shape.start.y * scaleFactor.y
            },
            end: {
              x: shape.end.x * scaleFactor.x,
              y: shape.end.y * scaleFactor.y
            }
          };
          drawShape(tempCtx, scaledShape.type, scaledShape.start, scaledShape.end, scaledShape.color, false);
        });
        
        // Convert the handle-free canvas to data URL
        const dataUrl = tempCanvas.toDataURL('image/png', 1.0);
      
        if (!dataUrl || !dataUrl.startsWith('data:image/png')) {
          console.error('[MarkupModal] Failed to generate valid data URL from canvas');
          alert('Failed to save image. Please try again.');
          return;
        }
        
        console.log('[MarkupModal] Canvas converted to data URL successfully');
        console.log('[MarkupModal] Saving shapes with coordinates relative to original image');
          
        // Save the shapes data with the image (using original image coordinates)
        onSave(dataUrl, shapes);
        onClose();
      };
      img.src = imageUrl;
    } catch (error) {
      console.error('[MarkupModal] Error saving canvas data:', error);
      alert('Failed to save markup. Please try again.');
    }
  };

  const handleUndo = () => {
    if (shapes.length === 0) return;
    
    if (selectedShapeId === shapes[shapes.length - 1].id) {
      setSelectedShapeId(null);
    }
    
    setShapes(shapes.slice(0, -1));
  };

  const handleDeleteSelected = () => {
    if (!selectedShapeId) return;
    
    setShapes(shapes.filter(shape => shape.id !== selectedShapeId));
    setSelectedShapeId(null);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center z-[1100] hover:bg-gray-300"
        onClick={e => { e.stopPropagation(); onClose(); }}
        title="Close"
      >
        ×
      </button>
      <div 
        className="mb-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 flex items-center gap-2 shadow-md"
        onClick={handleContentClick}
      >
        <div className="flex items-center space-x-2 ml-auto">
          <div className="flex bg-white p-1.5 rounded-md shadow-sm space-x-1">
            <button 
              className={`p-1.5 rounded-md ${tool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'} transition-colors duration-200`}
              onClick={(e) => { e.stopPropagation(); setTool('select'); }}
              title="Select & Move"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3,3 L10.5,20 L13.5,12 L21,9 L3,3z" />
              </svg>
            </button>
            <button 
              className={`p-1.5 rounded-md ${tool === 'ellipse' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'} transition-colors duration-200`}
              onClick={(e) => { e.stopPropagation(); setTool('ellipse'); }}
              title="Ellipse"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
              </svg>
            </button>
            <button 
              className={`p-1.5 rounded-md ${tool === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'} transition-colors duration-200`}
              onClick={(e) => { e.stopPropagation(); setTool('rectangle'); }}
              title="Rectangle"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button 
              className={`p-1.5 rounded-md ${tool === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'} transition-colors duration-200`}
              onClick={(e) => { e.stopPropagation(); setTool('line'); }}
              title="Line"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button 
              className={`p-1.5 rounded-md ${tool === 'arrow' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'} transition-colors duration-200`}
              onClick={(e) => { e.stopPropagation(); setTool('arrow'); }}
              title="Arrow"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
          
          <div className="flex items-center bg-white p-1.5 rounded-md shadow-sm space-x-2">
            <label className="text-xs font-medium text-gray-700">Color:</label>
            <div className="relative">
              <input 
                type="color" 
                value={color} 
                onChange={(e) => { e.stopPropagation(); setColor(e.target.value); }}
                className="w-7 h-7 cursor-pointer rounded-md border border-gray-300"
              />
              <div 
                className="absolute -right-1 -top-1 w-3 h-3 rounded-full border-2 border-white" 
                style={{ backgroundColor: color }}
              ></div>
            </div>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-md shadow-sm space-x-1">
            <button 
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => { e.stopPropagation(); handleUndo(); }}
              title="Undo"
              disabled={shapes.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14l-4-4 4-4"/>
                <path d="M5 10h11a4 4 0 0 1 0 8h-1"/>
              </svg>
            </button>
            {selectedShapeId && (
              <button 
                className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
                title="Delete Selected"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
          
          <button 
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200 flex items-center space-x-1"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span>Cancel</span>
          </button>
          
          <button 
            className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-1"
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Save</span>
          </button>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setDrawing(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => setDrawing(false)}
        className="bg-white cursor-crosshair"
        onClick={handleContentClick}
      />
    </div>
  );
};

interface StepsTabProps {
  tutorialId?: string;
  realtimeSteps?: any[]; // Add this prop to accept realtime steps from App component
}

export const StepsTab: React.FC<StepsTabProps> = ({ tutorialId, realtimeSteps = [] }) => {
  const steps = useStepsStore((state) => state.steps);
  const addStoreStep = useStepsStore((state) => state.addStep);
  const setStoreSteps = useStepsStore((state) => state.setSteps);
  const updateStoreStep = useStepsStore((state) => state.updateStep);
  const deleteStoreStep = useStepsStore((state) => state.deleteStep);
  const setStoreLoading = useStepsStore((state) => state.setLoading);
  const clearStoreSteps = useStepsStore((state) => state.clearSteps);
  const storeIsLoading = useStepsStore((state) => state.isLoading);
  // Get shape data functions from store
  const saveShapesForImage = useStepsStore((state) => state.saveShapesForImage);
  const getShapesForImage = useStepsStore((state) => state.getShapesForImage);
  
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isMarkupModalOpen, setIsMarkupModalOpen] = useState(false);
  const [markupShapes, setMarkupShapes] = useState<Array<{
    id: string;
    type: 'ellipse' | 'arrow' | 'line' | 'rectangle';
    start: { x: number, y: number };
    end: { x: number, y: number };
    color: string;
  }>>([]);

  const stepRepository = StepRepository.getInstance();
  
  // Calculate final loading state
  const isLoading = storeIsLoading || localIsLoading;

  // Load an image as a data URL and cache it
  const loadImageAsDataUrl = useCallback(async (imagePath: string) => {
    try {
      if (!imagePath || imageCache[imagePath]) return;
      
      console.log(`[StepsTab] Loading image as data URL: ${imagePath}`);
      const dataUrl = await window.electronAPI.loadImageAsDataUrl(imagePath);
      
      if (dataUrl) {
        setImageCache(prev => ({
          ...prev,
          [imagePath]: dataUrl
        }));
        console.log(`[StepsTab] Successfully loaded image: ${imagePath.substring(0, 50)}...`);
      } else {
        console.error(`[StepsTab] Failed to load image: ${imagePath}`);
      }
    } catch (error) {
      console.error('[StepsTab] Error loading image as data URL:', error);
    }
  }, [imageCache]);
  
  // Function to look up shapes for a specific image
  // Now just use the store function directly, no need for a wrapper
  
  const openMarkupModal = useCallback(async (imagePath: string, stepId: string) => {
    if (imageCache[imagePath]) {
      setModalImage(imageCache[imagePath]);
      
      try {
        // First get existing shapes from store
        const existingShapes = getShapesForImage(imagePath, stepId);
        console.log(`[Markup] Loading markup modal for image: ${imagePath} and step: ${stepId}`);
        console.log(`[Markup] Found ${existingShapes.length} existing shapes in store`);
        
        // Then try to load shapes from JSON file if available
        const jsonShapes = await window.electronAPI.loadShapesFromJson(imagePath);
        console.log(`[Markup] Loaded ${jsonShapes?.length || 0} shapes from JSON file`);
        
        // Combine both sources of shapes
        const combinedShapes = [...existingShapes];
        
        // Add JSON shapes if not already in existingShapes (avoid duplicates)
        if (jsonShapes && jsonShapes.length > 0) {
          // Check each JSON shape and add if it's not already in store
          jsonShapes.forEach((jsonShape: any) => {
            // Check if this shape is already in existingShapes by ID
            const alreadyExists = existingShapes.some((storeShape: any) => 
              storeShape.id === jsonShape.id
            );
            
            if (!alreadyExists) {
              combinedShapes.push(jsonShape);
            }
          });
        }
        
        console.log(`[Markup] Combined ${combinedShapes.length} shapes total`);
        if (combinedShapes.length > 0) {
          console.log('[Markup] Shape details:', JSON.stringify(combinedShapes[0], null, 2));
        }
        
        setMarkupShapes(combinedShapes);
        setIsMarkupModalOpen(true);
      } catch (error) {
        console.error('[Markup] Error loading shapes:', error);
        // Still open modal even if shape loading fails
        setMarkupShapes(getShapesForImage(imagePath, stepId));
        setIsMarkupModalOpen(true); 
      }
    }
  }, [imageCache, getShapesForImage]);

  const closeMarkupModal = useCallback(() => {
    setIsMarkupModalOpen(false);
    setModalImage(null);
    // Clear markup shapes to prevent them from being reused in another step
    setMarkupShapes([]);
    console.log('[Markup] Modal closed, shape state cleared');
  }, []);

  const handleSaveMarkup = useCallback(async (modifiedImageUrl: string, shapeData: any[], stepId: string) => {
    try {
      console.log(`[Markup] Saving markup for step ${stepId}`);
      console.log(`[Markup] ${shapeData.length} shapes to save`);
      console.log(`[Markup] Shape data example:`, shapeData.length > 0 ? JSON.stringify(shapeData[0]) : 'none');

      if (!stepId) {
        console.error('[Markup] Cannot save markup: Missing stepId');
        return;
      }

      // Get step details first
      const step = steps.find(s => s.originalId === stepId);
      if (!step) {
        console.error(`[Markup] Cannot find step with ID ${stepId} in steps list`);
        return;
      }

      if (!step.screenshotPath) {
        console.error(`[Markup] Step ${stepId} has no screenshot path`);
        return;
      }

      console.log(`[Markup] Found step with screenshotPath: ${step.screenshotPath}`);

      // Make a deep copy of the step for in-memory manipulation
      const stepInMemory = JSON.parse(JSON.stringify(step));
        
      // First ensure shapes are saved to the database for persistence
      try {
        console.log(`[Markup] Saving shapes to database for step ${stepId} and image ${stepInMemory.screenshotPath}`);
        console.log(`[Markup] Shapes to save (types):`, JSON.stringify(shapeData.map(s => ({ type: s.type, color: s.color }))));
        
        // Add stepId to each shape
        const shapesWithStepId = shapeData.map(shape => ({
          ...shape,
          stepId: stepId,
          imagePath: stepInMemory.screenshotPath // Ensure imagePath is set properly
        }));
        
        console.log(`[Markup] Sending shapes to saveShapes API:`, JSON.stringify(shapesWithStepId.map(s => ({ 
          id: s.id, 
          stepId: s.stepId, 
          imagePath: s.imagePath, 
          type: s.type 
        }))));
        
        const savedShapes = await window.electronAPI.saveShapes(stepId, stepInMemory.screenshotPath, shapesWithStepId);
        console.log(`[Markup] Shape data saved to database: ${savedShapes.length} shapes`);
        console.log(`[Markup] Saved shapes sample:`, savedShapes.length > 0 ? JSON.stringify(savedShapes[0]) : 'none');
        
        // Convert shapes from database format to store format
        const storeShapes = savedShapes.map(shape => ({
          id: shape.id || `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: shape.type,
          start: shape.start,
          end: shape.end,
          color: shape.color
        }));
        
        // Then update the memory store with the saved shapes (which now have IDs from the database)
        console.log(`[Markup] Saving ${storeShapes.length} shapes to store for path: ${stepInMemory.screenshotPath}`);
        saveShapesForImage(stepInMemory.screenshotPath, storeShapes, stepId);
        console.log(`[Markup] Shape data saved in memory for ${stepInMemory.screenshotPath}`);
        
        // Verify data is in store
        const storedShapes = getShapesForImage(stepInMemory.screenshotPath, stepId);
        console.log(`[Markup] Verified ${storedShapes.length} shapes in store for ${stepInMemory.screenshotPath}`);
        
        // Verify data is in database with a separate query
        const verifyShapes = await window.electronAPI.getShapesByImage(stepInMemory.screenshotPath, stepId);
        console.log(`[Markup] Verification: ${verifyShapes.length} shapes found in database after save (should match ${savedShapes.length})`);
        if (verifyShapes.length === 0) {
          console.error('[Markup] CRITICAL: No shapes were found in the database after save! This indicates a database save failure.');
        }
      } catch (error) {
        console.error('[Markup] Error saving shapes to database:', error);
        // Save to memory as fallback even if database fails
        const storeShapes = shapeData.map(shape => ({
          id: shape.id || `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: shape.type,
          start: shape.start,
          end: shape.end,
          color: shape.color
        }));
        console.log(`[Markup] Falling back to memory-only save for ${storeShapes.length} shapes`);
        saveShapesForImage(stepInMemory.screenshotPath, storeShapes, stepId);
        console.log(`[Markup] Shape data saved to memory only (database failed)`);
      }

      // Update step with modified image URL if provided and differs from original
      if (modifiedImageUrl) {
        console.log(`[Markup] Image was modified, but we only store shapes separately`);
      }

      // Close the modal after saving
      setIsMarkupModalOpen(false);
      setMarkupShapes([]);

    } catch (error) {
      console.error('[Markup] Error in handle save markup:', error);
    }
  }, [steps, saveShapesForImage, getShapesForImage]);
  
  // Load steps for the tutorial when tutorialId changes
  useEffect(() => {
    if (!tutorialId) {
      console.log('[StepsTab] No tutorialId provided, skipping load');
      return;
    }
    
    console.log(`[StepsTab] Tutorial ID changed to: ${tutorialId}, loading steps...`);
    
    // Clear current state before loading new data
    setSelectedStepId(null);
    setImageCache({});
    setModalImage(null);
    setIsMarkupModalOpen(false);
    setMarkupShapes([]);
    clearStoreSteps();
    useStepsStore.getState().clearImageShapeData();
    
    // Load steps for this tutorial
    loadStepsForTutorial(tutorialId);
  }, [tutorialId, clearStoreSteps]);
  
  // Add event listener for shape data requests from ExportTab
  useEffect(() => {
    const handleShapeDataRequest = async (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.tutorialId === tutorialId && tutorialId) {
        console.log(`[StepsTab] Received request for shape data for tutorial ${tutorialId}`);
        
        try {
          // Get the shape data from the store
          const imageShapeData = useStepsStore.getState().imageShapeData;
          
          // Send the shape data to the main process for export
          await window.electronAPI.exportPrepareShapes(tutorialId, imageShapeData);
          console.log(`[StepsTab] Sent shape data to main process for export`);
        } catch (error) {
          console.error('[StepsTab] Error sending shape data for export:', error);
        }
      }
    };

    // Add event listener
    document.addEventListener('request-shape-data', handleShapeDataRequest);

    // Clean up
    return () => {
      document.removeEventListener('request-shape-data', handleShapeDataRequest);
    };
  }, [tutorialId]);
  
  // Function to load steps for a tutorial
  const loadStepsForTutorial = async (tutorialId: string) => {
    try {
      // Set loading states
      setLocalIsLoading(true);
      setStoreLoading(true);
      setLoadError(null);
      
      console.log(`[StepsTab] ===== LOADING STEPS FOR TUTORIAL: ${tutorialId} =====`);
      
      // Clear existing steps in the store BEFORE loading new ones
      clearStoreSteps();
      console.log('[StepsTab] Cleared existing steps from store');
      
      // Clear any shapes from store to ensure clean state before loading new shapes
      console.log('[StepsTab] Clearing existing shapes from store to ensure clean state');
      useStepsStore.getState().clearImageShapeData();
      
      // Get steps from the repository
      const steps = await stepRepository.loadStepsForTutorial(tutorialId);
      
      console.log(`[StepsTab] Loaded ${steps.length} steps from database for tutorial ${tutorialId}`);
      if (steps.length > 0) {
        console.log('[StepsTab] First step sample:', JSON.stringify({
          id: steps[0].id,
          order: steps[0].order,
          screenshotPath: steps[0].screenshotPath
        }));
      }
      
      // Add all loaded steps to the store
      if (steps.length > 0) {
        // Process steps for display
        const displaySteps = steps.map((step, index) => {
          // Parse actionText for title and description
          let title = `Step ${index + 1}`;
          let description = '';
          
          if (step.actionText) {
            // Check if actionText has our title/description format
            const titleMatch = step.actionText.match(/^\[TITLE\](.*?)(\[DESC\]|$)/s);
            if (titleMatch && titleMatch[1].trim()) {
              title = titleMatch[1].trim();
              
              // Check for description part
              const descMatch = step.actionText.match(/\[DESC\](.*?)$/s);
              if (descMatch && descMatch[1].trim()) {
                description = descMatch[1].trim();
              }
            } else {
              // No formatted title found, use actionText as description
              description = step.actionText;
            }
          }
          
          return {
            displayId: index + 1,
            originalId: step.id || `step_${Date.now()}_${index}`,
            title: title,
            description: description,
            screenshotPath: step.screenshotPath
          };
        });
        
        // Set all steps in one batch
        setStoreSteps(displaySteps);
        
        console.log(`[StepsTab] Added ${displaySteps.length} steps to store`);
        
        // Count shapes already in store
        let totalShapesInStore = 0;
        Object.keys(useStepsStore.getState().imageShapeData).forEach(path => {
          totalShapesInStore += useStepsStore.getState().imageShapeData[path]?.length || 0;
        });
        console.log(`[StepsTab] Current shapes in store before loading: ${totalShapesInStore}`);
        
        // Load screenshots and shapes for all steps
        const shapeLoadPromises = steps.map(async (step) => {
          if (step.screenshotPath) {
            // Load screenshot
            loadImageAsDataUrl(step.screenshotPath);
            
            try {
              console.log(`[StepsTab] Loading shapes for image: ${step.screenshotPath} and step: ${step.id}`);
              // Load shapes from database with step ID to filter by specific step
              const dbShapes = await window.electronAPI.getShapesByImage(step.screenshotPath, step.id);
              
              // Also load shapes from JSON file if available
              let jsonShapes: any[] = [];
              try {
                jsonShapes = await window.electronAPI.loadShapesFromJson(step.screenshotPath);
                console.log(`[StepsTab] Loaded ${jsonShapes.length} shapes from JSON file for: ${step.screenshotPath}`);
              } catch (jsonError) {
                console.error(`[StepsTab] Error loading shapes from JSON:`, jsonError);
              }
              
              // Combine shapes from both sources
              const combinedShapes = [...dbShapes];
              
              // Add JSON shapes if not already in database shapes (avoid duplicates)
              if (jsonShapes && jsonShapes.length > 0) {
                jsonShapes.forEach((jsonShape: any) => {
                  const alreadyExists = dbShapes.some((dbShape: any) => 
                    dbShape.id === jsonShape.id
                  );
                  
                  if (!alreadyExists) {
                    combinedShapes.push(jsonShape);
                  }
                });
              }
              
              const totalShapes = combinedShapes.length;
              console.log(`[StepsTab] Combined ${totalShapes} shapes (${dbShapes.length} from DB + ${jsonShapes.length} from JSON) for: ${step.screenshotPath}`);
              
              if (combinedShapes.length > 0 && step.id) {
                console.log(`[StepsTab] First shape sample:`, JSON.stringify(combinedShapes[0]));
                
                // Convert to store format to ensure IDs are always strings
                const storeShapes = combinedShapes.map((shape: any) => ({
                  id: shape.id || `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                  type: shape.type,
                  start: shape.start,
                  end: shape.end,
                  color: shape.color
                }));
                
                // Save to memory store
                saveShapesForImage(step.screenshotPath, storeShapes, step.id);
                console.log(`[StepsTab] Saved ${storeShapes.length} shapes to memory store for image: ${step.screenshotPath}`);
                
                // Verify shapes were saved
                const storedShapes = getShapesForImage(step.screenshotPath, step.id);
                console.log(`[StepsTab] Verified ${storedShapes.length} shapes in store for image: ${step.screenshotPath}`);
                
                return storedShapes.length;
              } else {
                console.log(`[StepsTab] No shapes found for image: ${step.screenshotPath}${step.id ? ` and step: ${step.id}` : ''}`);
                return 0;
              }
            } catch (error) {
              console.error(`[StepsTab] Error loading shapes for ${step.screenshotPath}:`, error);
              return 0;
            }
          }
          return 0;
        });
        
        // Wait for all shapes to be loaded
        const shapeCounts = await Promise.all(shapeLoadPromises);
        const totalShapes = shapeCounts.reduce((sum, count) => sum + count, 0);
        console.log(`[StepsTab] Loaded a total of ${totalShapes} shapes for ${steps.length} steps`);
        
        // Count shapes now in store
        let newTotalShapesInStore = 0;
        Object.keys(useStepsStore.getState().imageShapeData).forEach(path => {
          newTotalShapesInStore += useStepsStore.getState().imageShapeData[path]?.length || 0;
        });
        console.log(`[StepsTab] Current shapes in store after loading: ${newTotalShapesInStore}`);
      } else {
        console.log(`[StepsTab] No steps found for tutorial ${tutorialId}`);
      }
      
      console.log(`[StepsTab] ===== FINISHED LOADING STEPS FOR TUTORIAL: ${tutorialId} =====`);
    } catch (error) {
      console.error('[StepsTab] Error loading steps:', error);
      setLoadError('Failed to load steps. Please try again.');
    } finally {
      setLocalIsLoading(false);
      setStoreLoading(false);
    }
  };

  // Get the currently selected step
  const selectedStep = steps.find(step => step.originalId === selectedStepId);

  // Image modal functions
  const openImageModal = (imagePath: string | undefined) => {
    if (!imagePath) return;
    setModalImage(imagePath);
  };

  const closeImageModal = () => {
    setModalImage(null);
  };

  const handleOpenImage = useCallback((screenshotPath: string | undefined) => {
    if (screenshotPath && imageCache[screenshotPath]) {
      openImageModal(screenshotPath);
    }
  }, [imageCache]);

  // Missing step management functions
  const addStep = async () => {
    if (!tutorialId) {
      alert('Please select a tutorial first');
      return;
    }
    
    try {
      const stepNumber = steps.length + 1;
      const defaultTitle = `Step ${stepNumber}`;
      
      // Create a new step with default values
      const newStep = {
        tutorialId,
        order: stepNumber,
        screenshotPath: '',
        actionText: `[TITLE]${defaultTitle}[DESC]`,
        timestamp: new Date().toISOString(),
      };
      
      // Save to database
      const savedStep = await window.electronAPI.saveStep(newStep);
      
      // Update local store - RecordingStep format for store
      addStoreStep({
        id: savedStep.id || '',
        number: savedStep.order,
        timestamp: savedStep.timestamp,
        screenshotPath: savedStep.screenshotPath,
        mousePosition: savedStep.mousePosition || { x: 0, y: 0 },
        windowTitle: savedStep.windowTitle || '',
        description: '',
        keyboardShortcut: savedStep.keyboardShortcut,
        // Note: The title will be handled by the store state mapping
      });
      
      // Select the new step
      if (savedStep.id) {
        setSelectedStepId(savedStep.id);
      }
    } catch (error) {
      console.error('Error adding step:', error);
      alert('Failed to add step');
    }
  };

  const moveStep = async (fromIndex: number, toIndex: number) => {
    try {
      // Get steps to reorder
      const reorderedSteps = [...steps];
      const stepToMove = reorderedSteps[fromIndex];
      
      // Remove from current position and insert at new position
      reorderedSteps.splice(fromIndex, 1);
      reorderedSteps.splice(toIndex, 0, stepToMove);
      
      // Update order property
      const updatedSteps = reorderedSteps.map((step, idx) => ({
        id: step.originalId,
        order: idx + 1
      }));
      
      // Save to database
      await window.electronAPI.reorderSteps(updatedSteps);
      
      // Reload steps to refresh order
      if (tutorialId) {
        loadStepsForTutorial(tutorialId);
      }
    } catch (error) {
      console.error('Error reordering steps:', error);
      alert('Failed to reorder steps');
    }
  };

  const deleteStep = async (stepId: string) => {
    if (!stepId) return;
    
    try {
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this step?')) {
        return;
      }
      
      // Delete from database
      await window.electronAPI.deleteStep(stepId);
      
      // Delete from store
      deleteStoreStep(stepId);
      
      // Clear selection if deleted
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
      }
    } catch (error) {
      console.error('Error deleting step:', error);
      alert('Failed to delete step');
    }
  };

  const handleStepUpdate = async (stepId: string, field: string, value: string) => {
    try {
      // Find step in store
      const step = steps.find(s => s.originalId === stepId);
      if (!step) return;
      
      // Create updated step for store
      const updatedStoreStep = {
        ...step
      };
      
      // Update field based on type
      if (field === 'title') {
        updatedStoreStep.title = value;
      } else if (field === 'description') {
        updatedStoreStep.description = value;
      }
      
      // Update store
      updateStoreStep(stepId, updatedStoreStep);
      
      // Format actionText to include title and description
      let actionText = '';
      
      if (field === 'title') {
        // Update title but keep existing description
        actionText = `[TITLE]${value}`;
        if (step.description) {
          actionText += `[DESC]${step.description}`;
        }
      } else if (field === 'description') {
        // Update description but keep existing title
        actionText = `[TITLE]${step.title || `Step ${step.displayId}`}[DESC]${value}`;
      } else {
        // No changes to title/description fields
        actionText = `[TITLE]${step.title || `Step ${step.displayId}`}`;
        if (step.description) {
          actionText += `[DESC]${step.description}`;
        }
      }
      
      // Create step for database save
      const stepToSave = {
        id: stepId,
        tutorialId: tutorialId || '',
        order: step.displayId,
        screenshotPath: step.screenshotPath || '',
        actionText: actionText,
        timestamp: new Date().toISOString(), // Use current time as we don't have original timestamp
        windowTitle: ''
      };
      
      // Save to database
      await window.electronAPI.updateStep(stepToSave);
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const handleChangeImage = async (stepId: string) => {
    try {
      // Open file dialog
      const result = await window.electronAPI.openFileDialog({
        title: 'Select Screenshot',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled || !result.filePaths.length) return;
      
      const filePath = result.filePaths[0];
      if (!filePath) return;
      
      // Find step
      const step = steps.find(s => s.originalId === stepId);
      if (!step || !tutorialId) return;
      
      // Copy file to project directory
      const newPath = await window.electronAPI.copyImageFile({
        sourcePath: filePath,
        tutorialId,
        stepId,
        makeBackup: true
      });
      
      // Create database step
      const stepToSave = {
        id: stepId,
        tutorialId,
        order: step.displayId,
        screenshotPath: newPath,
        actionText: step.description || '',
        timestamp: new Date().toISOString(),
        windowTitle: ''
      };
      
      // Save to database
      await window.electronAPI.updateStep(stepToSave);
      
      // Update store
      updateStoreStep(stepId, {
        ...step,
        screenshotPath: newPath
      });
      
      // Load image
      loadImageAsDataUrl(newPath);
    } catch (error) {
      console.error('Error changing image:', error);
      alert('Failed to change image');
    }
  };

  // Listen for step recorded notifications to refresh steps
  useEffect(() => {
    if (!tutorialId) return;
    
    console.log(`[StepsTab] Setting up step recorded notification listener for tutorial ${tutorialId}`);
    
    const handleStepRecorded = (step: any) => {
      console.log(`[StepsTab] Received step recorded notification`, step);
      // Reload steps to ensure UI is up to date
      loadStepsForTutorial(tutorialId);
    };
    
    const removeListener = window.electronAPI?.onStepCreated(handleStepRecorded);
    
    return () => {
      console.log(`[StepsTab] Removing step recorded notification listener`);
      removeListener?.();
    };
  }, [tutorialId]);

  // Process realtime steps when they come in
  useEffect(() => {
    if (!realtimeSteps.length) return;
    
    console.log(`[StepsTab] Received ${realtimeSteps.length} realtime steps`);
    
    // Only process and add new steps
    realtimeSteps.forEach(step => {
      // Convert to DisplayStep format and add to store if not already there
      addStepToStore(step);
    });
  }, [realtimeSteps]);
  
  // Helper to add a step to the store
  const addStepToStore = (step: any) => {
    if (!step || !step.id) return;
    
    // Check if we already have this step in the store
    const exists = steps.some(s => s.originalId === step.id);
    if (!exists) {
      console.log(`[StepsTab] Adding realtime step ${step.id} to store`);
      addStoreStep(step);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Main header - fixed at top */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white shadow-sm flex-shrink-0">
        <h1 className="text-lg font-medium">Edit Steps</h1>
        <button 
          onClick={addStep}
          className="px-3 py-1.5 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 flex items-center"
        >
          + Add Step
        </button>
      </div>
      
      {/* Content container with explicit height control */}
      <div className="flex flex-1 min-h-0"> {/* min-h-0 allows flex-1 to work properly on children */}
        {/* Left column - steps list */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col min-h-0"> {/* min-h-0 is crucial here */}
          {/* Removed the fixed header for left column */}
          
          {/* Scrollable steps list */}
          <div className="overflow-y-auto flex-1 bg-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-6 w-6 text-gray-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-500">Loading steps...</p>
                </div>
              </div>
            ) : loadError ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 m-4 text-red-800">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p>{loadError}</p>
                </div>
              </div>
            ) : steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Steps Found</h3>
                <p className="text-gray-500 mb-4">Get started by adding your first step to this tutorial.</p>
                <button
                  onClick={addStep}
                  className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 inline-flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add First Step
                </button>
              </div>
            ) : (
              <div className="py-2">
                {steps.map((step, index) => (
                  <div 
                    key={`step-${step.originalId}`}
                    className={`mx-2 my-1 group rounded-lg cursor-pointer transition-all duration-150 overflow-hidden
                      ${selectedStepId === step.originalId ? 'bg-white ring-2 ring-blue-500 shadow-sm' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
                    onClick={() => setSelectedStepId(step.originalId)}
                  >
                    <div className="flex items-center p-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-3
                        ${selectedStepId === step.originalId ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 group-hover:bg-gray-300'}`}>
                        {step.displayId}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className={`text-sm font-medium truncate ${selectedStepId === step.originalId ? 'text-blue-600' : 'text-gray-700'}`}>
                            {step.title || `Step ${step.displayId}`}
                          </p>
                        </div>
                        {step.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {step.description.length > 60 ? 
                              `${step.description.substring(0, 60)}...` : 
                              step.description
                            }
                          </p>
                        )}
                      </div>
                      
                      <div className={`flex space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150
                        ${selectedStepId === step.originalId ? 'opacity-100' : ''}`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); index > 0 && moveStep(index, index - 1); }}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          aria-label="Move step up"
                          disabled={index === 0}
                        >
                          <ChevronUpIcon className={`w-4 h-4 ${index === 0 ? 'opacity-50' : ''}`} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); index < steps.length - 1 && moveStep(index, index + 1); }}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          aria-label="Move step down"
                          disabled={index === steps.length - 1}
                        >
                          <ChevronDownIcon className={`w-4 h-4 ${index === steps.length - 1 ? 'opacity-50' : ''}`} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Step badge indicators */}
                    {selectedStep?.screenshotPath && getShapesForImage(selectedStep.screenshotPath, selectedStep.originalId)?.length > 0 && selectedStep.originalId === step.originalId && (
                      <div className="absolute bottom-0 right-0 bg-white/70 text-xs text-gray-700 px-1 rounded">
                        <span role="img" aria-label="Markup">✏️</span>
                        {getShapesForImage(step.screenshotPath || '', step.originalId).length} markup
                      </div>
                    )}
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        type="button"
                        className="text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-100 rounded-full p-1 shadow flex items-center justify-center"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedStepId(step.originalId);
                          if (step.screenshotPath) {
                            openMarkupModal(step.screenshotPath, step.originalId);
                          }
                        }}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        {getShapesForImage(step.screenshotPath || '', step.originalId).length > 0 && (
                          <span className="absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                            {getShapesForImage(step.screenshotPath || '', step.originalId).length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Right column - step editing */}
        <div className="w-2/3 bg-gray-50 flex flex-col min-h-0"> {/* Changed background to gray-50 for better contrast */}
          <div className="overflow-y-auto flex-1 p-6"> {/* Added padding to the container */}
            {selectedStep ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Step editor header */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <h2 className="font-medium text-gray-900 flex items-center">
                      <span className="flex h-6 w-6 bg-blue-500 text-white rounded-full items-center justify-center text-xs mr-2">
                        {selectedStep.displayId}
                      </span>
                      <input 
                        type="text" 
                        value={selectedStep.title || `Step ${selectedStep.displayId}`}
                        onChange={(e) => handleStepUpdate(selectedStep.originalId, 'title', e.target.value)}
                        className="px-2 py-1 bg-transparent hover:bg-gray-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent focus:border-blue-500 rounded text-lg font-medium text-gray-900 min-w-[200px]"
                        placeholder={`Step ${selectedStep.displayId}`}
                      />
                    </h2>
                  </div>
                  <button
                    onClick={() => deleteStep(selectedStep.originalId)}
                    className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Step
                  </button>
                </div>
                
                {/* Step editor content */}
                <div className="p-6 space-y-6">
                  {/* Remove Step Title field - it's now in the header */}
                  
                  {/* Step Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Step Description</label>
                    <textarea
                      value={selectedStep.description || ''}
                      onChange={(e) => handleStepUpdate(selectedStep.originalId, 'description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe what happens in this step"
                    />
                  </div>
                  
                  {/* Screenshot Section */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-700">Screenshot</label>
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => selectedStep && handleChangeImage(selectedStep.originalId)}
                          className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 text-gray-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Change
                        </button>
                        <button 
                          onClick={() => selectedStep?.screenshotPath && openMarkupModal(selectedStep.screenshotPath, selectedStep.originalId)}
                          className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 text-gray-700 relative"
                          disabled={!selectedStep?.screenshotPath || !imageCache[selectedStep?.screenshotPath || '']}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Markup
                        </button>
                        <button 
                          onClick={() => selectedStep?.screenshotPath && handleOpenImage(selectedStep.screenshotPath)}
                          className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 text-gray-700"
                          disabled={!selectedStep?.screenshotPath || !imageCache[selectedStep?.screenshotPath || '']}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                          </svg>
                          Fullscreen
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      {selectedStep.screenshotPath && imageCache[selectedStep.screenshotPath] ? (
                        <div className="relative bg-gray-50 flex items-center justify-center">
                          {// Add console.log here
                            (() => {
                              const shapesForPreview = selectedStep?.screenshotPath && selectedStep?.originalId ? getShapesForImage(selectedStep.screenshotPath, selectedStep.originalId) : [];
                              console.log(`[StepsTab] PreviewCanvas for selectedStep: ${selectedStep?.originalId}, imagePath: ${selectedStep?.screenshotPath}, shapes:`, JSON.parse(JSON.stringify(shapesForPreview)));
                              return (
                                <PreviewCanvas
                                  imageUrl={imageCache[selectedStep.screenshotPath]}
                                  shapes={shapesForPreview}
                                  width={800}
                                  height={450}
                                />
                              );
                            })()
                          }
                        </div>
                      ) : selectedStep.screenshotPath ? (
                        <div className="w-full aspect-video flex items-center justify-center bg-gray-50">
                          <div className="flex flex-col items-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p>Loading screenshot...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full aspect-video flex items-center justify-center bg-gray-50 border-dashed border-2 border-gray-200">
                          <div className="flex flex-col items-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p>No screenshot available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Footer with actions */}
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  {/* Footer content can be added here if needed */}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200 p-10">
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No Step Selected</h3>
                  <p className="text-gray-500 mb-4">Select a step from the list to edit its details or create a new step.</p>
                  <button 
                    onClick={addStep}
                    className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 inline-flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Step
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Image Modal */}
      <ImageModal 
        isOpen={!!modalImage && !isMarkupModalOpen} 
        imageUrl={modalImage || ''} 
        onClose={closeImageModal}
      />
      
      {/* Markup Modal */}
      {selectedStep && (
        <MarkupModal
          isOpen={!!modalImage && isMarkupModalOpen}
          imageUrl={modalImage || ''}
          onClose={closeMarkupModal}
          onSave={(dataUrl, shapes) => handleSaveMarkup(dataUrl, shapes, selectedStep.originalId)}
          initialShapes={markupShapes}
        />
      )}
    </div>
  );
}; 