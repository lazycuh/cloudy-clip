/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// @ts-check
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getDirName } from './get-dirname.js';

const dirname = getDirName();
const sitemapEntriesFilePath = resolve(dirname, '.sitemap-entries.json');
const sitemapEntries = JSON.parse(readFileSync(sitemapEntriesFilePath).toString());

const siteMapFileContent = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemapEntries
    .map(entry => {
      return `
      <url>
        <loc>${entry.location}</loc>
        <lastmod>${entry.lastModified}</lastmod>
        <changefreq>${entry.changeFrequency}</changefreq>
      </url>
    `;
    })
    .join('\n')}
</urlset>
`
  .trim()
  .replace(/(?:\n|\t|\r|\s{2,})/gm, '');

writeFileSync(resolve(dirname, '..', 'dist', 'sitemap.xml'), siteMapFileContent);
