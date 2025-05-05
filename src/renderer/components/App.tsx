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

  // Modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewTutorialModal, setShowNewTutorialModal] = useState(false);
  const [selectedProjectForTutorial, setSelectedProjectForTutorial] = useState<string | undefined>(undefined);

  // Add ref to ProjectSidebar
  const projectSidebarRef = useRef<ProjectSidebarRef>(null);

  // Flag to indicate a tutorial selection triggered a navigation intention
  const [navigateToRecordTab, setNavigateToRecordTab] = useState(false);

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
      const tutorial = await window.electronAPI.getTutorial(tutorialId);
      
      if (!tutorial) {
        console.error(`[App] Tutorial with ID ${tutorialId} not found`);
        alert('Error: Tutorial not found');
        setIsLoading(false);
        return;
      }
      
      // Set as current tutorial in main process
      await window.electronAPI.setCurrentTutorial(tutorialId);
      console.log('[App] Current tutorial after selection:', tutorial);
      
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
      
      // Switch to Project tab to show tutorial list, but don't start recording
      setTabsState(prevState => ({
        ...prevState,
        Project: { ...prevState.Project, projectId: tutorial.projectId }
      }));
      setActiveTab('Project');
      
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

  // Render tabs based on the active tab
  const renderTabs = () => {
    return (
      <>
        <div style={{ display: activeTab === 'Record' ? 'block' : 'none' }}>
          <RecordingTab 
            projectId={currentProject?.id}
            tutorialId={currentTutorial?.id}
          />
        </div>
        <div style={{ display: activeTab === 'EditSteps' ? 'block' : 'none' }}>
          <StepsTab tutorialId={currentTutorial?.id} />
        </div>
        <div style={{ display: activeTab === 'Export' ? 'block' : 'none' }}>
          <ExportTab tutorialId={currentTutorial?.id} />
        </div>
        <div style={{ display: activeTab === 'Project' ? 'block' : 'none' }}>
          {tabsState.Project.projectId ? (
            <TutorialList 
              projectId={tabsState.Project.projectId} 
              onTutorialSelect={handleTutorialSelect}
              onCreateTutorial={handleCreateTutorial}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-gray-500">
              <p>No project selected. Please select a project from the sidebar.</p>
            </div>
          )}
        </div>
      </>
    );
  };

  // Sidebar for recording options
  const RightSidebarContent: React.FC = () => (
    <div className="w-72 bg-gray-100 p-5 flex flex-col space-y-6 border-l border-gray-200">
      {/* Recording Options Card */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-base font-semibold mb-4 text-gray-800">Recording Options</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="capture-mode" className="block text-sm font-medium text-gray-700 mb-1">Capture Mode</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ComputerDesktopIconSolid className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <select
                id="capture-mode"
                name="capture-mode"
                className="block w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm bg-white"
                defaultValue="Full Screen"
              >
                <option>Full Screen</option>
              </select>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Capture Options</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <input id="auto-capture" name="auto-capture" type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                <label htmlFor="auto-capture" className="ml-2 block text-sm text-gray-900">Auto-capture on click</label>
              </div>
              <div className="flex items-center">
                <input id="include-cursor" name="include-cursor" type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                <label htmlFor="include-cursor" className="ml-2 block text-sm text-gray-900">Include cursor in screenshots</label>
              </div>
              <div className="flex items-center">
                <input id="record-audio" name="record-audio" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                <label htmlFor="record-audio" className="ml-2 block text-sm text-gray-900">Record audio</label>
              </div>
            </div>
          </div>
          <div>
            <button className="mt-2 w-full text-sm bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
              Advanced Settings
            </button>
          </div>
        </div>
      </div>
      {/* Keyboard Shortcuts Card */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-base font-semibold mb-3 text-gray-800">Keyboard Shortcuts</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Start/Pause</span>
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 text-gray-600">Ctrl+Alt+R</span>
          </div>
          <div className="flex justify-between">
            <span>Stop Recording</span>
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 text-gray-600">Ctrl+Alt+S</span>
          </div>
          <div className="flex justify-between">
            <span>Manual Screenshot</span>
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 text-gray-600">Ctrl+Alt+C</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="flex h-screen bg-white text-gray-800">
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
                  console.log(`Navigating to Record tab with tutorial: ${currentTutorial.id}`);
                  switchTab('Record');
                } else {
                  // Alert user to select a tutorial first
                  alert('Please select a tutorial first');
                }
              }}
            >
              <VideoCameraIcon className="h-4 w-4 mr-1" />
              Record
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md focus:outline-none flex items-center ${
                activeTab === 'EditSteps' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => {
                if (currentTutorial) {
                  switchTab('EditSteps');
                } else {
                  // Alert user to select a tutorial first
                  alert('Please select a tutorial first');
                }
              }}
            >
              <PencilSquareIcon className="h-4 w-4 mr-1" />
              Edit Steps
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-md focus:outline-none flex items-center ${
                activeTab === 'Export' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => {
                if (currentTutorial) {
                  switchTab('Export');
                } else {
                  // Alert user to select a tutorial first
                  alert('Please select a tutorial first');
                }
              }}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Export
            </button>
          </div>
          <div className="ml-auto flex items-center space-x-1">
            <button className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100">
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
            <button className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100">
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </button>
          </div>
        </nav>
        
        {/* Current Tutorial Info */}
        {currentTutorial && (activeTab === 'Record' || activeTab === 'EditSteps' || activeTab === 'Export') && (
          <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-sm text-gray-500">Current Tutorial:</span>
              <span className="ml-2 text-sm font-medium text-gray-800">{currentTutorial.title}</span>
              {activeTab === 'Record' && (
                <span className="ml-auto text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  {currentTutorial.status}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {renderTabs()}
        </div>
      </div>
      
      {/* Right Sidebar - Options */}
      {(activeTab === 'Record') && <RightSidebarContent />}
      
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
