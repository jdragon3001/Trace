import { IpcChannels } from '../shared/constants';
import { RecordingStep, Project, Tutorial, Step, ShapeData } from '../shared/types';

declare global {
  interface Window {
    electronAPI: {
      startRecording: () => Promise<void>;
      stopRecording: () => Promise<void>;
      pauseRecording: () => Promise<void>;
      resumeRecording: () => Promise<void>;
      onStepCreated: (callback: (step: RecordingStep) => void) => (() => void) | undefined;
      onRecordingStatus: (callback: (state: { isRecording: boolean; isPaused: boolean }) => void) => (() => void) | undefined;
      onRecordingError: (callback: (error: string) => void) => (() => void) | undefined;
      getSteps: () => Promise<RecordingStep[]>;
      addStep: (step: RecordingStep) => void;
      getAudioSources: () => Promise<unknown[]>;
      
      // Region Selection APIs
      updateCaptureMode: (mode: 'fullScreen' | 'customRegion') => Promise<{ success: boolean }>;
      selectCaptureRegion: () => Promise<{ x: number, y: number, width: number, height: number } | null>;
      onRegionSelected: (callback: (region: { x: number, y: number, width: number, height: number }) => void) => (() => void) | undefined;
      
      // Step notification
      notifyStepRecorded: (step: RecordingStep) => void;
      
      // Project Management
      getProjects: () => Promise<Project[]>;
      getRecentProjects: () => Promise<Tutorial[]>;
      createProject: (name: string, description?: string) => Promise<Project>;
      deleteProject: (projectId: string) => Promise<boolean>;
      
      // Tutorial Management
      createTutorial: (projectId: string, title: string) => Promise<Tutorial>;
      getTutorialsByProject: (projectId: string) => Promise<Tutorial[]>;
      deleteTutorial: (tutorialId: string) => Promise<boolean>;
      getTutorial: (tutorialId: string) => Promise<Tutorial | null>;
      updateTutorialStatus: (tutorialId: string, status: 'draft' | 'ready' | 'exported') => Promise<Tutorial>;
      
      // Legacy Project Methods (will be removed in future)
      saveProject: (steps: RecordingStep[], filePath?: string) => Promise<Project | null>;
      loadProject: (filePath: string) => Promise<{project: Project; steps: RecordingStep[]} | null>;
      
      // Step Management
      saveStep: (step: Step) => Promise<Step>;
      getStepsByTutorial: (tutorialId: string) => Promise<Step[]>;
      updateStep: (step: Step) => Promise<Step>;
      deleteStep: (stepId: string) => Promise<boolean>;
      reorderSteps: (steps: Pick<Step, 'id' | 'order'>[]) => Promise<boolean>;
      
      // Shape Management
      saveShapes: (stepId: string, imagePath: string, shapes: ShapeData[]) => Promise<ShapeData[]>;
      getShapesByImage: (imagePath: string, stepId?: string) => Promise<ShapeData[]>;
      getShapesByStep: (stepId: string) => Promise<ShapeData[]>;
      
      // State Management
      getCurrentProject: () => Promise<Project | null>;
      getCurrentTutorial: () => Promise<Tutorial | null>;
      setCurrentProject: (projectId: string) => Promise<Project>;
      setCurrentTutorial: (tutorialId: string | null) => Promise<void>;
      
      // Recording Settings
      updateRecordingSettings: (settings: { autoCapture: boolean, autoCaptureEnter: boolean }) => Promise<void>;
      
      // Export
      exportProject: (format: string, steps: RecordingStep[], filePath: string) => Promise<void>;
      exportTutorial: (tutorialId: string, options: {
        docTitle: string;
        includeScreenshots: boolean;
        includeStepNumbers: boolean;
        exportFormat: 'PDF' | 'DOCX';
      }) => Promise<string>;
      prepareShapesForExport: (tutorialId: string, shapeData: Record<string, Array<any>>) => Promise<boolean>;
      exportPrepareShapes: (tutorialId: string, shapeData: Record<string, Array<any>>) => Promise<boolean>;
      loadImageAsDataUrl: (imagePath: string) => Promise<string>;
      
      // File operations
      openFileDialog: (options: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
      }) => Promise<{ canceled: boolean; filePaths: string[] }>;
      
      copyImageFile: (options: {
        sourcePath: string;
        tutorialId: string;
        stepId: string;
        makeBackup?: boolean;
      }) => Promise<string>;
      
      saveDataUrlToTempFile: (options: {
        dataUrl: string;
        fileType: string;
      }) => Promise<string>;

      // Assets API
      getAssetsByTutorial: (tutorialId: string) => Promise<any[]>;

      // Load shapes from JSON files
      loadShapesFromJson: (imagePath: string) => Promise<any[]>;
    };
    systemPreferences: {
      getMediaAccessStatus: (mediaType: string) => Promise<string>;
    };
  }
}

export {}; 