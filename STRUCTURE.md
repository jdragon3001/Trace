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