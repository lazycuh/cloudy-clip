/* eslint-disable jsdoc/require-param-description */
/* eslint-disable no-console */
// @ts-check

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getAllFolderPathsUnderLocaleFolder } from './get-all-folder-paths-under-locale-folder.js';

main();

function main() {
  const locale = process.argv[2];

  for (const featureFolderPath of getAllFolderPathsUnderLocaleFolder(locale)) {
    const indexHtmlFilePath = resolve(featureFolderPath, 'index.html');

    if (!existsSync(indexHtmlFilePath)) {
      continue;
    }

    let indexHtmlFileContent = readFileSync(indexHtmlFilePath).toString();

    indexHtmlFileContent = minifyIndexHtmlFile(indexHtmlFileContent);
    console.log(`Minified index.html file "${indexHtmlFilePath}"`);

    indexHtmlFileContent = removeEmails(indexHtmlFileContent);
    console.log(`Removed emails in index.html file "${indexHtmlFilePath}"`);

    writeFileSync(indexHtmlFilePath, indexHtmlFileContent);
  }
}

/**
 * @param {string} indexFileContent
 */
function minifyIndexHtmlFile(indexFileContent) {
  try {
    return indexFileContent
      .split(/\n/gm)
      .map(line => line.trim())
      .join('');
  } catch (error) {
    console.error(`Failed to minify index.html file "${indexFileContent}"`);

    throw error;
  }
}

/**
 * @param {string} indexFileContent
 */
function removeEmails(indexFileContent) {
  try {
    return indexFileContent.replace(/\w+@cloudyclip\.com/gm, '');
  } catch (error) {
    console.error(`Failed to remove emails in index.html file "${indexFileContent}"`);

    throw error;
  }
}
