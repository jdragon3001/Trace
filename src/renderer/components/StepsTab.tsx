import React, { useState, useEffect, useCallback } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { RecordingStep, Step } from '../../shared/types';
import { useStepsStore, DisplayStep } from '../store/useStepsStore';
import { StepRepository } from '../repositories/StepRepository';

// Modal component for enlarged images
const ImageModal: React.FC<{
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}> = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="max-w-[90%] max-h-[90%] overflow-auto">
        <img 
          src={imageUrl} 
          alt="Enlarged screenshot" 
          className="max-w-full max-h-full object-contain"
        />
      </div>
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
  
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [modalImage, setModalImage] = useState<string | null>(null);

  const stepRepository = StepRepository.getInstance();
  
  // Calculate final loading state
  const isLoading = storeIsLoading || localIsLoading;
  
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

  const openImageModal = useCallback((imagePath: string) => {
    setModalImage(imageCache[imagePath]);
  }, [imageCache]);

  const closeImageModal = useCallback(() => {
    setModalImage(null);
  }, []);

  // Helper function to safely open the image modal
  const handleOpenImage = useCallback((screenshotPath: string | undefined) => {
    if (screenshotPath && imageCache[screenshotPath]) {
      openImageModal(screenshotPath);
    }
  }, [imageCache, openImageModal]);

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
        
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">Loading steps...</p>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
            <p>{loadError}</p>
          </div>
        ) : steps.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-gray-500 text-center">
            <p>No steps found for this tutorial. Click "+ Add Step" to create your first step.</p>
          </div>
        ) : (
          steps.map((step, index) => (
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
                        {imageCache[step.screenshotPath] ? (
                          <div className="cursor-pointer relative">
                            <img 
                              src={imageCache[step.screenshotPath]}
                              alt={`Step ${step.displayId} screenshot`}
                              className="w-1/2 h-auto border rounded-md hover:opacity-90 transition-opacity"
                              onClick={() => handleOpenImage(step.screenshotPath)}
                            />
                            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                              Click to enlarge
                            </div>
                          </div>
                        ) : (
                          <div className="w-1/2 h-32 flex items-center justify-center bg-gray-100 border rounded-md">
                            <p className="text-gray-500">Loading screenshot...</p>
                          </div>
                        )}
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
          ))
        )}
      </div>
      
      {/* Image Modal */}
      <ImageModal 
        isOpen={!!modalImage} 
        imageUrl={modalImage || ''} 
        onClose={closeImageModal}
      />
    </div>
  );
}; 