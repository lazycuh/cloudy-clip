// @ts-check
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { getLocaleFolderPath } from './get-locale-folder-path.js';

/**
 * Returns all folder paths under the folder for the provided locale, the returned list
 * does NOT contains the folder path for the locale itself.
 *
 * @param {string} locale Current locale
 *
 * @returns {string[]} List of all folder paths under the locale folder
 */
export function getLocaleFeatureFolderPaths(locale) {
  return getAllFoldersUnderPath(getLocaleFolderPath(locale));
}

/**
 *
 * @param {string} path The path to the folder
 *
 * @returns {string[]} List of all folder paths under the provided path.
 */
function getAllFoldersUnderPath(path) {
  const paths = [];

  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isFile() || (entry.isDirectory() && (entry.name === 'assets' || entry.name === 'media'))) {
      continue;
    }

    const childPath = resolve(path, entry.name);

    paths.push(childPath);
    paths.push(...getAllFoldersUnderPath(childPath));
  }

  return paths;
}
