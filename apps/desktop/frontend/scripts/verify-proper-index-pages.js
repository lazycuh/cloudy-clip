/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable jsdoc/require-param-description */
// @ts-check

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getLocaleFeatureFolderPaths } from './get-locale-feature-folder-paths.js';

const locale = process.argv[2];

for (const featureFolderPath of getLocaleFeatureFolderPaths(locale)) {
  const indexPagePath = resolve(featureFolderPath, 'index.html');

  if (!existsSync(indexPagePath)) {
    continue;
  }

  verifyProperIndexPage(indexPagePath);
}

/**
 * @param {import("fs").PathOrFileDescriptor} indexFilePathForPage
 */
function verifyProperIndexPage(indexFilePathForPage) {
  const indexFileContentForPage = readFileSync(indexFilePathForPage).toString();

  const firstIndexOfClosingBodyTag = indexFileContentForPage.indexOf('</body>');
  const lastIndexOfClosingBodyTag = indexFileContentForPage.lastIndexOf('</body>');

  if (firstIndexOfClosingBodyTag !== lastIndexOfClosingBodyTag) {
    throw new Error(`Index page at "${indexFilePathForPage}" is malformed`);
  }
}
