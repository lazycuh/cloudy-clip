/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// @ts-check
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getAllFolderPathsUnderLocaleFolder } from './get-all-folder-paths-under-locale-folder.js';
import { getDirName } from './get-dirname.js';

const dirname = getDirName();
const sitemapEntriesFilePath = resolve(dirname, '.sitemap-entries.json');
const sitemapEntries = existsSync(sitemapEntriesFilePath)
  ? JSON.parse(readFileSync(sitemapEntriesFilePath).toString())
  : [];

const locale = process.argv[2];

for (const featureFolderPath of getAllFolderPathsUnderLocaleFolder(locale)) {
  if (!existsSync(resolve(featureFolderPath, 'index.html'))) {
    continue;
  }

  let pagePath = featureFolderPath.split(`/${locale}/`)[1]?.trim() ?? '';

  if (pagePath) {
    pagePath = `/${pagePath}`;
  }

  const lastModified = new Date().toISOString();

  sitemapEntries.push({
    changeFrequency: 'weekly',
    lastModified,
    location: `https://cloudyclip.com${pagePath}`
  });
}

writeFileSync(sitemapEntriesFilePath, JSON.stringify(sitemapEntries, null, 2));
