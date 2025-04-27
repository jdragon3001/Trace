import React, { useState, useEffect, useCallback } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { RecordingStep } from '../../shared/types';
import { useStepsStore, DisplayStep } from '../store/useStepsStore';

export const StepsTab: React.FC = () => {
  const steps = useStepsStore((state) => state.steps);
  const addStoreStep = useStepsStore((state) => state.addStep);
  const setStoreSteps = useStepsStore((state) => state.setSteps);
  const updateStoreStep = useStepsStore((state) => state.updateStep);
  const deleteStoreStep = useStepsStore((state) => state.deleteStep);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[StepsTab] Component mounted. Setting up listeners...');

    const handleStepCreated = (newStep: RecordingStep) => {
      console.log('[StepsTab] Received step:created, adding to store:', newStep);
      addStoreStep(newStep);
    };

    const removeStepListener = window.electronAPI?.onStepCreated(handleStepCreated);

    return () => {
      console.log('[StepsTab] Component unmounting. Removing listeners...');
      removeStepListener?.();
    };
  }, [addStoreStep]);

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
  }, [addStoreStep, steps.length]);

  const deleteStep = useCallback((originalId: string) => {
    deleteStoreStep(originalId);
  }, [deleteStoreStep]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-medium">Edit Steps</h1>
        <button 
          onClick={addStep}
          className="px-3 py-1.5 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 flex items-center"
        >
          + Add Step
        </button>
      </div>
      
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        <p className="text-sm text-gray-600 mb-4">Customize your documentation steps</p>
        
        {steps.map((step, index) => (
          <div 
            key={`step-${step.originalId}`}
            className={`bg-white rounded-lg border ${selectedStepId === step.originalId ? 'border-gray-400' : 'border-gray-200'}`}
          >
            <div className="flex items-center p-3 cursor-pointer" onClick={() => setSelectedStepId(step.originalId)}>
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                {step.displayId}
              </div>
              <span className="ml-3 flex-1">{step.title}</span>
              <div className="flex space-x-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); index > 0 && moveStep(index, index - 1); }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); index < steps.length - 1 && moveStep(index, index + 1); }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {selectedStepId === step.originalId && (
              <div className="border-t border-gray-200 p-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Step Title</label>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => handleStepUpdate(step.originalId, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Step Description</label>
                    <textarea
                      value={step.description}
                      onChange={(e) => handleStepUpdate(step.originalId, 'description', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {step.screenshotPath && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot</label>
                      <img 
                        src={`file:///${step.screenshotPath.replace(/\\/g, '/')}`}
                        alt={`Step ${step.displayId} screenshot`}
                        className="w-full h-auto border rounded-md"
                      />
                    </div>
                  )}
                  <div className="flex justify-end items-center">
                    <button
                      onClick={() => deleteStep(step.originalId)}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 