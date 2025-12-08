// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // Override testMatch to include tests directory
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test,jest}.{js,jsx,ts,tsx}',
    '<rootDir>/tests/**/*.{spec,test,jest}.{js,jsx,ts,tsx}',
  ],
  // Add marked to the list of modules to transform
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, 'marked'])],
};
