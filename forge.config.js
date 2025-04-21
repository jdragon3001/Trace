module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    name: 'OpenScribe',
    executableName: 'openscribe',
    win32metadata: {
      CompanyName: 'OpenScribe',
      FileDescription: 'Create step-by-step guides with screenshots',
      OriginalFilename: 'openscribe.exe',
      ProductName: 'OpenScribe',
      InternalName: 'openscribe'
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'OpenScribe',
        authors: 'OpenScribe',
        description: 'Create step-by-step guides with screenshots',
        iconUrl: 'https://raw.githubusercontent.com/OpenScribe/openscribe-electron/main/assets/icon.ico',
        setupIcon: './assets/icon.ico'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ]
}; 