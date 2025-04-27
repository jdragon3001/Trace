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
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        port: 3001,
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/index.html',
              js: './src/renderer/index.tsx',
              name: 'main_window',
              preload: {
                js: './src/preload/index.ts'
              }
            }
          ]
        },
        devServer: {
          hot: true,
          liveReload: true,
          port: 3001,
          host: 'localhost',
          static: {
            directory: './src/renderer',
            publicPath: '/'
          }
        }
      }
    }
  ]
}; 