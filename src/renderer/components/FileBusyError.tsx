import React from 'react';

interface FileBusyErrorProps {
  fileName?: string;
  className?: string;
}

/**
 * A component that displays a user-friendly error message when a file is 
 * locked/busy because it's open in another program.
 */
export const FileBusyError: React.FC<FileBusyErrorProps> = ({ className = '' }) => {
  return (
    <div className={`p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 rounded ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm">
            <strong>File in Use</strong> - The file is currently open in another program.
          </p>
          <p className="text-sm mt-1">
            Please close the file and try again.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileBusyError; 