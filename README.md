# OpenScribe

OpenScribe is an Electron-based application for creating step-by-step guides with screenshots and annotations.

## Features

- Create projects and tutorials to organize your guides
- Record step-by-step workflows with automatic screenshots
- Add text descriptions, keyboard shortcuts, and annotations
- Export guides as PDF or DOCX documentation with customizable options
- Screen recording with automatic or manual capture
- Annotation tools for highlighting important UI elements
- Step-by-step tutorial creation
- Export to various documentation formats
- Project management for organizing related tutorials
- Screen buffering to ensure UI changes don't appear in screenshots prematurely

### Screen Capture
- Full screen captures
- Auto-capture on click or Enter key
- Organized in steps for easy tutorial creation

### Markup and Annotation
- Add markup shapes (circles, rectangles, arrows, lines) to screenshots
- Color selection for different markup elements
- Shape manipulation (move, resize, delete)
- Markup shapes appear in previews and exports
- Changes are saved automatically with the tutorial

### Exports
- Export to PDF or DOCX formats
- Customizable export options
- Include/exclude screenshots
- Include/exclude step numbers
- Export with annotations visible on images

### Project Management
- Create and organize multiple projects
- Create multiple tutorials within each project
- Rename, edit, and delete projects and tutorials

## Development

### Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher

### Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the application:
   ```
   npm start
   ```

### Database

OpenScribe uses SQLite for data storage, with the following structure:

- **Projects**: Main organizational unit for related tutorials
- **Tutorials**: Collection of steps for a specific guide
- **Steps**: Individual actions with screenshots and descriptions
- **Assets**: Images and other files used in tutorials

The database file is stored in the user's application data directory:
- Windows: `%APPDATA%\openscribe\openscribe\openscribe.db`
- macOS: `~/Library/Application Support/openscribe/openscribe.db`
- Linux: `~/.config/openscribe/openscribe.db`

#### SQLite Considerations

When working with the database code, keep these best practices in mind:

1. Always quote reserved keywords like "order" in SQL statements
2. Use async/await when interacting with database methods
3. Implement proper error handling for database operations
4. Check for existing records before insertion to prevent constraint violations

### Exporting Tutorials

OpenScribe supports exporting tutorials as PDF or DOCX documents:

#### PDF Export
- Fixed layout that looks the same on all devices
- Screenshots embedded directly in the document
- Option to include step numbers
- Clean formatting for easy reading and printing

#### DOCX Export
- Editable format compatible with Microsoft Word and other office applications
- Screenshots can be edited or modified after export
- Structured document with headings and consistent formatting
- Perfect for further customization after export

To export a tutorial:
1. Select a tutorial from your project list
2. Click the Export tab
3. Configure export options (format, title, include screenshots, include step numbers)
4. Click "Export Documentation" and choose where to save the file

### Building for Production

To create a production build:

```
npm run package
```

This will generate platform-specific packages in the `out` directory.

## Recent Updates

### Shape Markup Persistence Fix (2024-08-14)
- Fixed issue with shape markup not persisting when closing/reopening the app
- Enhanced shape data storage to properly save to the SQLite database
- Improved shape loading when switching between tutorials
- Added verification to ensure shapes are correctly saved and retrieved
- Implemented detailed logging for shape operations to assist with future debugging

### Markup Enhancements (2024-07-10)
- Improved markup handling to allow editing shapes until export
- Shapes are now stored in memory and can be edited multiple times
- No more embedded markups in images until export occurs
- Better user experience when annotating screenshots

### Export Functionality (2024-07-05)
- Added PDF and DOCX export options
- Implemented custom document formatting with professional layout
- Added option to include/exclude screenshots and step numbers
- Real-time preview of export document with settings changes
- Export progress and success/error feedback

### Database Architecture Redesign (2024-06-26)
- Complete redesign of the database system to fix data consistency issues
- Implemented repository pattern for better separation of concerns
- Added proper transaction management with rollback on errors
- Enhanced error handling and data validation
- Implemented client-side repositories with caching for improved performance
- Created data migration service to handle database upgrades

### Error Handling Improvements (2024-07-01)
- Enhanced step saving and loading process to ensure data persists when switching between pages
- Improved error handling throughout the tutorial step management flow
- Added visibility detection to reload steps when returning to the application
- Implemented verification checks to confirm database operations complete successfully
- Better error feedback to users when operations fail

### Visual Improvements to Step Separator (2024-08-15)
- The separator line under each step in the preview, PDF, and DOCX exports is now darker, thicker, and extends closer to the edges for improved visual clarity and separation between steps. 