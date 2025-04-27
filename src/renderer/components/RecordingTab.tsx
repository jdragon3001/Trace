import React, { useState, useEffect } from 'react';
import { PlayIcon as PlayIconSolid, PauseIcon, StopIcon } from '@heroicons/react/24/solid';
import { ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { IpcChannels } from '../../shared/constants';
import { RecordingStep } from '../../shared/types';

// Placeholder for an icon component or SVG
const ScreenIcon = () => (
  <ComputerDesktopIcon className="w-20 h-20 text-gray-300 mx-auto mb-6" />
);

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
}

export const RecordingTab: React.FC = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false
  });

  useEffect(() => {
    console.log('[RecordingTab] Adding listeners...');
    console.log('Checking window.electronAPI:', window.electronAPI);

    const handleRecordingStatus = (state: RecordingState) => {
      console.log('[RecordingTab] Received recording-status:', state);
      setRecordingState(state);
    };

    const handleRecordingError = (error: string) => {
      console.error('[RecordingTab] Received recording-error:', error);
      // TODO: Show error in UI
    };

    const handleStepCreated = (step: RecordingStep) => {
        console.log('[RecordingTab] Received step:created (but handling in StepsTab):', step);
        // NOTE: Actual step handling is likely in StepsTab, 
        // but we add the listener call here for consistency if needed later.
        // Or, remove this if RecordingTab truly doesn't need to know about new steps.
    };

    const removeStatusListener = window.electronAPI?.onRecordingStatus(handleRecordingStatus); 
    const removeErrorListener = window.electronAPI?.onRecordingError(handleRecordingError);
    const removeStepListener = window.electronAPI?.onStepCreated(handleStepCreated);

    return () => {
      console.log('[RecordingTab] Removing listeners...');
      removeStatusListener?.();
      removeErrorListener?.();
      removeStepListener?.();
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      if (!recordingState.isRecording) {
        await window.electronAPI?.startRecording();
      } else if (recordingState.isPaused) {
        await window.electronAPI?.resumeRecording();
      } else {
        await window.electronAPI?.pauseRecording();
      }
    } catch (error) {
      console.error('Failed to handle recording action:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      await window.electronAPI?.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
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

  // Keep only the central content area, remove the outer flex div
  // Style this div to match the screenshot's central area
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-1">Screen Recording</h1>
      <p className="text-gray-500 mb-8">Capture your screen to create step-by-step documentation</p>

      <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 max-w-lg w-full">
        <ScreenIcon />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          {recordingState.isRecording 
            ? recordingState.isPaused 
              ? 'Recording Paused'
              : 'Recording in Progress'
            : 'Ready to Record'
          }
        </h2>
        
        <p className="text-gray-500 mb-6">
          {recordingState.isRecording
            ? 'Click anywhere to capture steps automatically'
            : 'Click Start Recording to begin capturing your actions'
          }
        </p>

        <div className="flex justify-center space-x-4">
          <button
            onClick={handleStartRecording}
            className={`inline-flex items-center font-bold py-2 px-5 rounded focus:outline-none focus:shadow-outline ${
              recordingState.isRecording && !recordingState.isPaused
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-gray-800 hover:bg-gray-900 text-white'
            }`}
          >
            {getButtonIcon()}
            {getButtonText()}
          </button>

          {recordingState.isRecording && (
            <button
              onClick={handleStopRecording}
              className="inline-flex items-center bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-5 rounded focus:outline-none focus:shadow-outline"
            >
              <StopIcon className="w-5 h-5 mr-2" />
              Stop Recording
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 