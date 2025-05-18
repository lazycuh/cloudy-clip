// @ts-check
import { getLocaleFeatureFolderPaths } from './get-locale-feature-folder-paths.js';
import { getLocaleFolderPath } from './get-locale-folder-path.js';

/**
 * Returns all folder paths under the folder for the provided locale, the returned list
 * also contains the folder path for the locale itself.
 *
 * @param {string} locale Current locale
 *
 * @returns {string[]} List of all folder paths under the locale folder
 * including the locale folder itself.
 */
export function getAllFolderPathsUnderLocaleFolder(locale) {
  return [getLocaleFolderPath(locale), ...getLocaleFeatureFolderPaths(locale)];
}
