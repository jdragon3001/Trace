import React, { useState, useEffect, useRef } from 'react';
import {
  VideoCameraIcon,
  PencilSquareIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ComputerDesktopIcon as ComputerDesktopIconSolid,
} from '@heroicons/react/24/outline';

import { RecordingTab } from './RecordingTab';
import { StepsTab } from './StepsTab';
import { ExportTab } from './ExportTab';
import { ProjectSidebar, ProjectSidebarRef } from './ProjectSidebar';
import { TutorialList } from './TutorialList';
import { CreateProjectModal } from './CreateProjectModal';
import { CreateTutorialModal } from './CreateTutorialModal';
import { Project, Tutorial } from '../../shared/types';

// Tab state interface
interface TabsState {
  Record: { visible: boolean };
  EditSteps: { visible: boolean };
  Export: { visible: boolean };
  Project: { visible: boolean; projectId?: string };
}

export const App: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'Record' | 'EditSteps' | 'Export' | 'Project'>('Project');
  const [tabsState, setTabsState] = useState<TabsState>({
    Record: { visible: false },
    EditSteps: { visible: false },
    Export: { visible: false },
    Project: { visible: true }
  });

  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Recording settings state
  const [autoCapture, setAutoCapture] = useState(true);
  const [autoCaptureEnter, setAutoCaptureEnter] = useState(false);

  // Modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewTutorialModal, setShowNewTutorialModal] = useState(false);
  const [selectedProjectForTutorial, setSelectedProjectForTutorial] = useState<string | undefined>(undefined);

  // Add ref to ProjectSidebar
  const projectSidebarRef = useRef<ProjectSidebarRef>(null);

  // Flag to indicate a tutorial selection triggered a navigation intention
  const [navigateToRecordTab, setNavigateToRecordTab] = useState(false);

  // Shared state for steps to ensure real-time updates across tabs
  const [realtimeSteps, setRealtimeSteps] = useState<any[]>([]);
  
  // Listen for step recorded notifications
  useEffect(() => {
    const handleStepCreated = (step: any) => {
      console.log('[App] Received step created notification:', step);
      // Update shared steps state to ensure all tabs see the new step
      setRealtimeSteps(prev => [...prev, step]);
    };
    
    const removeListener = window.electronAPI?.onStepCreated(handleStepCreated);
    
    return () => {
      removeListener?.();
    };
  }, []);

  // Function to clear realtime steps when switching tutorials
  const clearRealtimeSteps = () => {
    setRealtimeSteps([]);
  };

  // Send initial recording settings to main process when component mounts
  useEffect(() => {
    if (window.electronAPI?.updateRecordingSettings) {
      window.electronAPI.updateRecordingSettings({
        autoCapture,
        autoCaptureEnter
      });
    }
  }, []);

  // Load current project and tutorial when the app starts
  useEffect(() => {
    loadCurrentState();
  }, []);

  // Function to load current project and tutorial
  const loadCurrentState = async () => {
    try {
      setIsLoading(true);
      const project = await window.electronAPI.getCurrentProject();
      const tutorial = await window.electronAPI.getCurrentTutorial();
      
      setCurrentProject(project);
      setCurrentTutorial(tutorial);
      
      if (project) {
        setTabsState(prev => ({
          ...prev,
          Project: { ...prev.Project, projectId: project.id }
        }));
      }
      
      // Automatically navigate to the Record tab if a tutorial exists
      if (tutorial && tutorial.id) {
        console.log('[App] Auto-navigating to most recent tutorial:', tutorial.title);
        setNavigateToRecordTab(true);
      }
    } catch (error) {
      console.error('Error loading current state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to switch tabs while preserving state
  const switchTab = (tab: 'Record' | 'EditSteps' | 'Export' | 'Project') => {
    console.log(`Switching to ${tab} tab. Current tutorial:`, currentTutorial);
    
    // Validate necessary parameters are present for this tab
    if (tab === 'Record' && (!currentTutorial || !currentTutorial.id)) {
      console.warn('Cannot switch to Record tab: No tutorial selected');
      alert('Please select a tutorial first');
      return;
    }
    
    setActiveTab(tab);
    setTabsState(prevState => ({
      ...prevState,
      [tab]: { ...prevState[tab], visible: true }
    }));
    
    console.log(`Successfully switched to ${tab} tab`);
  };

  // Function to handle project selection
  const handleProjectSelect = (projectId: string) => {
    setTabsState(prevState => ({
      ...prevState,
      Project: { ...prevState.Project, projectId }
    }));
    switchTab('Project');
  };

  // Function to open tutorial creation modal
  const handleCreateTutorial = (projectId: string) => {
    console.log(`Opening tutorial creation modal for project: ${projectId}`);
    setSelectedProjectForTutorial(projectId);
    setShowNewTutorialModal(true);
  };

  // Function to handle tutorial selection
  const handleTutorialSelect = async (tutorialId: string) => {
    try {
      setIsLoading(true);
      console.log(`[App] Setting current tutorial to: ${tutorialId}`);
      
      // First, get the tutorial to ensure it exists
      const tutorial = await window.electronAPI?.getTutorial(tutorialId);
      
      if (!tutorial) {
        console.error(`[App] Tutorial with ID ${tutorialId} not found`);
        alert('Error: Tutorial not found');
        setIsLoading(false);
        return;
      }
      
      // Set as current tutorial in main process
      await window.electronAPI.setCurrentTutorial(tutorialId);
      console.log('[App] Current tutorial after selection:', tutorial);
      
      // Clear realtime steps when switching tutorials
      clearRealtimeSteps();
      
      // Ensure we also set the project if it's available
      if (tutorial.projectId) {
        console.log(`[App] Setting current project to: ${tutorial.projectId}`);
        await window.electronAPI.setCurrentProject(tutorial.projectId);
        const project = await window.electronAPI.getCurrentProject();
        console.log('[App] Current project after selection:', project);
        
        if (project) {
          setCurrentProject(project);
        } else {
          console.error(`[App] Failed to get project ${tutorial.projectId}`);
        }
      }
      
      // Update state - this is async
      setCurrentTutorial(tutorial);
      console.log(`[App] Tutorial set in state (async): ${JSON.stringify(tutorial)}`);
      
      // Set flag to navigate after state update
      setNavigateToRecordTab(true); 
      
      // Refresh sidebar to show updated selection
      if (projectSidebarRef.current) {
        await projectSidebarRef.current.refreshProjects();
      }
      
    } catch (error) {
      console.error('[App] Error selecting tutorial:', error);
      alert(`Error selecting tutorial: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to switch tab AFTER tutorial state is updated
  useEffect(() => {
    if (navigateToRecordTab && currentTutorial) {
      console.log(`[App useEffect] Navigating to Record tab because currentTutorial updated:`, currentTutorial);
      switchTab('Record');
      // Reset the flag
      setNavigateToRecordTab(false);
    }
  }, [currentTutorial, navigateToRecordTab]); // Depend on both

  // Function to handle tutorial creation
  const handleTutorialCreated = async (tutorial: Tutorial) => {
    try {
      console.log('Tutorial created:', tutorial);
      
      if (!tutorial.id || !tutorial.projectId) {
        console.error('Created tutorial is missing id or projectId:', tutorial);
        alert('Error: Created tutorial data is incomplete');
        return;
      }
      
      // Set current project
      await window.electronAPI.setCurrentProject(tutorial.projectId);
      const project = await window.electronAPI.getCurrentProject();
      if (project) {
        setCurrentProject(project);
      }
      
      // Set current tutorial
      setCurrentTutorial(tutorial);
      setShowNewTutorialModal(false);
      
      // Refresh project sidebar to show the new tutorial
      if (projectSidebarRef.current) {
        console.log('[App] Refreshing project sidebar after tutorial creation');
        await projectSidebarRef.current.refreshProjects();
      }
      
      // Automatically switch to Record tab after tutorial creation
      setNavigateToRecordTab(true);
      
      // Explicitly ensure expanded state for the project in the sidebar
      if (projectSidebarRef.current) {
        // Force a refresh of projects after a delay to ensure the UI updates
        setTimeout(() => {
          projectSidebarRef.current?.refreshProjects();
        }, 300);
      }
    } catch (error) {
      console.error('Error handling created tutorial:', error);
      alert(`Error with created tutorial: ${error}`);
    }
  };

  // Function to handle project creation
  const handleProjectCreated = async (project: Project) => {
    console.log('[App] Project created successfully:', project);
    try {
      setCurrentProject(project);
      setShowNewProjectModal(false);
      
      // Refresh the project sidebar to show the new project
      if (projectSidebarRef.current) {
        console.log('[App] Refreshing project sidebar after project creation');
        await projectSidebarRef.current.refreshProjects();
      }
      
      // Select the newly created project
      if (project.id) {
        console.log('[App] Selecting newly created project:', project.id);
        handleProjectSelect(project.id);
      }
    } catch (error) {
      console.error('[App] Error after project creation:', error);
    }
  };

  // Handle recording settings change
  const handleRecordingSettingChange = (setting: string, value: boolean) => {
    console.log(`[App] Updating recording setting: ${setting} = ${value}`);
    if (setting === 'autoCapture') {
      setAutoCapture(value);
    } else if (setting === 'autoCaptureEnter') {
      setAutoCaptureEnter(value);
    }
    
    // Send settings to main process
    window.electronAPI?.updateRecordingSettings?.({
      autoCapture: setting === 'autoCapture' ? value : autoCapture,
      autoCaptureEnter: setting === 'autoCaptureEnter' ? value : autoCaptureEnter
    });
  };

  // Render tabs based on the active tab
  const renderTabs = () => {
    return (
      <>
        {activeTab === 'Record' && tabsState.Record.visible && (
          <RecordingTab 
            projectId={currentProject?.id} 
            tutorialId={currentTutorial?.id} 
            autoCapture={autoCapture}
            autoCaptureEnter={autoCaptureEnter}
          />
        )}
        {activeTab === 'EditSteps' && tabsState.EditSteps.visible && (
          <StepsTab 
            tutorialId={currentTutorial?.id}
            realtimeSteps={realtimeSteps} // Pass realtime steps to StepsTab
          />
        )}
        {activeTab === 'Export' && tabsState.Export.visible && (
          <ExportTab tutorialId={currentTutorial?.id} />
        )}
        {activeTab === 'Project' && tabsState.Project.visible && (
          <TutorialList 
            projectId={tabsState.Project.projectId || currentProject?.id || ''} 
            onTutorialSelect={handleTutorialSelect}
            onCreateTutorial={handleCreateTutorial}
          />
        )}
      </>
    );
  };

  // Sidebar for recording options
  const RightSidebarContent: React.FC = () => (
    <div className="flex flex-col space-y-6 pt-6">
      <div className="flex flex-col space-y-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">Recording Options</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Capture Mode</label>
              <div className="relative">
                <select
                  id="capture-mode"
                  name="capture-mode"
                  className="block w-full py-2 pl-3 pr-10 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 sm:text-sm"
                  defaultValue="Full Screen"
                >
                  <option>Full Screen</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7l3-3 3 3m0 6l-3 3-3-3" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <h4 className="block text-sm font-medium text-gray-700 mb-3">Capture Options</h4>
              <div className="space-y-3">
                <div className="flex items-start">
                  <div className="flex h-5 items-center">
                    <input 
                      id="auto-capture" 
                      name="auto-capture" 
                      type="checkbox" 
                      checked={autoCapture}
                      onChange={(e) => handleRecordingSettingChange('autoCapture', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" 
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="auto-capture" className="font-medium text-gray-700">Auto-capture on click</label>
                    <p className="text-gray-500 text-xs">Automatically take screenshots when you click</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex h-5 items-center">
                    <input 
                      id="auto-capture-enter" 
                      name="auto-capture-enter" 
                      type="checkbox" 
                      checked={autoCaptureEnter}
                      onChange={(e) => handleRecordingSettingChange('autoCaptureEnter', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" 
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="auto-capture-enter" className="font-medium text-gray-700">Auto-capture on pressing Enter</label>
                    <p className="text-gray-500 text-xs">Automatically take screenshots when you press Enter</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <button className="w-full text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 border border-gray-300 rounded-md transition-colors">
                Advanced Settings
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Keyboard Shortcuts Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Start/Pause</span>
            <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-600">Ctrl+Alt+R</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Stop Recording</span>
            <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-600">Ctrl+Alt+X</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Manual Screenshot</span>
            <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-600">Ctrl+Alt+C</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Left Sidebar - Projects */}
      <ProjectSidebar 
        ref={projectSidebarRef}
        onProjectSelect={handleProjectSelect}
        onTutorialSelect={handleTutorialSelect}
        onCreateProject={() => setShowNewProjectModal(true)}
        onCreateTutorial={handleCreateTutorial}
      />
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1">
        {/* Top Navigation */}
        <nav className="flex items-center border-b border-gray-200 px-6 h-14 bg-white">
          <div className="flex items-center space-x-1">
            <button
              className={`px-3 py-1.5 text-sm rounded-md focus:outline-none flex items-center ${
                activeTab === 'Project' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => switchTab('Project')}
            >
              <VideoCameraIcon className="h-4 w-4 mr-1" />
              Projects
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md focus:outline-none flex items-center ${
                activeTab === 'Record' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => {
                console.log("Record tab clicked, currentTutorial:", currentTutorial);
                if (currentTutorial && currentTutorial.id) {
                  switchTab('Record');
                } else {
                  alert('Please select or create a tutorial first.');
                }
              }}
              disabled={!currentTutorial || !currentTutorial.id}
            >
              <ComputerDesktopIconSolid className="h-4 w-4 mr-1" />
              Record
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md focus:outline-none flex items-center ${
                activeTab === 'EditSteps' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => {
                if (currentTutorial && currentTutorial.id) {
                  switchTab('EditSteps');
                } else {
                  alert('Please select or create a tutorial first.');
                }
              }}
              disabled={!currentTutorial || !currentTutorial.id}
            >
              <PencilSquareIcon className="h-4 w-4 mr-1" />
              Edit Steps
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md focus:outline-none flex items-center ${
                activeTab === 'Export' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => {
                if (currentTutorial && currentTutorial.id) {
                  switchTab('Export');
                } else {
                  alert('Please select or create a tutorial first.');
                }
              }}
              disabled={!currentTutorial || !currentTutorial.id}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Export
            </button>
          </div>
          
          {currentProject && (
            <span className="text-sm text-gray-500 ml-auto">
              Current Tutorial: <span className="font-medium text-gray-700">{currentTutorial?.title || 'N/A'}</span>
            </span>
          )}
        </nav>

        {/* Dynamic Content Area (where tabs are rendered) */}
        <main className="flex-1 overflow-hidden bg-gray-50 flex"> 
          <div className={`${activeTab === 'Record' ? 'w-2/3 pr-2' : 'flex-1'}`}>
            {renderTabs()}
          </div>
          
          {/* Right Sidebar - only visible when recording tab is active */}
          {activeTab === 'Record' && (
            <div className="w-1/3 bg-gray-50 p-6 overflow-y-auto">
              <RightSidebarContent />
            </div>
          )}
        </main>
      </div>
      
      {/* Modals */}
      <CreateProjectModal 
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onProjectCreated={handleProjectCreated}
        isLoading={isLoading}
      />
      
      <CreateTutorialModal
        isOpen={showNewTutorialModal}
        onClose={() => setShowNewTutorialModal(false)}
        onTutorialCreated={handleTutorialCreated}
        projectId={selectedProjectForTutorial}
        isLoading={isLoading}
      />
    </div>
  );
};
