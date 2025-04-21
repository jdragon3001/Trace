# OpenScribe

A Windows desktop application for creating step-by-step guides with automatic screenshots and annotations.

## Features

- Record mouse clicks and keyboard shortcuts
- Automatically capture screenshots
- Add numbered circles to click locations
- Edit and reorder steps
- Export to DOCX or PDF
- Dark mode support

## Development Setup

### Prerequisites

- Node.js 18+
- Windows 10 or later
- Visual Studio Build Tools (for native modules)

### Installation

1. Clone the repository:
```powershell
git clone https://github.com/OpenScribe/openscribe-electron.git
cd openscribe-electron
```

2. Install dependencies:
```powershell
npm install
```

3. Start the development server:
```powershell
npm start
```

### Building

To create a production build:

```powershell
npm run make
```

This will create installers in the `out` directory.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 