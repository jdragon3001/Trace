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

interface StepsState {
  steps: DisplayStep[];
  isLoading: boolean;
  addStep: (newStep: RecordingStep) => void;
  setSteps: (steps: DisplayStep[]) => void; // For reordering, deleting multiple, loading
  updateStep: (originalId: string, updatedData: Partial<Omit<DisplayStep, 'displayId' | 'originalId'>>) => void;
  deleteStep: (originalId: string) => void;
  setLoading: (isLoading: boolean) => void;
  clearSteps: () => void;
}

export const useStepsStore = create<StepsState>()(
  devtools(
    immer(
      (set) => ({
        steps: [],
        isLoading: false,

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

      })
    ),
    { name: 'StepsStore' }
  )
); 