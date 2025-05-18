# Project Structure

This document outlines the file and directory structure for the OpenScribe application.

## Root Directory

-   `/`: Contains configuration files (package.json, tsconfig.json, etc.) and main directories.
-   `/dist/`: Build output directory.
-   `/node_modules/`: Project dependencies.
-   `/src/`: Main application source code.
-   `/docs/`: Project documentation (optional).
-   `STRUCTURE.md`: This file.
-   `DEPRECATED.txt`: List of deprecated code patterns.
-   `PROBLEM_LOG.txt`: Log of persistent development issues.

## `/src` Directory

Contains the core application code, split into main process, renderer process, and shared code.

-   `/src/main/`: Electron Main process code.
    -   `/src/main/services/`: Core backend services (e.g., `RecordingService`, `ImageService`, `ScreenshotService`, `ProjectService`).
    -   `/src/main/windows/`: Main window creation and management.
    -   `main.ts`: Entry point for the main process.
    -   `preload.ts`: Preload script for bridging main and renderer processes.
-   `/src/renderer/`: Electron Renderer process code (React application).
    -   `/src/renderer/components/`: Reusable React components.
    -   `/src/renderer/hooks/`: Custom React hooks.
    -   `/src/renderer/pages/` or `/src/renderer/views/`: Top-level page components.
    -   `/src/renderer/store/`: State management (e.g., Zustand, Redux).
    -   `/src/renderer/styles/`: Global styles or themes.
    -   `index.html`: HTML template.
    -   `index.tsx`: Entry point for the React application.
-   `/src/shared/`: Code shared between Main and Renderer processes.
    -   `/src/shared/constants.ts`: Shared constants like IPC channel names.
    -   `/src/shared/types.ts`: TypeScript type definitions.
    -   `/src/shared/utils/`: Shared utility functions.

## Architectural Decisions

-   **IPC Communication:** Uses defined channels in `constants.ts` for type safety.
-   **State Management:** (Specify chosen library, e.g., Zustand) handles application state in the renderer.
-   **Services:** Main process services encapsulate specific functionalities (Recording, Imaging, etc.).
-   **Project Management:** ProjectService handles project saving, loading, and tracking in user data folder.
-   **UI Framework:** React with TypeScript.
-   **Database:** Uses SQLite via better-sqlite3 for project, tutorial, and step data management.
-   **Screen Buffering:** Continuously captures the screen state in the background and uses the pre-click frame when a click is detected, ensuring UI changes don't appear in screenshots prematurely.

## UI Structure

The application uses a multiple-sidebar layout:

-   **Left Sidebar:** Project navigation and tutorial selection
-   **Main Content Area:** Dynamic content based on active tab
    -   Project Tab: Displays list of tutorials in the selected project
    -   Record Tab: Screen recording interface
    -   Edit Steps Tab: Interface for editing captured tutorial steps
    -   Export Tab: Options for exporting tutorials
-   **Right Sidebar:** Context-specific options (only visible in certain tabs)
    -   When Record Tab is active: Recording options panel
        -   Capture mode selection
        -   Auto-capture on click toggle
        -   Auto-capture on Enter key toggle
        -   Keyboard shortcuts reference

The UI implements responsive design for different screen sizes and follows a consistent design language.

## Database Schema

The application uses SQLite to store project data with the following schema:

-   **Projects:** Top-level entities that group related tutorials
    -   `id`: TEXT PRIMARY KEY - unique identifier
    -   `name`: TEXT NOT NULL - project name
    -   `description`: TEXT - optional description
    -   `createdAt`: TEXT NOT NULL - creation timestamp
    -   `updatedAt`: TEXT NOT NULL - last modification timestamp
    -   `tags`: TEXT - JSON array of tag strings

-   **Tutorials:** Screen recording sessions that belong to a project
    -   `id`: TEXT PRIMARY KEY - unique identifier
    -   `projectId`: TEXT NOT NULL - references projects.id
    -   `title`: TEXT NOT NULL - tutorial title
    -   `status`: TEXT NOT NULL - 'draft', 'ready', or 'exported'
    -   `createdAt`: TEXT NOT NULL - creation timestamp
    -   `updatedAt`: TEXT NOT NULL - last modification timestamp

-   **Steps:** Individual actions within a tutorial
    -   `id`: TEXT PRIMARY KEY - unique identifier
    -   `tutorialId`: TEXT NOT NULL - references tutorials.id
    -   `order`: INTEGER NOT NULL - step position
    -   `screenshotPath`: TEXT NOT NULL - path to screenshot image
    -   `actionText`: TEXT - description of the action
    -   `timestamp`: TEXT NOT NULL - when the step was recorded
    -   `mousePosition`: TEXT - JSON object with x,y coordinates
    -   `windowTitle`: TEXT - title of the window
    -   `keyboardShortcut`: TEXT - key combination used

-   **Shapes:** Markup annotations for screenshots
    -   `id`: TEXT PRIMARY KEY - unique identifier
    -   `stepId`: TEXT NOT NULL - references steps.id
    -   `imagePath`: TEXT NOT NULL - path to the image being annotated
    -   `type`: TEXT NOT NULL - shape type ('ellipse', 'arrow', 'line', 'rectangle')
    -   `startX`: REAL NOT NULL - starting X coordinate
    -   `startY`: REAL NOT NULL - starting Y coordinate
    -   `endX`: REAL NOT NULL - ending X coordinate
    -   `endY`: REAL NOT NULL - ending Y coordinate
    -   `color`: TEXT NOT NULL - color of the shape

-   **Assets:** Additional files associated with a tutorial
    -   `id`: TEXT PRIMARY KEY - unique identifier
    -   `tutorialId`: TEXT NOT NULL - references tutorials.id
    -   `type`: TEXT NOT NULL - asset type (e.g., 'video', 'document')
    -   `path`: TEXT NOT NULL - path to the asset file

The database enforces referential integrity through foreign key constraints and uses indexes for performance optimization.

## Guidelines

-   Refer to this document when adding new files or modules.
-   Keep main, renderer, and shared code separated.
-   Place reusable logic in services (main) or hooks/utils (renderer/shared).
-   Update this document if significant structural changes are made.
-   Maintain UI component relationships to prevent missing UI elements:
    -   Record tab should always show the right sidebar with recording options
    -   State should flow properly from App to child components for settings
    -   UI updates should be tested across multiple tabs to ensure consistency 

## Component Architecture

- **App**: Main application container
  - **ProjectSidebar**: Sidebar for project navigation
  - **RecordingTab**: Screen recording interface
  - **StepsTab**: Tutorial step editing interface
    - **MarkupModal**: Image annotation tool with persistent shape data
  - **ExportTab**: Documentation export interface

## State Management

The application uses a combination of React component state and global stores (using Zustand) for state management:

- **App State**: Current project/tutorial selection, navigation state
- **Recording State**: Recording settings, active recording status
- **Steps State**: Tutorial steps, editing state, **shape data storage**
- **Export State**: Export options and format selection

## Data Flow

1. User creates a project and tutorial
2. Recording tab captures screenshots and step information
3. StepsTab allows editing steps, descriptions, and annotating images
   - Markup shapes are stored both in memory (for performance) and in the SQLite database (for persistence)
   - Shapes are loaded from the database when switching between tutorials or reopening the application
   - When markup is saved, the ShapeRepository ensures all shapes are properly stored with references to their step and image
   - Original images are preserved until export
4. ExportTab generates documentation with embedded markups using the stored shape data 