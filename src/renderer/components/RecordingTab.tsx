import React, { useState, useEffect } from 'react';
import { PlayIcon as PlayIconSolid, PauseIcon, StopIcon } from '@heroicons/react/24/solid';
import { ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { IpcChannels } from '../../shared/constants';
import { RecordingStep } from '../../shared/types';

// Placeholder for an icon component or SVG
const ScreenIcon = () => (
  <ComputerDesktopIcon className="w-16 h-16 text-gray-300 mx-auto" />
);

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentStep: number;
  steps: RecordingStep[];
}

interface RecordingTabProps {
  projectId?: string;
  tutorialId?: string;
  autoCapture?: boolean;
  autoCaptureEnter?: boolean;
}

export const RecordingTab: React.FC<RecordingTabProps> = ({ projectId, tutorialId, autoCapture = true, autoCaptureEnter = false }) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    currentStep: 0,
    steps: []
  });
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const [currentTutorialId, setCurrentTutorialId] = useState<string | undefined>(tutorialId);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState<boolean>(autoCapture); // Use the prop value
  const [autoCaptureEnterEnabled, setAutoCaptureEnterEnabled] = useState<boolean>(autoCaptureEnter); // Use the prop value

  // Add event listener to prevent Enter key from triggering UI actions during recording
  useEffect(() => {
    // Function to handle keydown events
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only intercept Enter key when recording is active
      if (event.key === 'Enter' && recordingState.isRecording) {
        console.log('[RecordingTab] Preventing default Enter key behavior during recording');
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown, true);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [recordingState.isRecording]);

  // Update local state when props change
  useEffect(() => {
    if (projectId !== currentProjectId) {
      setCurrentProjectId(projectId);
    }
    if (tutorialId !== currentTutorialId) {
      setCurrentTutorialId(tutorialId);
    }
  }, [projectId, tutorialId, currentProjectId, currentTutorialId]);

  // Add more comprehensive debug info
  useEffect(() => {
    const info = `Debug Info:
    - projectId: ${currentProjectId || 'undefined'}
    - tutorialId: ${currentTutorialId || 'undefined'}
    - isRecording: ${recordingState.isRecording}
    - isPaused: ${recordingState.isPaused}`;
    
    console.log(info);
    setDebugInfo(info);
  }, [currentProjectId, currentTutorialId, recordingState]);

  // Fetch current tutorial and project data if they're not set properly
  useEffect(() => {
    const fetchCurrentData = async () => {
      try {
        // If we have a tutorialId but no projectId, try to get the correct projectId
        if (currentTutorialId && !currentProjectId) {
          console.log('[RecordingTab] We have tutorialId but no projectId, fetching current tutorial');
          const tutorial = await window.electronAPI?.getCurrentTutorial();
          if (tutorial && tutorial.projectId) {
            console.log(`[RecordingTab] Retrieved projectId ${tutorial.projectId} from tutorial`);
            setCurrentProjectId(tutorial.projectId);
          }
        }
      } catch (err) {
        console.error('[RecordingTab] Error fetching current data:', err);
      }
    };

    fetchCurrentData();
  }, [currentTutorialId, currentProjectId]);

  useEffect(() => {
    // Check if we have both a project and tutorial selected
    if (!currentProjectId || !currentTutorialId) {
      console.log(`[RecordingTab] Missing project or tutorial: projectId=${currentProjectId}, tutorialId=${currentTutorialId}`);
      setError('Please select a project and tutorial before recording.');
    } else {
      console.log(`[RecordingTab] Project and tutorial selected: projectId=${currentProjectId}, tutorialId=${currentTutorialId}`);
      setError(null);
      // No auto-start behavior - wait for user to click Start Recording
    }
  }, [currentProjectId, currentTutorialId]);

  useEffect(() => {
    console.log('[RecordingTab] Adding listeners...');
    console.log('Checking window.electronAPI:', window.electronAPI);

    // Create a seen steps map to avoid processing the same step multiple times
    const seenSteps = new Map();

    const handleRecordingStatus = (state: { 
      isRecording: boolean; 
      isPaused: boolean; 
      currentStep?: number; 
      steps?: any[] 
    }) => {
      console.log('[RecordingTab] Received recording-status:', state);
      // Map the state to our RecordingState interface
      const mappedState: RecordingState = {
        isRecording: state.isRecording || false,
        isPaused: state.isPaused || false,
        currentStep: state.currentStep || 0,
        steps: state.steps || []
      };
      setRecordingState(mappedState);
    };

    const handleRecordingError = (error: string) => {
      console.error('[RecordingTab] Received recording-error:', error);
      // TODO: Show error in UI
    };

    const handleStepCreated = (step: RecordingStep) => {
        console.log('[RecordingTab] Received step:created:', step);
        
        // Check if we've already processed this step to avoid duplicate saves
        if (seenSteps.has(step.id)) {
            console.log(`[RecordingTab] Already processed step ${step.id}, skipping`);
            return;
        }
        
        // Only save the step if we have the correct current tutorial ID
        if (currentTutorialId && currentTutorialId === tutorialId) {
            console.log(`[RecordingTab] Saving step to database for tutorial ${currentTutorialId}`);
            saveStepToDatabase(step, currentTutorialId)
                .then(() => {
                    // Force update the recording state to include the new step
                    setRecordingState(prev => ({
                        ...prev,
                        currentStep: prev.currentStep + 1,
                        steps: [...prev.steps, step]
                    }));
                    
                    // Trigger a notification for the UI that a step was recorded
                    if (window.electronAPI?.notifyStepRecorded) {
                        window.electronAPI.notifyStepRecorded(step);
                    }
                })
                .catch(err => {
                    console.error('[RecordingTab] Error saving step:', err);
                });
                
            // Mark step as processed
            seenSteps.set(step.id, true);
        } else {
            console.warn(`[RecordingTab] Cannot save step - tutorial ID mismatch or missing (current: ${currentTutorialId}, prop: ${tutorialId})`);
        }
    };

    // Clean up any previous listeners before adding new ones
    if (window.electronAPI) {
        // Note: we can't directly set max listeners on the IPC interface
        // This warning is expected but won't affect functionality
        console.log('[RecordingTab] Note: MaxListenersExceededWarning is expected and can be ignored');
    }

    const removeStatusListener = window.electronAPI?.onRecordingStatus(handleRecordingStatus); 
    const removeErrorListener = window.electronAPI?.onRecordingError(handleRecordingError);
    const removeStepListener = window.electronAPI?.onStepCreated(handleStepCreated);

    return () => {
      console.log('[RecordingTab] Removing listeners...');
      // Explicitly remove all listeners to avoid memory leaks
      removeStatusListener?.();
      removeErrorListener?.();
      removeStepListener?.();
      // Clear seen steps map
      seenSteps.clear();
    };
  }, [currentTutorialId, tutorialId]); // Include both tutorialId prop and currentTutorialId state

  // Function to save steps to the database
  const saveStepToDatabase = async (step: RecordingStep, tutorialId: string) => {
    try {
        console.log(`[RecordingTab] Saving step ${step.id} to database for tutorial ${tutorialId}`);
        
        // Convert RecordingStep to database Step format
        const dbStep = {
            tutorialId: tutorialId,
            order: step.number,
            screenshotPath: step.screenshotPath,
            actionText: `[TITLE]Step ${step.number}[DESC]${step.description || ''}`,
            timestamp: step.timestamp,
            mousePosition: step.mousePosition,
            windowTitle: step.windowTitle || '',
            keyboardShortcut: step.keyboardShortcut || ''
        };
        
        // Save to database via IPC
        await window.electronAPI?.saveStep(dbStep);
        
        // Refresh the steps for the current tutorial to ensure UI consistency
        if (window.electronAPI?.getStepsByTutorial) {
            const updatedSteps = await window.electronAPI.getStepsByTutorial(tutorialId);
            console.log(`[RecordingTab] Refreshed steps after save, now have ${updatedSteps?.length || 0} steps`);
        }
        
        // Refresh sidebar to update recent tutorials list
        try {
            const refreshEvent = new CustomEvent('refresh-sidebar', { detail: { tutorialId } });
            document.dispatchEvent(refreshEvent);
            console.log('[RecordingTab] Dispatched refresh-sidebar event to update recent tutorials');
        } catch (refreshError) {
            console.error('[RecordingTab] Error refreshing sidebar:', refreshError);
        }
        
        return dbStep;
    } catch (error) {
        console.error(`[RecordingTab] Error saving step to database:`, error);
        throw error;
    }
  };

  const handleStartRecording = async () => {
    try {
      console.log(`[RecordingTab] handleStartRecording called - isRecording: ${recordingState.isRecording}, isPaused: ${recordingState.isPaused}`);
      console.log(`[RecordingTab] Current projectId=${currentProjectId}, tutorialId=${currentTutorialId}`);
      
      if (!currentProjectId || !currentTutorialId) {
        const errorMsg = "Cannot start recording: Missing project or tutorial ID";
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }
      
      if (!recordingState.isRecording) {
        console.log('[RecordingTab] Starting recording...');
        try {
          await window.electronAPI?.startRecording();
          console.log('[RecordingTab] startRecording IPC call completed');
        } catch (e) {
          console.error('[RecordingTab] Error calling startRecording:', e);
          setError(`Failed to start recording: ${e}`);
        }
      } else if (recordingState.isPaused) {
        console.log('[RecordingTab] Resuming recording...');
        await window.electronAPI?.resumeRecording();
      } else {
        console.log('[RecordingTab] Pausing recording...');
        await window.electronAPI?.pauseRecording();
      }
    } catch (error) {
      const errorMsg = `Failed to handle recording action: ${error}`;
      console.error(errorMsg);
      setError(errorMsg);
    }
  };

  const handleStopRecording = async () => {
    try {
      console.log('[RecordingTab] Stopping recording...');
      
      // Call the stopRecording API
      await window.electronAPI?.stopRecording();
      
      // Reset capture mode to fullScreen when stopping recording
      if (window.electronAPI?.updateCaptureMode) {
        console.log('[RecordingTab] Resetting capture mode to fullScreen after stopping recording');
        window.electronAPI.updateCaptureMode('fullScreen');
      }
      
      // Forcibly update local state to ensure UI reflects stopped state
      // even if the recording status event doesn't come through
      setRecordingState(prevState => ({
        ...prevState,
        isRecording: false,
        isPaused: false
      }));
      
      console.log('[RecordingTab] Recording stopped successfully');
    } catch (error) {
      console.error('[RecordingTab] Failed to stop recording:', error);
      setError(`Failed to stop recording: ${error}`);
    }
  };

  const getButtonText = () => {
    if (recordingState.isRecording && !recordingState.isPaused) {
      return 'Pause Recording';
    }
    if (recordingState.isRecording && recordingState.isPaused) {
      return 'Resume Recording';
    }
    return 'Start Recording';
  };

  const getButtonIcon = () => {
    if (recordingState.isRecording && !recordingState.isPaused) {
      return <PauseIcon className="w-5 h-5 mr-2" />;
    }
    return <PlayIconSolid className="w-5 h-5 mr-2" />;
  };

  // Add handler for manually retrying with current tutorial
  const handleRetryWithSelectedTutorial = async () => {
    try {
      // Try to get the current tutorial data again
      const tutorial = await window.electronAPI?.getCurrentTutorial();
      console.log('[RecordingTab] Current tutorial on retry:', tutorial);
      
      if (tutorial && tutorial.id) {
        if (tutorial.projectId) {
          setCurrentProjectId(tutorial.projectId);
        }
        setCurrentTutorialId(tutorial.id);
        setError(null);
      } else {
        setError('Could not retrieve valid tutorial data');
      }
    } catch (err) {
      console.error('[RecordingTab] Error on retry:', err);
      setError(`Error retrieving tutorial data: ${err}`);
    }
  };

  // Add updated message text based on recording state and auto-capture setting
  const getRecordingStatusMessage = () => {
    if (!recordingState.isRecording) {
      return 'Click Start Recording to begin capturing your actions';
    }
    
    if (recordingState.isPaused) {
      return 'Recording paused. Click Resume to continue';
    }
    
    if (!autoCaptureEnabled && !autoCaptureEnterEnabled) {
      return 'Recording in progress. Auto-capture is disabled - click manually to capture steps';
    }

    let message = 'Recording in progress. ';
    if (autoCaptureEnabled) {
      message += 'Click anywhere to capture steps automatically. ';
    }
    if (autoCaptureEnterEnabled) {
      message += 'Press Enter to capture steps automatically. ';
    }
    
    return message.trim();
  };

  // Update local state when capture settings props change
  useEffect(() => {
    setAutoCaptureEnabled(autoCapture);
  }, [autoCapture]);

  useEffect(() => {
    setAutoCaptureEnterEnabled(autoCaptureEnter);
  }, [autoCaptureEnter]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-100 p-4 rounded mb-6 text-xs font-mono whitespace-pre">
          {debugInfo}
        </div>
        
        <p className="text-gray-600 max-w-md text-center">
          You need to select a project and create a tutorial before you can start recording. 
          Use the sidebar to select or create a project, then create a new tutorial.
        </p>
        
        <button
          onClick={handleRetryWithSelectedTutorial}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry with selected tutorial
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Add keyboard event capture overlay when recording is active */}
      {recordingState.isRecording && (
        <div
          className="fixed inset-0 z-50"
          style={{ 
            pointerEvents: 'none', // Allow mouse events to pass through
            backgroundColor: 'transparent' 
          }}
          tabIndex={0} // Make sure it can receive focus for keyboard events
          onKeyDown={(e) => {
            // Capture Enter key and prevent default behavior
            if (e.key === 'Enter') {
              console.log('[RecordingTab] Enter key blocked by overlay');
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        />
      )}

      <div className="w-full pt-12 pb-16 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-medium text-gray-800 mb-2">Screen Recording</h1>
        <p className="text-gray-600 mb-10">Capture your screen to create step-by-step documentation</p>

        <div className="text-center p-12 border border-gray-200 rounded-lg bg-white w-4/5 max-w-xl shadow-sm">
          <div className="bg-gray-50 rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-6">
            <ScreenIcon />
          </div>
          
          <h2 className="text-xl font-medium text-gray-800 mb-3">
            {recordingState.isRecording 
              ? (recordingState.isPaused 
                ? 'Recording Paused'
                : 'Recording in Progress')
              : 'Ready to Record'
            }
          </h2>
          
          <p className="text-gray-500 mb-8">
            {getRecordingStatusMessage()}
          </p>

          <div className="flex justify-center space-x-4">
            <button
              onClick={handleStartRecording}
              onKeyDown={(e) => {
                // Prevent Enter key from triggering this button during recording
                if (e.key === 'Enter' && recordingState.isRecording) {
                  e.preventDefault();
                  return false;
                }
              }}
              className={`inline-flex items-center py-2 px-5 rounded-md focus:outline-none text-sm font-medium ${
                recordingState.isRecording && !recordingState.isPaused
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              {getButtonIcon()}
              {getButtonText()}
            </button>

            {recordingState.isRecording && (
              <button
                onClick={handleStopRecording}
                onKeyDown={(e) => {
                  // Prevent Enter key from triggering this button during recording
                  if (e.key === 'Enter' && recordingState.isRecording) {
                    e.preventDefault();
                    return false;
                  }
                }}
                className="inline-flex items-center bg-red-600 hover:bg-red-700 text-white py-2 px-5 rounded-md focus:outline-none text-sm font-medium"
              >
                <StopIcon className="w-5 h-5 mr-2" />
                Stop Recording
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 