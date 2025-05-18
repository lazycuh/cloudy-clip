/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable jsdoc/require-param-description */
/* eslint-disable no-console */
/* eslint-disable max-len */
// @ts-check

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getAllFolderPathsUnderLocaleFolder } from './get-all-folder-paths-under-locale-folder.js';

const locale = process.argv[2];

for (const featureFolderPath of getAllFolderPathsUnderLocaleFolder(locale)) {
  const indexFilePath = resolve(featureFolderPath, 'index.html');

  if (existsSync(indexFilePath)) {
    void removeNonUiCssProperties(indexFilePath);
  }
}

/**
 * @param {import("fs").PathLike | import("fs/promises").FileHandle} indexFilePathForPage
 */
async function removeNonUiCssProperties(indexFilePathForPage) {
  try {
    const indexFileContentForPage = await readFile(indexFilePathForPage);

    const updatedIndexFileContentForPage = indexFileContentForPage
      .toString()
      // Remove non-UI CSS properties
      .replace(
        /(?:-[-\w]+?)?(?:transition|animation|pointer|z-index|transition-delay|animation-delay|animation-name):.+?([;}])/g,
        '$1'
      )
      // Remove all @keyframes
      .replace(/@keyframes.+?\}\}/g, '');

    await writeFile(indexFilePathForPage, updatedIndexFileContentForPage);

    console.log(`Removed non-UI CSS properties from "${indexFilePathForPage}"`);
  } catch (error) {
    console.error(`Failed to remove non-UI CSS properties from "${indexFilePathForPage}"`);

    throw error;
  }
}
