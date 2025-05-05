import React, { useState, useEffect, useRef } from 'react';
import { Project, Tutorial } from '../../shared/types';

interface CreateTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTutorialCreated: (tutorial: Tutorial) => void;
  projectId?: string;
  isLoading?: boolean;
}

export const CreateTutorialModal: React.FC<CreateTutorialModalProps> = ({
  isOpen,
  onClose,
  onTutorialCreated,
  projectId,
  isLoading = false,
}) => {
  // Use ref for uncontrolled input
  const tutorialTitleRef = useRef<HTMLInputElement>(null);
  const modalKey = useRef(Date.now()).current;

  // Initialize selectedProjectId with default empty string and update with projectId when available
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      if (tutorialTitleRef.current) {
        tutorialTitleRef.current.value = '';
      }
      
      loadProjects();
      if (projectId) {
        setSelectedProjectId(projectId);
      }
    }
  }, [isOpen, projectId]);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      console.log('[CreateTutorialModal] Loading projects...');
      const projects = await window.electronAPI.getProjects();
      console.log('[CreateTutorialModal] Loaded projects:', projects);
      setProjects(projects);
      
      // If no project is selected and we have projects, select the first one
      if (!selectedProjectId && projects.length > 0 && projects[0].id) {
        console.log(`[CreateTutorialModal] Auto-selecting first project: ${projects[0].id}`);
        setSelectedProjectId(projects[0].id);
      }
    } catch (error) {
      console.error('[CreateTutorialModal] Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const title = tutorialTitleRef.current?.value?.trim();
    if (!title || !selectedProjectId) return;
    
    try {
      console.log(`[CreateTutorialModal] Creating tutorial with title: "${title}" for project: ${selectedProjectId}`);
      
      const tutorial = await window.electronAPI.createTutorial(
        selectedProjectId,
        title,
      );
      
      console.log('[CreateTutorialModal] Created tutorial:', tutorial);
      
      onTutorialCreated(tutorial);
      
      // Reset form
      if (tutorialTitleRef.current) tutorialTitleRef.current.value = '';
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('[CreateTutorialModal] Error creating tutorial:', error);
      // Show error to user
      alert(`Failed to create tutorial: ${error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">Create New Tutorial</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tutorial Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ref={tutorialTitleRef}
              placeholder="Enter tutorial title"
              required
              autoFocus
              spellCheck="false"
              key={`tutorial-title-input-${modalKey}`}
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project <span className="text-red-500">*</span>
            </label>
            {loadingProjects ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-500">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-500">
                No projects available. Please create a project first.
              </div>
            ) : (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                key={`project-select-${modalKey}`}
              >
                <option value="" disabled>Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none"
              onClick={() => {
                if (tutorialTitleRef.current) tutorialTitleRef.current.value = '';
                onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:bg-blue-300"
              disabled={!selectedProjectId || isLoading || projects.length === 0}
            >
              {isLoading ? 'Creating...' : 'Create Tutorial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 