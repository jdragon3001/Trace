import React, { useState, useEffect } from 'react';
import { useStepsStore } from '../store/useStepsStore';

// Placeholder icon
const ImageIcon = () => <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>;

// Toggle Switch Component (Example)
const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void }> = ({ label, enabled, onChange }) => {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <button
        type="button"
        className={`${enabled ? 'bg-indigo-600' : 'bg-gray-200'}
          relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
      >
        <span
          aria-hidden="true"
          className={`${enabled ? 'translate-x-5' : 'translate-x-0'}
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
        />
      </button>
    </div>
  );
};

interface ExportTabProps {
  tutorialId?: string;
}

export const ExportTab: React.FC<ExportTabProps> = ({ tutorialId }) => {
  // TODO: Implement state and handlers for export settings, format selection, preview, etc.
  const [docTitle, setDocTitle] = useState('My Documentation');
  const [includeScreenshots, setIncludeScreenshots] = useState(true);
  const [includeStepNumbers, setIncludeStepNumbers] = useState(true);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'DOCX'>('PDF');

  const handleExport = () => {
    console.log(`Exporting as ${exportFormat} with title: ${docTitle}, screenshots: ${includeScreenshots}, numbers: ${includeStepNumbers}`);
    // Call actual export logic
  };

  // You can use the tutorialId to load steps for the specific tutorial

  return (
    <div className="p-6 bg-white h-full flex space-x-6">
      {/* Left Column: Settings */} 
      <div className="w-1/3 flex-shrink-0 flex flex-col space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">Export Documentation</h2>
        <p className="text-sm text-gray-600">Export your documentation as PDF or DOCX</p>

        {/* Document Settings */} 
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
          <h3 className="font-medium text-gray-900">Document Settings</h3>
          <div>
            <label htmlFor="doc-title" className="block text-sm font-medium text-gray-700">Document Title</label>
            <input
              type="text"
              id="doc-title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <ToggleSwitch label="Include Screenshots" enabled={includeScreenshots} onChange={setIncludeScreenshots} />
          <ToggleSwitch label="Include Step Numbers" enabled={includeStepNumbers} onChange={setIncludeStepNumbers} />
        </div>

        {/* Export Format */} 
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
          <h3 className="font-medium text-gray-900">Export Format</h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => setExportFormat('PDF')}
              className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${exportFormat === 'PDF' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              PDF
            </button>
            <button 
              onClick={() => setExportFormat('DOCX')}
              className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${exportFormat === 'DOCX' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              DOCX
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {exportFormat === 'PDF' 
              ? 'Export as PDF for a fixed layout that looks the same on all devices. Best for sharing and printing.'
              : 'Export as DOCX for editing in Microsoft Word or other compatible applications.'
            }
          </p>
        </div>

        {/* Export Button */} 
        <button
          onClick={handleExport}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Export Documentation
        </button>
      </div>

      {/* Right Column: Preview */} 
      <div className="flex-1 border border-gray-200 rounded-lg bg-gray-50 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-gray-900">Preview</h3>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Full Preview</button>
        </div>
        {/* TODO: Implement actual preview rendering based on steps and settings */} 
        <div className="flex-1 bg-white border border-gray-200 rounded overflow-y-auto p-4 space-y-3">
          <h4 className="font-bold text-lg mb-4">{docTitle}</h4>
          {/* Example step preview */}
          <div className="flex space-x-3">
            {includeStepNumbers && <span className="font-medium text-gray-700">1</span>}
            <span className="text-gray-800">Navigate to settings</span>
          </div>
          {includeScreenshots && 
            <div className="pl-6 py-2">
              <div className="w-full aspect-video bg-gray-100 border rounded flex items-center justify-center">
                <ImageIcon />
              </div>
            </div>
          }
          {/* Add more preview steps here */} 
          <div className="flex space-x-3">
            {includeStepNumbers && <span className="font-medium text-gray-700">2</span>}
            <span className="text-gray-800">Select preferences</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 