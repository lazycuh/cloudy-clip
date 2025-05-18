/* eslint-disable @stylistic/quotes */
/* eslint-disable jsdoc/require-param-description */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */


/* eslint-disable no-console */
// @ts-check

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { pages } from './assets/pages.js';
import { getAllFolderPathsUnderLocaleFolder } from './get-all-folder-paths-under-locale-folder.js';
import { getDirName } from './get-dirname.js';

const locale = process.argv[2];
const allFolderPaths = getAllFolderPathsUnderLocaleFolder(locale);
allFolderPaths.sort((a, b) => a.length - b.length);

const defaultTitleLines = ['Cloudy Clip: Track & Improve Your Trades'];
const defaultDescriptionLines = [
  'Cloudy Clip is journaling software designed to help traders analyze their past performance,',
  'document their trades to gain valuable insights, and prevent repeating mistakes.',
  'It enables traders to easily record their trading experiences by uploading images, adding notes,',
  'and monitoring their progress, all in one place.',
  `It's designed to help traders concentrate on learning, developing, and reaching their trading objectives.`
];

const defaultKeywords = [
  'analyze trading performance with journal',
  'avoid trading mistakes',
  'crypto trading journal',
  'forex trading journal',
  'improve trading results',
  'increase trading profitability',
  'online trade journal',
  'online trading journal',
  'performance analysis',
  'performance tracking',
  'performance tracking software',
  'performance tracking tools',
  'stock trading journal',
  'trade journal',
  'trade logging',
  'trade tracking',
  'trading analysis',
  'trading journal',
  'trading performance',
  'trading software',
  'trading tools'
].map(e => `${e.trim()},`);

for (const folderPath of allFolderPaths) {
  const indexFilePathForPage = resolve(folderPath, 'index.html');

  if (!existsSync(indexFilePathForPage)) {
    continue;
  }

  if (pages[locale] === undefined) {
    pages[locale] = {};
  }

  let pagePath = folderPath.split(`/${locale}/`)[1]?.trim() ?? '';

  if (pagePath) {
    pagePath = `/${pagePath}`;
  }

  if (pages[locale][pagePath] === undefined) {
    console.warn(`Page path "${pagePath}" is missing for locale "${locale}"`);

    pages[locale][pagePath] = {
      descriptionLines: [],
      keywords: [],
      titleLines: []
    };
  }

  const pageMetadata = pages[locale][pagePath];

  if (pageMetadata.descriptionLines.length === 0) {
    pageMetadata.descriptionLines = defaultDescriptionLines;
  }

  if (pageMetadata.keywords.length === 0) {
    pageMetadata.keywords = defaultKeywords;
  }

  if (pageMetadata.titleLines.length === 0) {
    pageMetadata.titleLines = defaultTitleLines;
  }

  try {
    let indexFileContentForPage = readFileSync(indexFilePathForPage).toString();

    indexFileContentForPage = updateTitle(indexFileContentForPage, pageMetadata.titleLines);
    console.log(`Updated "title" in "${indexFilePathForPage}"`);

    indexFileContentForPage = addMetaTag(indexFileContentForPage, 'description', pageMetadata.descriptionLines);
    console.log(`Updated "description" in "${indexFilePathForPage}"`);

    indexFileContentForPage = addMetaTag(indexFileContentForPage, 'keywords', pageMetadata.keywords);
    console.log(`Updated "keywords" in "${indexFilePathForPage}"`);

    indexFileContentForPage = addMetaTag(indexFileContentForPage, 'content-language', [locale], 'http-equiv');
    console.log(`Updated "content-language" in "${indexFilePathForPage}"`);

    writeFileSync(indexFilePathForPage, indexFileContentForPage);
  } catch (error) {
    console.error(`Failed to update <head> tag in "${indexFilePathForPage}"`);

    throw error;
  }
}

writeFileSync(
  resolve(getDirName(), 'assets', 'pages.js'),
  `export const pages = ${JSON.stringify(pages, null, 2)};`
);

/**
 * @param {string} fileContent
 * @param {any[]} titleLines
 */
function updateTitle(fileContent, titleLines) {
  return fileContent.replace('<head>', `<head><title>${titleLines.join(' ')}</title>`);
}

/**
 * @param {string} fileContent
 * @param {string} nameValue
 * @param {any[]} contentLines
 */
function addMetaTag(fileContent, nameValue, contentLines, name = 'name') {
  return fileContent.replace('</title>', `</title><meta ${name}="${nameValue}" content="${contentLines.join(' ')}">`);
}
