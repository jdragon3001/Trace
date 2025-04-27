console.log('--- Renderer Script Execution Start ---');

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './styles/index.css'; // <-- Restored CSS import

console.log('Imports loaded.');

const container = document.getElementById('root');
console.log('Found container:', container ? 'Yes' : 'No');

if (!container) {
  console.error('Failed to find root element!');
  throw new Error('Failed to find root element');
} else {
  try {
    console.log('Attempting to create root...');
    const root = createRoot(container);
    console.log('Root created. Attempting to render App...');
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('App render call completed.'); // This might log even if App errors internally
  } catch (error) {
    console.error('Error during root creation or initial render:', error);
  }
} 