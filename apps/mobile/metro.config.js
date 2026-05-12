const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Monorepo: hoisted packages (e.g. expo-router) live under workspace root. Without this, Metro can
// resolve `expo` from ../../node_modules (e.g. expo@55) while react-native stays on 0.74, which
// breaks on imports like react-native/Libraries/Utilities/DevLoadingView (SDK mismatch).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
