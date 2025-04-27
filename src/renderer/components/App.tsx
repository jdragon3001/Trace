import React, { useState } from 'react';
// Restore imports
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

// Restore interface
interface Project {
  id: string;
  name: string;
}

// Tab state interface to store individual tab states
interface TabsState {
  Record: { visible: boolean };
  EditSteps: { visible: boolean };
  Export: { visible: boolean };
}

export const App: React.FC = () => {
  // Restore state
  const [activeTab, setActiveTab] = useState<'Record' | 'EditSteps' | 'Export'>('Record');
  
  // Initialize all tabs with their state
  const [tabsState, setTabsState] = useState<TabsState>({
    Record: { visible: true },
    EditSteps: { visible: false },
    Export: { visible: false }
  });

  // Function to switch tabs while preserving state
  const switchTab = (tab: 'Record' | 'EditSteps' | 'Export') => {
    setActiveTab(tab);
    setTabsState(prevState => ({
      ...prevState,
      [tab]: { ...prevState[tab], visible: true }
    }));
  };

  // Restore variables/functions
  const recentProjects: Project[] = [
    { id: '1', name: 'Login Flow Tutorial' },
    { id: '2', name: 'Dashboard Setup' },
  ];

  // Render all tabs but only show the active one
  const renderTabs = () => {
    return (
      <>
        <div style={{ display: activeTab === 'Record' ? 'block' : 'none' }}>
          <RecordingTab />
        </div>
        <div style={{ display: activeTab === 'EditSteps' ? 'block' : 'none' }}>
          <StepsTab />
        </div>
        <div style={{ display: activeTab === 'Export' ? 'block' : 'none' }}>
          <ExportTab />
        </div>
      </>
    );
  };

  const RightSidebarContent: React.FC = () => (
    // Restore original sidebar content
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

  // Restore original return statement
  return (
    <div className="flex h-screen bg-gray-200 font-sans">
      <div className="w-60 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 font-bold text-lg text-gray-700 h-14 flex items-center">OpenScribe</div>
        <div className="flex-1 p-5 overflow-y-auto">
          <button className="mb-6 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm font-medium shadow-sm">
            + New Project
          </button>
          <h3 className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wider">Projects</h3>
          <ul className="mb-6">
             <li className="py-1 px-2 rounded text-sm text-gray-700 hover:bg-gray-200 cursor-pointer font-medium">
                Untitled Project
             </li>
          </ul>
          <h3 className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wider">Recent</h3>
          <ul>
            {recentProjects.map(project => (
              <li key={project.id} className="py-1 px-2 rounded text-sm text-gray-700 hover:bg-gray-200 cursor-pointer">
                {project.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14 flex-shrink-0">
           <div className="flex items-center space-x-1">
              <button
                 onClick={() => switchTab('Record')}
                 className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'Record' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
              >
                 <VideoCameraIcon className="w-4 h-4 mr-1.5" />
                 Record
              </button>
              <button
                 onClick={() => switchTab('EditSteps')}
                 className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'EditSteps' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
              >
                 <PencilSquareIcon className="w-4 h-4 mr-1.5" />
                 Edit Steps
              </button>
              <button
                 onClick={() => switchTab('Export')}
                 className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'Export' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
              >
                 <ArrowDownTrayIcon className="w-4 h-4 mr-1.5" />
                 Export
              </button>
           </div>
           <div className="flex items-center space-x-3">
              <button className="text-gray-500 hover:text-gray-700">
                <QuestionMarkCircleIcon className="w-5 h-5" />
              </button>
              <button className="text-gray-500 hover:text-gray-700">
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
           </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-white">
            {renderTabs()}
          </div>
          <RightSidebarContent />
        </div>
        <div className="bg-gray-100 border-t border-gray-200 px-4 py-1.5 text-xs text-gray-600 flex justify-between items-center h-8 flex-shrink-0">
           <span>Ready</span>
           <span>3 steps • Last saved: 2 minutes ago</span>
        </div>
      </div>
    </div>
  );
};
