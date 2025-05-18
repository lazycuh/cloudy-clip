/* eslint-disable jsdoc/require-param-description */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
// @ts-check

import { readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getAllFolderPathsUnderLocaleFolder } from './get-all-folder-paths-under-locale-folder.js';

const locale = process.argv[2];

for (const featureFolderPath of getAllFolderPathsUnderLocaleFolder(locale)) {
  void removeMatAnimationNoOpClass(featureFolderPath);
}

/**
 * @param {import("fs").PathLike} featureFolderPath
 */
async function removeMatAnimationNoOpClass(featureFolderPath) {
  for (const entry of readdirSync(featureFolderPath)) {
    try {
      if (!entry.endsWith('.js') && !entry.endsWith('.html') && !entry.endsWith('.css')) {
        continue;
      }

      const fileToUpdate = resolve(String(featureFolderPath), entry);
      const fileContentBuffer = await readFile(fileToUpdate);
      const updatedFileContent = fileContentBuffer.toString().replace(/\._mat-animation-noopable/gm, '._fu_');

      await writeFile(fileToUpdate, updatedFileContent);

      console.log(`Removed "_mat-animation-noopable" from "${entry}" in "${featureFolderPath}"`);
    } catch (error) {
      console.error(
        `Failed to remove "_mat-animation-noopable" in file "${entry}" in locale folder "${featureFolderPath}"`
      );

      throw error;
    }
  }
}
