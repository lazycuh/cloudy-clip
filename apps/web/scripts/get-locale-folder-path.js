// @ts-check
import { resolve } from 'node:path';

import { getDirName } from './get-dirname.js';

const dirname = getDirName();

/**
 *
 * @param {string} locale Current locale
 *
 * @returns {string} Path to the locale folder
 */
export function getLocaleFolderPath(locale) {
  return resolve(dirname, '..', 'dist', locale);
}
