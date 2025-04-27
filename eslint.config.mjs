import globals from "globals";
import pluginJs from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
// import pluginReactConfig from "eslint-plugin-react/configs/recommended.js"; // Don't import recommended directly
// import { fixupConfigRules } from "@eslint/compat"; // Not needed if building manually

// Base configuration ignores build outputs, node_modules, and config files
const ignores = {
  ignores: [
    "node_modules/",
    "dist/",
    ".webpack/",
    "build/",
    "*.config.js",
    "*.config.mjs", // Ignore self
  ],
};

// Configuration for JavaScript files (e.g., config files if we weren't ignoring them)
const jsConfig = {
  files: ["**/*.{js,mjs,cjs}"],
  languageOptions: {
    globals: {
      ...globals.node, // Use Node.js globals
    },
  },
  ...pluginJs.configs.recommended, // Apply JS recommended rules
};

// Manual TypeScript configuration
const tsConfig = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: {
    "@typescript-eslint": tsPlugin,
  },
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      project: "tsconfig.json",
      tsconfigRootDir: import.meta.dirname,
      sourceType: "module",
      ecmaVersion: "latest",
    },
  },
  rules: {
    // Start with a base set of TS rules (can add more from recommended later if needed)
    ...tsPlugin.configs["eslint-recommended"].overrides[0].rules, // Base rules adapted for TS
    ...tsPlugin.configs.recommended.rules, // Add recommended TS rules manually
    // Add specific overrides
    // '@typescript-eslint/no-unused-vars': 'warn',
  },
};

// Manual React configuration
const reactConfig = {
  files: ["src/renderer/**/*.{ts,tsx}"],
  plugins: {
    react: reactPlugin,
  },
  languageOptions: {
    globals: { ...globals.browser },
    parserOptions: {
      ecmaFeatures: { jsx: true }, // Enable JSX parsing
    },
  },
  settings: {
    react: { version: "detect" },
  },
  rules: {
    // Manually add essential React rules (can add more from recommended later)
    ...reactPlugin.configs.recommended.rules,
    // ...reactPlugin.configs['jsx-runtime'].rules, // If using new JSX transform

    // Add specific overrides
    'react/react-in-jsx-scope': 'off', // Not needed with modern React JSX transform
    'react/prop-types': 'off', // Usually handled by TypeScript
  },
};

// Export the final configuration array
export default [
  ignores, // Apply ignore patterns first
  jsConfig, // Apply base JS rules
  tsConfig, // Apply our combined TS object
  reactConfig, // Apply our combined React object
];