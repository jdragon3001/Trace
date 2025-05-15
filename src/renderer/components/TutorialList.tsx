import React, { useState, useEffect } from 'react';
import { Project, Tutorial } from '../../shared/types';
import {
  DocumentTextIcon,
  PlusCircleIcon,
  FolderIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface TutorialListProps {
  projectId: string;
  onTutorialSelect: (tutorialId: string) => void;
  onCreateTutorial: (projectId: string) => void;
}

export const TutorialList: React.FC<TutorialListProps> = ({
  projectId,
  onTutorialSelect,
  onCreateTutorial,
}) => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load project details
      const projectData = await window.electronAPI.setCurrentProject(projectId);
      setProject(projectData);
      
      // Load tutorials for this project
      const tutorialsData = await window.electronAPI.getTutorialsByProject(projectId);
      setTutorials(tutorialsData);
    } catch (err) {
      console.error('Error loading project data:', err);
      setError('Failed to load project data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTutorialClick = async (tutorialId: string) => {
    try {
      await window.electronAPI.setCurrentTutorial(tutorialId);
      onTutorialSelect(tutorialId);
    } catch (err) {
      console.error('Error selecting tutorial:', err);
    }
  };

  // Function to format date strings
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-gray-500">
        <ArrowPathIcon className="h-10 w-10 animate-spin mb-4" />
        <p>Loading project data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-red-500">
        <ExclamationCircleIcon className="h-10 w-10 mb-4" />
        <p className="mb-4">{error}</p>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          onClick={loadData}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-gray-500">
        <p>No project selected. Please select a project from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-start">
          <FolderIcon className="h-8 w-8 text-gray-500 mr-3 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Created: {formatDate(project.createdAt)} • Last updated: {formatDate(project.updatedAt)}
            </p>
          </div>
          <button
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            onClick={() => onCreateTutorial(projectId)}
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            <span>New Tutorial</span>
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">Tutorials</h2>

      {tutorials.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No tutorials yet</h3>
          <p className="text-gray-600 mb-4">
            Create your first tutorial to start recording steps.
          </p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center"
            onClick={() => onCreateTutorial(projectId)}
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            <span>Create Tutorial</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutorials.map(tutorial => (
            <div
              key={tutorial.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
              onClick={() => handleTutorialClick(tutorial.id)}
            >
              <div className="flex items-start mb-2">
                <DocumentTextIcon className="h-6 w-6 text-gray-500 mr-2 flex-shrink-0" />
                <h3 className="text-lg font-medium text-gray-800 flex-1 truncate" title={tutorial.title}>
                  {tutorial.title}
                </h3>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Updated: {formatDate(tutorial.updatedAt)}</span>
                {tutorial.status !== 'draft' ? (
                  tutorial.status === 'ready' ? (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                      Ready
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      Exported
                    </span>
                  )
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 