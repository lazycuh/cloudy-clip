/* eslint-disable jsdoc/require-param-description */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// @ts-check

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { minify } from 'terser';

import { getDirName } from './get-dirname.js';
import { getLocaleFolderPath } from './get-locale-folder-path.js';

const dirname = getDirName();
const manglerCacheFile = resolve(dirname, '.terser-cache.json');
const options = {
  compress: false,
  mangle: {
    properties: {
      regex: /^(?:_[a-z])/
    }
  },
  nameCache: JSON.parse(readFileSync(manglerCacheFile, 'utf8'))
};
const locale = /** @type {'en' | 'es' | 'vi'}*/ (process.argv[2]);
const symbolCache = options.nameCache.props.props;

void manglePrivateSymbols(getLocaleFolderPath(locale));

/**
 * @param {import("node:fs").PathLike} folderPath
 */
async function manglePrivateSymbols(folderPath) {
  for (const entry of readdirSync(folderPath)) {
    try {
      if (!entry.endsWith('.js')) {
        continue;
      }

      const fileToMangle = resolve(String(folderPath), entry);
      const fileContentBuffer = await readFile(fileToMangle);
      const minifiedFileContentResult = await minify(fileContentBuffer.toString(), options);
      const propAccessAsString = /"(_[a-zA-Z0-9]+)"/gm;
      const minifiedFileContent = minifiedFileContentResult.code?.replace(propAccessAsString, (match, capture) => {
        const minifiedSymbol = symbolCache[`$${capture}`];

        return minifiedSymbol ? `"${minifiedSymbol}"` : match;
      });

      await writeFile(fileToMangle, minifiedFileContent ?? '');
      console.log(`Mangled "${entry}" in "${folderPath}"`);

      writeFileSync(manglerCacheFile, JSON.stringify(options.nameCache), 'utf8');
    } catch (error) {
      console.error(`Error mangling file "${entry}" in locale folder "${folderPath}"`);

      throw error;
    }
  }
}
