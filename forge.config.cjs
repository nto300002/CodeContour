module.exports = {
  packagerConfig: {
    asar: true,
  },
  plugins: [{
    name: "@electron-forge/plugin-auto-unpack-natives",
    config: {},
  }],
  makers: [{
    name: "@electron-forge/maker-zip",
    platforms: ["darwin"],
  }],
};
