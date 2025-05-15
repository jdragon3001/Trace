import { create } from 'zustand';
import { RecordingStep } from '../../shared/types';
import { immer } from 'zustand/middleware/immer';
import {devtools} from 'zustand/middleware';

// Re-use the DisplayStep interface or define it here if preferred
export interface DisplayStep {
  displayId: number; // ID for UI ordering and display
  originalId: string; // Original ID from RecordingStep
  title: string;
  description: string;
  screenshotPath?: string;
}

export interface ShapeData {
  id: string;
  type: 'ellipse' | 'arrow' | 'line' | 'rectangle';
  start: { x: number, y: number };
  end: { x: number, y: number };
  color: string;
  stepId?: string; // Added to associate with specific step
}

interface StepsState {
  steps: DisplayStep[];
  isLoading: boolean;
  imageShapeData: Record<string, ShapeData[]>; // Key format: "stepId:imagePath"
  addStep: (newStep: RecordingStep) => void;
  setSteps: (steps: DisplayStep[]) => void; // For reordering, deleting multiple, loading
  updateStep: (originalId: string, updatedData: Partial<Omit<DisplayStep, 'displayId' | 'originalId'>>) => void;
  deleteStep: (originalId: string) => void;
  setLoading: (isLoading: boolean) => void;
  clearSteps: () => void;
  saveShapesForImage: (imagePath: string, shapes: ShapeData[], stepId: string) => void;
  getShapesForImage: (imagePath: string, stepId: string) => ShapeData[];
  clearImageShapeData: () => void;
}

export const useStepsStore = create<StepsState>()(
  devtools(
    immer(
      (set, get) => ({
        steps: [],
        isLoading: false,
        imageShapeData: {},

        setLoading: (isLoading: boolean) => set((state: StepsState) => {
          state.isLoading = isLoading;
        }),
        
        clearSteps: () => set((state: StepsState) => {
          console.log(`[StepsStore] Clearing all steps`);
          state.steps = [];
        }),

        addStep: (newStep: RecordingStep) => set((state: StepsState) => {
          // Check if step with this ID already exists
          const existingStepIndex = state.steps.findIndex(step => step.originalId === newStep.id);
          
          // If step already exists, just return without adding a duplicate
          if (existingStepIndex !== -1) {
            console.log(`[StepsStore] Step with ID ${newStep.id} already exists, skipping addition`);
            return;
          }
          
          const nextDisplayId = state.steps.length + 1;
          const displayStep: DisplayStep = {
            displayId: nextDisplayId,
            originalId: newStep.id,
            title: `Step ${nextDisplayId}`,
            description: newStep.description || '',
            screenshotPath: newStep.screenshotPath
          };
          console.log(`[StepsStore] Adding new step with originalId: ${displayStep.originalId}`);
          state.steps = [...state.steps, displayStep];
        }),

        setSteps: (newSteps: DisplayStep[]) => set((state: StepsState) => {
          // Ensure we don't have duplicate originalIds
          const uniqueSteps = newSteps.filter((step, index, self) => 
            index === self.findIndex(s => s.originalId === step.originalId)
          );
          
          console.log(`[StepsStore] Setting ${uniqueSteps.length} steps`);
          
          const recalculatedSteps = uniqueSteps.map((step, index) => ({
              ...step,
              displayId: index + 1,
              title: step.title || `Step ${index + 1}`
          }));
          state.steps = recalculatedSteps;
        }),

        updateStep: (originalId: string, updatedData: Partial<Omit<DisplayStep, 'displayId' | 'originalId'>>) => set((state: StepsState) => {
          const stepIndex = state.steps.findIndex(step => step.originalId === originalId);
          if (stepIndex !== -1) {
            console.log(`[StepsStore] Updating step ${originalId}`);
            state.steps[stepIndex] = { ...state.steps[stepIndex], ...updatedData };
          } else {
            console.warn(`[StepsStore] Failed to update step ${originalId} - not found`);
          }
        }),

        deleteStep: (originalId: string) => set((state: StepsState) => {
          console.log(`[StepsStore] Deleting step ${originalId}`);
          const remainingSteps = state.steps.filter(step => step.originalId !== originalId);
          const recalculatedSteps = remainingSteps.map((step, index) => ({
              ...step,
              displayId: index + 1,
              title: step.title.startsWith('Step ') ? `Step ${index + 1}` : step.title
          }));
          state.steps = recalculatedSteps;
        }),

        // Shape data management
        saveShapesForImage: (imagePath: string, shapes: ShapeData[], stepId: string) => {
          console.log(`[StepsStore] Saving ${shapes.length} shapes for image: ${imagePath}`);
          
          if (!imagePath) {
            console.error('[StepsStore] Cannot save shapes: missing image path');
            return;
          }
          
          set((state) => {
            // Deep copy the incoming shapes to avoid reference issues
            const shapesCopy = JSON.parse(JSON.stringify(shapes));
            
            // Ensure every shape has an ID
            const shapesWithIds = shapesCopy.map((shape: ShapeData) => ({
              ...shape,
              id: shape.id || `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              stepId: stepId
            }));
            
            state.imageShapeData[`${stepId}:${imagePath}`] = shapesWithIds;
            
            console.log(`[StepsStore] Saved ${shapesWithIds.length} shapes for image: ${imagePath}`);
            console.log(`[StepsStore] First shape:`, shapesWithIds.length > 0 ? JSON.stringify(shapesWithIds[0], null, 2) : 'none');
            
            // Count total shapes in store after update
            let totalShapes = 0;
            Object.values(state.imageShapeData).forEach(shapes => {
              totalShapes += shapes.length;
            });
            console.log(`[StepsStore] Total shapes in store: ${totalShapes} (across ${Object.keys(state.imageShapeData).length} images)`);
          });
        },
        
        getShapesForImage: (imagePath: string, stepId: string) => {
          // If stepId is not provided, we should not return any shapes as they are step-specific
          if (!stepId) {
            console.error(`[StepsStore] No stepId provided for getting shapes for image: ${imagePath}, returning empty array`);
            return [];
          }
          
          if (!imagePath) {
            console.error(`[StepsStore] No imagePath provided for getting shapes for step: ${stepId}, returning empty array`);
            return [];
          }
          
          const key = `${stepId}:${imagePath}`;
          const shapes = get().imageShapeData[key] || [];
          console.log(`[StepsStore] Getting ${shapes.length} shapes for image: ${imagePath} and step: ${stepId}`);
          return shapes;
        },
        
        clearImageShapeData: () => {
          console.log(`[StepsStore] Clearing all image shape data`);
          
          // Count shapes before clearing
          let shapesCount = 0;
          Object.values(get().imageShapeData).forEach(shapes => {
            shapesCount += shapes.length;
          });
          
          console.log(`[StepsStore] Clearing ${shapesCount} shapes for ${Object.keys(get().imageShapeData).length} images`);
          
          set({ imageShapeData: {} });
          
          // Verify shapes were cleared
          const newShapesCount = Object.values(get().imageShapeData).reduce((count, shapes) => count + shapes.length, 0);
          console.log(`[StepsStore] After clearing: ${newShapesCount} shapes remain (should be 0)`);
        }
      })
    ),
    { name: 'StepsStore' }
  )
); 