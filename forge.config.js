module.exports = {
  packagerConfig: {
    //asar打包，可以提升读取性能
    asar: true,
    // 设置应用程序本身 (YourApp.exe) 的图标
    icon: './assets/icon.ico' 
  },
  rebuildConfig: {},
  makers: [
    {
      // 使用 Squirrel.Windows 为您创建一个 Setup.exe 安装程序
      name: '@electron-forge/maker-squirrel',
      config: {
        // 设置安装程序 (Setup.exe) 的图标
        setupIcon: './assets/icon.ico'
      },
    },
    {
      // 为其他平台创建zip包（可选）
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
};