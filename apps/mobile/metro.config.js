const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the root and all packages
config.watchFolders = [workspaceRoot];

// 2. Help Metro find the node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Map the new Pallinky names to the correct folders
config.resolver.extraNodeModules = {
  "@pallinky/core": path.resolve(workspaceRoot, "packages/core"),
  "@pallinky/ui": path.resolve(workspaceRoot, "packages/ui"),
};

module.exports = config;