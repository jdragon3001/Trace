import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Project, Tutorial } from '../../shared/types';
import {
  FolderIcon,
  PlusCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

export interface ProjectSidebarRef {
  refreshProjects: () => Promise<void>;
}

interface ProjectSidebarProps {
  onProjectSelect: (projectId: string) => void;
  onTutorialSelect: (tutorialId: string) => void;
  onCreateProject: () => void;
  onCreateTutorial: (projectId: string) => void;
  className?: string;
}

export const ProjectSidebar = forwardRef<ProjectSidebarRef, ProjectSidebarProps>(({
  onProjectSelect,
  onTutorialSelect,
  onCreateProject,
  onCreateTutorial,
  className = '',
}, ref) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentTutorials, setRecentTutorials] = useState<Tutorial[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [tutorialsByProject, setTutorialsByProject] = useState<Record<string, Tutorial[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTutorialId, setSelectedTutorialId] = useState<string | null>(null);
  // Track which dropdown is currently open
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Reference to detect clicks outside of dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Expose refreshProjects method to parent components
  useImperativeHandle(ref, () => ({
    refreshProjects: loadData
  }));

  // Load projects and recent tutorials
  const loadData = async () => {
    try {
      console.log('[ProjectSidebar] Loading data...');
      setIsLoading(true);
      const projectsData = await window.electronAPI.getProjects();
      const recentData = await window.electronAPI.getRecentProjects();
      
      console.log('[ProjectSidebar] Loaded projects:', projectsData);
      setProjects(projectsData);
      setRecentTutorials(recentData);
      
      // Load current selected project/tutorial from main process
      const currentProject = await window.electronAPI.getCurrentProject();
      const currentTutorial = await window.electronAPI.getCurrentTutorial();
      
      if (currentProject && currentProject.id) {
        setSelectedProjectId(currentProject.id);
        toggleProjectExpand(currentProject.id, true);
      }
      
      if (currentTutorial && currentTutorial.id) {
        setSelectedTutorialId(currentTutorial.id);
      }
      
      // Load tutorials for all projects to ensure the sidebar shows all tutorials
      const newTutorialsByProject: Record<string, Tutorial[]> = {};
      
      for (const project of projectsData) {
        if (!project.id) continue;
        
        try {
          console.log(`[ProjectSidebar] Loading tutorials for project ${project.id}`);
          const tutorials = await window.electronAPI.getTutorialsByProject(project.id);
          console.log(`[ProjectSidebar] Loaded ${tutorials.length} tutorials for project ${project.id}:`, tutorials);
          newTutorialsByProject[project.id] = tutorials;
        } catch (error) {
          console.error(`[ProjectSidebar] Error loading tutorials for project ${project.id}:`, error);
          newTutorialsByProject[project.id] = [];
        }
      }
      
      setTutorialsByProject(newTutorialsByProject);
    } catch (error) {
      console.error('[ProjectSidebar] Error loading project data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);

  // Load tutorials for a project when it's expanded
  useEffect(() => {
    const loadTutorialsForProjects = async () => {
      // Always refresh tutorials for expanded projects
      for (const projectId in expandedProjects) {
        if (expandedProjects[projectId]) {
          try {
            console.log(`[ProjectSidebar] Refreshing tutorials for expanded project ${projectId}`);
            const tutorials = await window.electronAPI.getTutorialsByProject(projectId);
            console.log(`[ProjectSidebar] Refreshed tutorials for project ${projectId}:`, tutorials);
            
            setTutorialsByProject(prev => ({
              ...prev,
              [projectId]: tutorials,
            }));
          } catch (error) {
            console.error(`[ProjectSidebar] Error refreshing tutorials for project ${projectId}:`, error);
          }
        }
      }
    };
    
    loadTutorialsForProjects();
  }, [expandedProjects]); // Only depend on expandedProjects, not tutorialsByProject

  const toggleProjectExpand = (projectId: string, forceExpand?: boolean) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: forceExpand !== undefined ? forceExpand : !prev[projectId],
    }));
  };

  const handleProjectClick = async (projectId: string) => {
    console.log(`[ProjectSidebar] Project clicked: ${projectId}`);
    setSelectedProjectId(projectId);
    onProjectSelect(projectId);
    await window.electronAPI.setCurrentProject(projectId);
    
    // Refresh projects and tutorials after selection
    await loadData();
    
    // Auto-expand the project
    toggleProjectExpand(projectId, true);
  };

  const handleTutorialClick = async (tutorialId: string) => {
    setSelectedTutorialId(tutorialId);
    onTutorialSelect(tutorialId);
    await window.electronAPI.setCurrentTutorial(tutorialId);
  };

  const handleCreateTutorial = (projectId: string) => {
    onCreateTutorial(projectId);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Toggle dropdown menu for projects or tutorials
  const toggleDropdown = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  // Handle delete project confirmation and deletion
  const handleDeleteProject = async (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveDropdown(null);
    
    if (confirm('Are you sure you want to delete this project? This will delete all tutorials inside it and cannot be undone.')) {
      try {
        await window.electronAPI.deleteProject(projectId);
        // Refresh the projects list
        await loadData();
      } catch (error) {
        console.error(`[ProjectSidebar] Error deleting project ${projectId}:`, error);
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  // Handle delete tutorial confirmation and deletion
  const handleDeleteTutorial = async (tutorialId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveDropdown(null);
    
    if (confirm('Are you sure you want to delete this tutorial? This cannot be undone.')) {
      try {
        await window.electronAPI.deleteTutorial(tutorialId);
        // Refresh the projects and tutorials
        await loadData();
      } catch (error) {
        console.error(`[ProjectSidebar] Error deleting tutorial ${tutorialId}:`, error);
        alert('Failed to delete tutorial. Please try again.');
      }
    }
  };

  return (
    <div className={`w-64 bg-gray-50 flex flex-col h-full border-r border-gray-200 ${className}`} ref={dropdownRef}>
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800">Projects</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* New Project Button */}
        <button
          onClick={onCreateProject}
          className="flex items-center w-full px-3 py-2 text-sm rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          <PlusCircleIcon className="h-5 w-5 mr-2" />
          <span>New Project</span>
        </button>
        
        {/* Projects Section */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 pb-1">
            All Projects
          </h3>
          
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No projects yet. Create your first one!</div>
          ) : (
            <div className="space-y-1">
              {projects.map(project => (
                <div key={project.id || 'unknown'} className="space-y-0.5">
                  <div 
                    className={`flex items-center px-3 py-2 text-sm rounded-md cursor-pointer group ${
                      selectedProjectId === project.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => project.id && toggleProjectExpand(project.id)}
                      className="mr-1 p-0.5 text-gray-400 hover:text-gray-700 focus:outline-none"
                    >
                      {project.id && expandedProjects[project.id] ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </button>
                    
                    <FolderIcon className="h-5 w-5 mr-2 text-yellow-500" />
                    
                    <span 
                      className="flex-1 truncate"
                      onClick={() => project.id && handleProjectClick(project.id)}
                      title={`${project.name}${project.description ? ` - ${project.description}` : ''}`}
                    >
                      {project.name}
                    </span>
                    
                    <div className="relative">
                      <button 
                        className="p-1 opacity-100 hover:bg-gray-200 rounded"
                        title="Project options"
                        onClick={(e) => project.id && toggleDropdown(`project-${project.id}`, e)}
                      >
                        <EllipsisHorizontalIcon className="h-4 w-4 text-gray-500" />
                      </button>
                      
                      {/* Project Options Dropdown */}
                      {project.id && activeDropdown === `project-${project.id}` && (
                        <div className="absolute right-0 mt-1 py-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                          <button
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            onClick={(e) => project.id && handleDeleteProject(project.id, e)}
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Delete Project
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Tutorials within Project */}
                  {project.id && expandedProjects[project.id] && (
                    <div className="pl-9 space-y-0.5">
                      {project.id && tutorialsByProject[project.id]?.length ? (
                        tutorialsByProject[project.id].map((tutorial: Tutorial) => (
                          <div
                            key={tutorial.id || 'unknown'}
                            className={`flex items-center px-3 py-2 text-sm rounded-md cursor-pointer ${
                              selectedTutorialId === tutorial.id
                                ? 'bg-blue-50 text-blue-600'
                                : 'hover:bg-gray-100 text-gray-600'
                            }`}
                            onClick={() => tutorial.id && handleTutorialClick(tutorial.id)}
                          >
                            <DocumentTextIcon className="h-4 w-4 mr-2" />
                            <span className="truncate flex-1" title={tutorial.title}>
                              {tutorial.title}
                            </span>
                            {tutorial.status === 'draft' && (
                              <span className="mr-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">Draft</span>
                            )}
                            
                            <div className="relative">
                              <button 
                                className="p-1 opacity-100 hover:bg-gray-200 rounded"
                                title="Tutorial options"
                                onClick={(e) => tutorial.id && toggleDropdown(`tutorial-${tutorial.id}`, e)}
                              >
                                <EllipsisHorizontalIcon className="h-4 w-4 text-gray-500" />
                              </button>
                              
                              {/* Tutorial Options Dropdown */}
                              {tutorial.id && activeDropdown === `tutorial-${tutorial.id}` && (
                                <div className="absolute right-0 mt-1 py-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                  <button
                                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    onClick={(e) => tutorial.id && handleDeleteTutorial(tutorial.id, e)}
                                  >
                                    <TrashIcon className="h-4 w-4 mr-2" />
                                    Delete Tutorial
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-500 italic">No tutorials yet</div>
                      )}
                      
                      {/* New Tutorial Button */}
                      <button
                        className="flex items-center w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                        onClick={() => project.id && handleCreateTutorial(project.id)}
                      >
                        <PlusCircleIcon className="h-3.5 w-3.5 mr-1" />
                        <span>New Tutorial</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Recent Tutorials Section */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 pb-1">
            Recent Tutorials
          </h3>
          
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading recent tutorials...</div>
          ) : recentTutorials.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No recent tutorials</div>
          ) : (
            <div className="space-y-0.5">
              {recentTutorials.slice(0, 5).map(tutorial => (
                <div
                  key={tutorial.id || 'unknown'}
                  className={`flex items-center px-3 py-2 text-sm rounded-md cursor-pointer ${
                    selectedTutorialId === tutorial.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => tutorial.id && handleTutorialClick(tutorial.id)}
                >
                  <ClockIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate flex-1" title={tutorial.title}>
                    {tutorial.title}
                  </span>
                  <span className="mr-2 text-xs text-gray-400">{formatDate(tutorial.updatedAt)}</span>
                  
                  <div className="relative">
                    <button 
                      className="p-1 opacity-100 hover:bg-gray-200 rounded"
                      title="Tutorial options"
                      onClick={(e) => tutorial.id && toggleDropdown(`recent-${tutorial.id}`, e)}
                    >
                      <EllipsisHorizontalIcon className="h-4 w-4 text-gray-500" />
                    </button>
                    
                    {/* Recent Tutorial Options Dropdown */}
                    {tutorial.id && activeDropdown === `recent-${tutorial.id}` && (
                      <div className="absolute right-0 mt-1 py-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                        <button
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          onClick={(e) => tutorial.id && handleDeleteTutorial(tutorial.id, e)}
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Delete Tutorial
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Manage Projects Button */}
      <div className="p-3 border-t border-gray-200">
        <button
          className="flex items-center justify-center w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
          onClick={() => {
            // Show Manage Projects dialog (to be implemented)
          }}
        >
          <span>Manage Projects</span>
        </button>
      </div>
    </div>
  );
}); 