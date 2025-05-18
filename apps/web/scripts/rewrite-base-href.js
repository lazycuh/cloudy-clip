/* eslint-disable jsdoc/require-param-description */
// @ts-check

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getAllFolderPathsUnderLocaleFolder } from './get-all-folder-paths-under-locale-folder.js';

for (const featureFolderPath of getAllFolderPathsUnderLocaleFolder('en')) {
  const indexPagePath = resolve(featureFolderPath, 'index.html');

  if (!existsSync(indexPagePath)) {
    continue;
  }

  rewriteBaseHref(indexPagePath);
}

/**
 * @param {import("fs").PathOrFileDescriptor} indexFilePathForPage
 */
function rewriteBaseHref(indexFilePathForPage) {
  const indexFileContentForPage = readFileSync(indexFilePathForPage).toString();

  writeFileSync(indexFilePathForPage, indexFileContentForPage.replace('<base href="/en/">', '<base href="/">'));
}
