import React, { useState, useRef } from 'react';
import { Project } from '../../shared/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
  isLoading?: boolean;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  isLoading = false,
}) => {
  // Use refs for uncontrolled form elements
  const projectNameRef = useRef<HTMLInputElement>(null);
  const projectDescriptionRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = projectNameRef.current?.value?.trim();
    if (!name) return;
    
    try {
      const project = await window.electronAPI.createProject(
        name,
        projectDescriptionRef.current?.value?.trim() || undefined
      );
      
      onProjectCreated(project);
      
      // Reset form
      if (projectNameRef.current) projectNameRef.current.value = '';
      if (projectDescriptionRef.current) projectDescriptionRef.current.value = '';
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ref={projectNameRef}
              placeholder="Enter project name"
              required
              autoFocus
              spellCheck="false"
              key="project-name-input"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ref={projectDescriptionRef}
              placeholder="Add a short description for this project"
              rows={3}
              spellCheck="false"
              key="project-description-input"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none"
              onClick={() => {
                if (projectNameRef.current) projectNameRef.current.value = '';
                if (projectDescriptionRef.current) projectDescriptionRef.current.value = '';
                onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:bg-blue-300"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 