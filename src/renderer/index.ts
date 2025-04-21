// This file is the entry point for the renderer process
console.log('Renderer process started');

// Basic DOM manipulation example
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (root) {
        console.log('Application loaded successfully');
    }
});

// Initialize any renderer-specific code here
// For now, we're using the basic HTML file with inline JavaScript 