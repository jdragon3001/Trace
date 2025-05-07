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
  
  // Add state to track original image dimensions and scale factors
  const [originalImageDimensions, setOriginalImageDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState({ x: 1, y: 1 });

  // Load initialShapes when they change
  useEffect(() => {
    if (initialShapes && initialShapes.length > 0) {
      console.log('[MarkupModal] Loading initial shapes:', initialShapes.length);
      setShapes([...initialShapes]); // Use a new array to ensure state update
    }
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
          const left = Math.min(selectedShape.start.x, selectedShape.end.x);
          const right = Math.max(selectedShape.start.x, selectedShape.end.x);
          const top = Math.min(selectedShape.start.y, selectedShape.end.y);
          const bottom = Math.max(selectedShape.start.y, selectedShape.end.y);
          
          // Check corners
          if (isNearPoint(point, { x: left, y: top })) 
            return { id: selectedShapeId, dragMode: 'resize-nw' as const };
          if (isNearPoint(point, { x: right, y: top })) 
            return { id: selectedShapeId, dragMode: 'resize-ne' as const };
          if (isNearPoint(point, { x: left, y: bottom })) 
            return { id: selectedShapeId, dragMode: 'resize-sw' as const };
          if (isNearPoint(point, { x: right, y: bottom })) 
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
            // For ellipse, offset from center
            if (shape.type === 'ellipse') {
              setDragOffset({
                x: clickPoint.x - shape.start.x,
                y: clickPoint.y - shape.start.y
              });
            } 
            // For rectangle, calculate offset from original points
            else if (shape.type === 'rectangle') {
              // Store both the click offset from start and end points
              setDragOffset({
                x: clickPoint.x - shape.start.x,
                y: clickPoint.y - shape.start.y
              });
            }
            // For lines and arrows, offset from start
            else {
              setDragOffset({
                x: clickPoint.x - shape.start.x,
                y: clickPoint.y - shape.start.y
              });
            }
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
        const updatedShape = { ...shape };
        
        if (dragMode === 'move') {
          // Move the entire shape
          if (shape.type === 'ellipse') {
            // For ellipse, calculate new positions in display coordinates
            const newDisplayX = currentPos.x - dragOffset.x;
            const newDisplayY = currentPos.y - dragOffset.y;
            
            // Convert back to original image coordinates
            updatedShape.start = {
              x: newDisplayX / scaleFactor.x,
              y: newDisplayY / scaleFactor.y
            };
            
            // Calculate the radius vector
            const dx = selectedDisplayShape.end.x - selectedDisplayShape.start.x;
            const dy = selectedDisplayShape.end.y - selectedDisplayShape.start.y;
            
            // Update end point in original image coordinates
            updatedShape.end = {
              x: updatedShape.start.x + (dx / scaleFactor.x),
              y: updatedShape.start.y + (dy / scaleFactor.y)
            };
          } 
          else if (shape.type === 'rectangle') {
            // For rectangle, move directly using the stored offset
            const dx = currentPos.x - dragOffset.x - shape.start.x;
            const dy = currentPos.y - dragOffset.y - shape.start.y;
            
            // Move both points by the same amount
            updatedShape.start = {
              x: shape.start.x + dx,
              y: shape.start.y + dy
            };
            updatedShape.end = {
              x: shape.end.x + dx,
              y: shape.end.y + dy
            };
          } 
          else {
            // For lines and arrows, move both endpoints together
            const dx = currentPos.x - dragOffset.x - shape.start.x;
            const dy = currentPos.y - dragOffset.y - shape.start.y;
            
            updatedShape.start = {
              x: shape.start.x + dx,
              y: shape.start.y + dy
            };
            updatedShape.end = {
              x: shape.end.x + dx,
              y: shape.end.y + dy
            };
          }
        } 
        else if (dragMode && dragMode.startsWith('resize-')) {
          if (shape.type === 'rectangle') {
            // Handle corner resizing for rectangle
            const isStart = {
              x: dragMode === 'resize-nw' || dragMode === 'resize-sw',
              y: dragMode === 'resize-nw' || dragMode === 'resize-ne'
            };
            
            if (isStart.x) updatedShape.start.x = currentPos.x;
            else updatedShape.end.x = currentPos.x;
            
            if (isStart.y) updatedShape.start.y = currentPos.y;
            else updatedShape.end.y = currentPos.y;
          } 
          else if (shape.type === 'line' || shape.type === 'arrow') {
            // Handle endpoint resizing for lines and arrows
            if (dragMode === 'resize-start') {
              updatedShape.start = currentPos;
            } else {
              updatedShape.end = currentPos;
            }
          } 
          else if (shape.type === 'ellipse') {
            if (dragMode === 'resize-end') {
              const dx = currentPos.x - shape.start.x;
              const dy = currentPos.y - shape.start.y;
              updatedShape.end = {
                x: shape.start.x + Math.abs(dx) * (dx < 0 ? -1 : 1),
                y: shape.start.y + Math.abs(dy) * (dy < 0 ? -1 : 1)
              };
            }
            // Handle cardinal direction resizing for ellipses
            else if (dragMode === 'resize-e' || dragMode === 'resize-w') {
              // Only change the x-coordinate (width)
              const dx = currentPos.x - shape.start.x;
              
              if (dragMode === 'resize-e') {
                // East resize - positive x direction
                updatedShape.end = {
                  x: shape.start.x + Math.abs(dx),
                  y: shape.end.y // Keep y-coordinate unchanged
                };
              } else {
                // West resize - negative x direction
                updatedShape.end = {
                  x: shape.start.x - Math.abs(dx),
                  y: shape.end.y // Keep y-coordinate unchanged
                };
              }
            }
            else if (dragMode === 'resize-n' || dragMode === 'resize-s') {
              // Only change the y-coordinate (height)
              const dy = currentPos.y - shape.start.y;
              
              if (dragMode === 'resize-s') {
                // South resize - positive y direction
                updatedShape.end = {
                  x: shape.end.x, // Keep x-coordinate unchanged
                  y: shape.start.y + Math.abs(dy)
                };
              } else {
                // North resize - negative y direction
                updatedShape.end = {
                  x: shape.end.x, // Keep x-coordinate unchanged
                  y: shape.start.y - Math.abs(dy)
                };
              }
            }
          }
        }
        
        return updatedShape;
      });
      
      setShapes(updatedShapes);
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
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw all shapes with scaling applied
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
    };
    img.src = imageUrl;
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
        const updatedShape = { ...shape };
        
        // Find the display version of this shape for calculations
        const displayShape = displayShapes.find(s => s.id === shape.id);
        if (!displayShape) return shape;
        
        if (dragMode === 'move') {
          // Calculate new display coordinates, then convert to original image coordinates
          const newDisplayX = currentPos.x - dragOffset.x;
          const newDisplayY = currentPos.y - dragOffset.y;
          
          // Convert back to original image coordinates
          updatedShape.start = {
            x: newDisplayX / scaleFactor.x,
            y: newDisplayY / scaleFactor.y
          };
          
          // For ellipse, rectangle, etc. update the end point as well
          if (shape.type === 'ellipse' || shape.type === 'rectangle') {
            // Calculate the span vector in display coordinates
            const dx = displayShape.end.x - displayShape.start.x;
            const dy = displayShape.end.y - displayShape.start.y;
            
            // Update end point in original image coordinates
            updatedShape.end = {
              x: updatedShape.start.x + (dx / scaleFactor.x),
              y: updatedShape.start.y + (dy / scaleFactor.y)
            };
          } else if (shape.type === 'line' || shape.type === 'arrow') {
            // For lines and arrows, move both points
            const startDeltaX = currentPos.x - dragOffset.x - displayShape.start.x;
            const startDeltaY = currentPos.y - dragOffset.y - displayShape.start.y;
            
            updatedShape.start = {
              x: shape.start.x + (startDeltaX / scaleFactor.x),
              y: shape.start.y + (startDeltaY / scaleFactor.y)
            };
            
            updatedShape.end = {
              x: shape.end.x + (startDeltaX / scaleFactor.x),
              y: shape.end.y + (startDeltaY / scaleFactor.y)
            };
          }
        } 
        // Handle resize operations here if needed
        
        return updatedShape;
      });
      
      setShapes(updatedShapes);
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
        className="mb-4 bg-white rounded-lg p-2 flex flex-wrap gap-2"
        onClick={handleContentClick}
      >
        <div className="flex space-x-2">
          <button 
            className={`p-2 rounded ${tool === 'select' ? 'bg-blue-100' : 'bg-gray-100'}`}
            onClick={(e) => { e.stopPropagation(); setTool('select'); }}
            title="Select & Move"
          >
            👆
          </button>
          <button 
            className={`p-2 rounded ${tool === 'ellipse' ? 'bg-blue-100' : 'bg-gray-100'}`}
            onClick={(e) => { e.stopPropagation(); setTool('ellipse'); }}
            title="Ellipse"
          >
            ⭕
          </button>
          <button 
            className={`p-2 rounded ${tool === 'rectangle' ? 'bg-blue-100' : 'bg-gray-100'}`}
            onClick={(e) => { e.stopPropagation(); setTool('rectangle'); }}
            title="Rectangle"
          >
            🔲
          </button>
          <button 
            className={`p-2 rounded ${tool === 'line' ? 'bg-blue-100' : 'bg-gray-100'}`}
            onClick={(e) => { e.stopPropagation(); setTool('line'); }}
            title="Line"
          >
            ➖
          </button>
          <button 
            className={`p-2 rounded ${tool === 'arrow' ? 'bg-blue-100' : 'bg-gray-100'}`}
            onClick={(e) => { e.stopPropagation(); setTool('arrow'); }}
            title="Arrow"
          >
            ➡️
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Color:</label>
          <input 
            type="color" 
            value={color} 
            onChange={(e) => { e.stopPropagation(); setColor(e.target.value); }}
            className="w-8 h-8 cursor-pointer"
          />
        </div>
        
        <div className="flex space-x-2">
          <button 
            className="p-2 bg-gray-100 rounded"
            onClick={(e) => { e.stopPropagation(); handleUndo(); }}
            title="Undo"
            disabled={shapes.length === 0}
          >
            ↩️
          </button>
          {selectedShapeId && (
            <button 
              className="p-2 bg-gray-100 rounded"
              onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
              title="Delete Selected"
            >
              🗑️
            </button>
          )}
          <button 
            className="px-3 py-2 bg-red-500 text-white rounded"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            Cancel
          </button>
          <button 
            className="px-3 py-2 bg-green-500 text-white rounded"
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
          >
            Save
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
}

export const StepsTab: React.FC<StepsTabProps> = ({ tutorialId }) => {
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
  
  const openMarkupModal = useCallback((imagePath: string) => {
    if (imageCache[imagePath]) {
      setModalImage(imageCache[imagePath]);
      
      // Load existing shapes for this image
      const existingShapes = getShapesForImage(imagePath);
      console.log(`[Markup] Loading markup modal for image: ${imagePath}`);
      console.log(`[Markup] Found ${existingShapes.length} existing shapes`);
      if (existingShapes.length > 0) {
        console.log('[Markup] Shape details:', JSON.stringify(existingShapes[0], null, 2));
      }
      
      setMarkupShapes(existingShapes);
      setIsMarkupModalOpen(true);
    }
  }, [imageCache, getShapesForImage]);

  const closeMarkupModal = useCallback(() => {
    setIsMarkupModalOpen(false);
    setModalImage(null);
    setMarkupShapes([]);
  }, []);

  const handleSaveMarkup = useCallback(async (modifiedImageUrl: string, shapeData: any, stepId: string) => {
    try {
      console.log('[Markup] Starting save process for markup data');
      console.log('[Markup] Step ID:', stepId);
      
      // Find the step in the current steps array first (faster than database lookup)
      const stepInMemory = steps.find(step => step.originalId === stepId);
      
      if (stepInMemory && stepInMemory.screenshotPath) {
        // Use the step information from memory
        console.log(`[Markup] Found step in memory with screenshot path: ${stepInMemory.screenshotPath}`);
        
        // Save the shape data in memory using the original image path
        saveShapesForImage(stepInMemory.screenshotPath, shapeData);
        console.log(`[Markup] Shape data saved in memory for ${stepInMemory.screenshotPath} (${shapeData.length} shapes)`);
        
        // Close the modal
        closeMarkupModal();
        
        // Notify the user with a clearer message
        alert(`Markup saved! ${shapeData.length} shape${shapeData.length !== 1 ? 's' : ''} saved and will be applied when viewing or exporting.`);
        return;
      }
      
      // If not found in memory, try to get it from the database
      console.log(`[Markup] Step not found in memory, trying database lookup for ID: ${stepId}`);
      const step = await stepRepository.getStepById(stepId);
      
      if (!step) {
        console.error(`[Markup] Step not found in database with ID: ${stepId}`);
        throw new Error('Step not found. Unable to save markup.');
      }
      
      if (!step.screenshotPath) {
        console.error(`[Markup] Step found but missing screenshot path. Step ID: ${stepId}`);
        throw new Error('Step missing screenshot path. Unable to save markup.');
      }
      
      // Save the shape data in memory using the original image path
      saveShapesForImage(step.screenshotPath, shapeData);
      console.log(`[Markup] Shape data saved in memory for ${step.screenshotPath}`);
      
      // Close the modal
      closeMarkupModal();
      
      // Notify the user with a clearer message
      alert(`Markup saved! ${shapeData.length} shape${shapeData.length !== 1 ? 's' : ''} saved and will be applied when viewing or exporting.`);
      
    } catch (error) {
      console.error('[Markup] Error saving markup:', error);
      alert(`Error saving markup: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't close the modal on error so the user doesn't lose their work
    }
  }, [saveShapesForImage, stepRepository, closeMarkupModal, steps]);
  
  // Load steps for the tutorial when tutorialId changes
  useEffect(() => {
    if (tutorialId) {
      console.log(`[StepsTab] Tutorial ID changed to ${tutorialId}, loading steps...`);
      loadStepsForTutorial(tutorialId);
    } else {
      console.log(`[StepsTab] No tutorial ID provided, clearing steps...`);
      // Clear steps when no tutorial is selected
      clearStoreSteps();
    }

    // Cleanup when component unmounts or tutorial changes
    return () => {
      console.log(`[StepsTab] Tutorial ID changing from ${tutorialId}, cleaning up...`);
    };
  }, [tutorialId]);
  
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
      
      console.log(`[StepsTab] Loading steps for tutorial: ${tutorialId}`);
      
      // Clear existing steps in the store BEFORE loading new ones
      clearStoreSteps();
      
      // Get steps from the repository
      const steps = await stepRepository.loadStepsForTutorial(tutorialId);
      
      console.log(`[StepsTab] Loaded ${steps.length} steps for tutorial ${tutorialId}`);
      
      // Save first to check if steps are properly loaded
      let stepIdsLoaded: string[] = [];
      
      // Add all loaded steps to the store
      if (steps.length > 0) {
        console.log('[StepsTab] Processing loaded steps for display');
        
        steps.forEach(step => {
          if (step.id) {
            stepIdsLoaded.push(step.id);
            console.log(`[StepsTab] Processing step ID ${step.id}, order: ${step.order}`);
            
            addStoreStep({
              id: step.id,
              number: step.order,
              timestamp: step.timestamp,
              screenshotPath: step.screenshotPath,
              mousePosition: step.mousePosition || { x: 0, y: 0 },
              windowTitle: step.windowTitle || '',
              description: step.actionText,
              keyboardShortcut: step.keyboardShortcut
            });
          }
        });
        
        console.log(`[StepsTab] Added ${stepIdsLoaded.length} steps to store: ${stepIdsLoaded.join(', ')}`);
      } else {
        console.log(`[StepsTab] No steps found for tutorial ${tutorialId}`);
      }
      
      // Load screenshots for all steps 
      steps.forEach(step => {
        if (step.screenshotPath) {
          console.log(`[StepsTab] Loading screenshot for step ${step.id}: ${step.screenshotPath}`);
          loadImageAsDataUrl(step.screenshotPath);
        }
      });
      
      // Force a state update to ensure UI refreshes
      setTimeout(() => {
        const currentStepsInStore = useStepsStore.getState().steps;
        console.log(`[StepsTab] Current steps in store after loading: ${currentStepsInStore.length}`);
        if (currentStepsInStore.length === 0 && steps.length > 0) {
          console.warn('[StepsTab] Steps were loaded but not showing in store, attempting force update');
          // Attempt to force refresh the store
          const displaySteps = steps
            .filter(step => !!step.id) // Only include steps that have an ID
            .map((step, index) => ({
              displayId: index + 1,
              originalId: step.id as string, // Type assertion since we filtered for non-null IDs
              title: `Step ${index + 1}`,
              description: step.actionText || '',
              screenshotPath: step.screenshotPath
            }));
          setStoreSteps(displaySteps);
        }
      }, 100);
    } catch (error) {
      console.error('[StepsTab] Error loading steps:', error);
      setLoadError('Failed to load steps. Please try again.');
    } finally {
      setLocalIsLoading(false);
      setStoreLoading(false);
    }
  };

  useEffect(() => {
    console.log('[StepsTab] Component mounted. Setting up listeners...');

    const handleStepCreated = (newStep: RecordingStep) => {
      console.log('[StepsTab] Received step:created, adding to store:', newStep);
      addStoreStep(newStep);
      
      // If the step has a screenshot, load it as a data URL
      if (newStep.screenshotPath) {
        loadImageAsDataUrl(newStep.screenshotPath);
      }
    };

    const removeStepListener = window.electronAPI?.onStepCreated(handleStepCreated);

    // Load any existing screenshots
    steps.forEach(step => {
      if (step.screenshotPath && !imageCache[step.screenshotPath]) {
        loadImageAsDataUrl(step.screenshotPath);
      }
    });

    return () => {
      console.log('[StepsTab] Component unmounting. Removing listeners...');
      removeStepListener?.();
    };
  }, [addStoreStep, steps, imageCache]);

  const moveStep = useCallback((fromIndex: number, toIndex: number) => {
    const newSteps = [...steps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);
    setStoreSteps(newSteps);
  }, [steps, setStoreSteps]);

  const handleStepUpdate = useCallback((originalId: string, field: 'title' | 'description', value: string) => {
    updateStoreStep(originalId, { [field]: value });
  }, [updateStoreStep]);

  const addStep = useCallback(() => {
    // Create a truly unique ID for manual steps
    const uniqueId = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const manualStepData: RecordingStep = {
        id: uniqueId,
        number: steps.length + 1,
        timestamp: new Date().toISOString(),
        screenshotPath: '',
        mousePosition: { x: 0, y: 0 },
        windowTitle: '',
        description: 'Manually added step'
    };
    addStoreStep(manualStepData);
    
    // Automatically select the newly added step
    setTimeout(() => {
      setSelectedStepId(uniqueId);
    }, 100);
  }, [addStoreStep, steps.length]);

  const deleteStep = useCallback((originalId: string) => {
    deleteStoreStep(originalId);
    // If the deleted step was selected, clear the selection
    if (selectedStepId === originalId) {
      setSelectedStepId(null);
    }
  }, [deleteStoreStep, selectedStepId]);

  const openImageModal = useCallback((imagePath: string) => {
    setModalImage(imageCache[imagePath]);
  }, [imageCache]);

  const closeImageModal = useCallback(() => {
    setModalImage(null);
  }, []);

  const handleChangeImage = useCallback(async (stepId: string) => {
    try {
      // Open file dialog to select an image
      const result = await window.electronAPI.openFileDialog({
        title: 'Select Image',
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return;
      }
      
      const sourcePath = result.filePaths[0];
      
      // Make a copy of the image
      const newImagePath = await window.electronAPI.copyImageFile({
        sourcePath,
        tutorialId: tutorialId || '',
        stepId: stepId,
        makeBackup: true
      });
      
      if (!newImagePath) {
        console.error('Failed to copy image file');
        return;
      }
      
      // Update the step with the new image path
      updateStoreStep(stepId, { screenshotPath: newImagePath });
      
      // Load the new image into cache
      loadImageAsDataUrl(newImagePath);
      
    } catch (error) {
      console.error('Error changing image:', error);
    }
  }, [tutorialId, updateStoreStep, loadImageAsDataUrl]);

  // Get the currently selected step
  const selectedStep = steps.find(step => step.originalId === selectedStepId);

  // Helper function to safely open the image modal
  const handleOpenImage = useCallback((screenshotPath: string | undefined) => {
    if (screenshotPath && imageCache[screenshotPath]) {
      openImageModal(screenshotPath);
    }
  }, [imageCache, openImageModal]);

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
          {/* Fixed header for left column */}
          <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
            <p className="text-sm text-gray-600">Customize your documentation steps by editing content and adding annotations.</p>
          </div>
          
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
                    {selectedStep?.screenshotPath && getShapesForImage(selectedStep.screenshotPath)?.length > 0 && selectedStep.originalId === step.originalId && (
                      <div className="px-3 pb-2 flex gap-1">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <svg className="mr-1 h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                          </svg>
                          {getShapesForImage(step.screenshotPath || '').length} markup
                        </span>
                      </div>
                    )}
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
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-medium text-gray-900">Editing Step {selectedStep.displayId}</h2>
                </div>
                
                {/* Step editor content */}
                <div className="p-6 space-y-6">
                  {/* Step Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Step Title</label>
                    <input
                      type="text"
                      value={selectedStep.title}
                      onChange={(e) => handleStepUpdate(selectedStep.originalId, 'title', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter a title for this step"
                    />
                  </div>
                  
                  {/* Step Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Step Description</label>
                    <textarea
                      value={selectedStep.description || ''}
                      onChange={(e) => handleStepUpdate(selectedStep.originalId, 'description', e.target.value)}
                      rows={4}
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
                          onClick={() => selectedStep?.screenshotPath && openMarkupModal(selectedStep.screenshotPath)}
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
                          <PreviewCanvas
                            imageUrl={imageCache[selectedStep.screenshotPath]}
                            shapes={getShapesForImage(selectedStep.screenshotPath) || []}
                            width={800}
                            height={450}
                          />
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
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    Step ID: {selectedStep.originalId.substring(0, 8)}...
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