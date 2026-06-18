const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const fs = require('fs');

const real__dirname = fs.realpathSync(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  projectRoot: real__dirname,
  watchFolders: [real__dirname],
};

module.exports = mergeConfig(getDefaultConfig(real__dirname), config);
