/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable jsdoc/require-param-description */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// @ts-check
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getAllFolderPathsUnderLocaleFolder } from './get-all-folder-paths-under-locale-folder.js';
import { getDirName } from './get-dirname.js';
import { getLocaleFolderPath } from './get-locale-folder-path.js';

const dirname = getDirName();
const selectorCountCacheFilePath = resolve(dirname, '.mangled-selectors.js.json');
const mangledSelectorTable = existsSync(selectorCountCacheFilePath)
  ? JSON.parse(readFileSync(selectorCountCacheFilePath).toString())
  : { selectorCount: 0 };

const locale = /** @type {'en' | 'es' | 'vi'} */ (process.argv[2]);
const builtinTags = [
  'a',
  'abbr',
  'acronym',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'big',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fencedframe',
  'fieldset',
  'figcaption',
  'figure',
  'font',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'marquee',
  'menu',
  'meta',
  'meter',
  'nav',
  'nobr',
  'noembed',
  'noframes',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'param',
  'picture',
  'plaintext',
  'portal',
  'pre',
  'progress',
  'q',
  'rb',
  'rp',
  'rt',
  'rtc',
  'ruby',
  's',
  'samp',
  'script',
  'search',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strike',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'tt',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
  'xmp'
];

if (locale === 'en') {
  buildMangledSelectorTable(getLocaleFolderPath(locale));

  Object.keys(mangledSelectorTable)
    .filter(selector => selector.startsWith('mat-elevation-z'))
    .forEach((matElevationSelector, i) => {
      if (matElevationSelector !== 'mat-elevation-z') {
        mangledSelectorTable[matElevationSelector] = `${mangledSelectorTable['mat-elevation-z']}${i}`;
      }
    });

  writeFileSync(selectorCountCacheFilePath, JSON.stringify(mangledSelectorTable));
  console.log(mangledSelectorTable);

  const uniqueSelectors = new Set(Object.values(mangledSelectorTable));

  if (
    uniqueSelectors.size - 1 !== mangledSelectorTable.selectorCount &&
    Object.keys(mangledSelectorTable).length - 1 !== mangledSelectorTable.selectorCount
  ) {
    console.error(`Duplicate selectors detected when building for locale "${locale}"`);

    throw new Error(
      `Expected unique selector count is ${mangledSelectorTable.selectorCount}, actual selector count is ${uniqueSelectors.size}`
    );
  }
}

for (const featureFolderPath of getAllFolderPathsUnderLocaleFolder(locale)) {
  mangleSelectors(featureFolderPath);
}

/**
 * @param {string} featureFolderPath
 */
function buildMangledSelectorTable(featureFolderPath) {
  for (const fileName of getAllAcceptableFileNamesInFolder(featureFolderPath)) {
    try {
      const fileContent = readFileSync(resolve(featureFolderPath, fileName)).toString();

      buildMangledCssSelectors(fileName, fileContent);
      buildMangledAngularSelectors(fileName, fileContent);
    } catch (error) {
      console.error(
        `Failed to create mangled CSS selectors in file "${fileName}" in locale folder "${featureFolderPath}"`
      );

      throw error;
    }
  }
}

/**
 * @param {import("fs").PathLike} featureFolderPath
 */
function getAllAcceptableFileNamesInFolder(featureFolderPath) {
  return readdirSync(featureFolderPath)
    .filter(fileName => fileName.endsWith('.js') || fileName.endsWith('.html') || fileName.endsWith('.css'))
    .sort((a, b) => {
      if (a.endsWith('.js')) {
        return -1;
      }

      return b.endsWith('.js') ? 1 : 0;
    });
}

/**
 * @param {string} fileName
 * @param {string} fileContent
 */
function buildMangledCssSelectors(fileName, fileContent) {
  const stylesArrayMatches = [];

  if (fileName.endsWith('.js')) {
    const stylesArrayPattern = /styles:\[(['"`])([\s\S]+?)\1\]/gm;

    for (
      let stylesArrayMatchResult = stylesArrayPattern.exec(fileContent);
      stylesArrayMatchResult !== null;
      stylesArrayMatchResult = stylesArrayPattern.exec(fileContent)
    ) {
      stylesArrayMatches.push(stylesArrayMatchResult[2]);
    }
  } else if (fileName.endsWith('.css')) {
    stylesArrayMatches.push(fileContent);
  }

  buildMangledCssClassNames(stylesArrayMatches);
  buildMangledCssVariables(stylesArrayMatches);
}

/**
 * @param {any[]} sources
 */
function buildMangledCssClassNames(sources) {
  const classNameIgnorePatterns = [
    // These tokens could be just subtractions, hard to tell them apart, so we just ignored them
    '^width-',
    '^height-',
    '^left-',
    '^top-',
    '^right-',
    '^bottom-',
    '^x-',
    '^y-',
    '^[a-z]+--',
    '^mat-accent$',
    '^mat-warn$',
    '^mat-primary$',
    '^mat-column-.+',
    '^color-mix$'
  ];
  const classNameIgnoreRegex = new RegExp(`(?:${classNameIgnorePatterns.join('|')})`);

  for (const source of sources) {
    const classSelectorPattern = /(?:\.([a-z]+(?:-|__)[a-z_0-9-]+[a-z0-9]))/gm;

    for (
      let classSelectorMatchResult = classSelectorPattern.exec(source);
      classSelectorMatchResult !== null;
      classSelectorMatchResult = classSelectorPattern.exec(source)
    ) {
      const classNameMatch = classSelectorMatchResult[1];

      if (classNameMatch in mangledSelectorTable || classNameMatch.match(classNameIgnoreRegex)) {
        continue;
      }

      mangledSelectorTable[classNameMatch] = generateMinifiedSelector();
    }
  }
}

function generateMinifiedSelector() {
  const alphabetSize = 26;
  const alphabetSizeSquared = alphabetSize ** 2;
  const alphabetSizeCubed = alphabetSize ** 3;
  const lowercaseACharCode = 97;
  const charCodes = [];
  const selectorCount = mangledSelectorTable.selectorCount;
  const overflowingCharCodeOffsetFromLowercaseA = selectorCount % alphabetSize;

  if (selectorCount < alphabetSize) {
    // Append the number '1' to single letter minified selectors to avoid conflicting
    // with HTML tags if used as such
    charCodes.push(lowercaseACharCode + overflowingCharCodeOffsetFromLowercaseA);
  } else if (selectorCount < alphabetSizeSquared) {
    charCodes.push(
      lowercaseACharCode + Math.trunc(selectorCount / alphabetSize) - 1,
      lowercaseACharCode + overflowingCharCodeOffsetFromLowercaseA
    );
  } else if (selectorCount < alphabetSizeCubed) {
    charCodes.push(
      lowercaseACharCode + ((Math.ceil(selectorCount / alphabetSizeSquared) - 1) % alphabetSize),
      lowercaseACharCode + ((Math.ceil(selectorCount / alphabetSize) - 1) % alphabetSize),
      lowercaseACharCode + overflowingCharCodeOffsetFromLowercaseA
    );
  }

  mangledSelectorTable.selectorCount++;

  const minifiedSelector = charCodes.map(charCode => String.fromCharCode(charCode)).join('');

  return !builtinTags.includes(minifiedSelector) ? minifiedSelector : minifiedSelector + Math.trunc(Math.random() * 10);
}

/**
 * @param {any[]} sources
 */
function buildMangledCssVariables(sources) {
  const cssVariableRegex = /--([a-z]+-[a-z0-9-]+[a-z0-9]):/gm;

  for (const source of sources) {
    for (
      let cssVariableMatchResult = cssVariableRegex.exec(source);
      cssVariableMatchResult !== null;
      cssVariableMatchResult = cssVariableRegex.exec(source)
    ) {
      const cssVariableMatch = cssVariableMatchResult[1];

      if (cssVariableMatch in mangledSelectorTable) {
        continue;
      }

      mangledSelectorTable[cssVariableMatch] = generateMinifiedSelector();
    }
  }
}

/**
 * @param {string} fileName
 * @param {string} fileContent
 */
function buildMangledAngularSelectors(fileName, fileContent) {
  if (!fileName.endsWith('.js')) {
    return;
  }

  const angularSelectorIgnorePatterns = [
    '^lc-app$',
    '^mat-accent$',
    '^mat-warn$',
    '^mat-primary$',
    '^mat-column-.+',
    '^color-mix$'
  ];
  const angularSelectorIgnoreRegex = new RegExp(`(?:${angularSelectorIgnorePatterns.join('|')})`);

  const angularSelectorPatterns = ['lc', 'mat', 'mdc', 'color'].map(e => `${e}-[a-z_-]+[a-z]`);
  const angularSelectorRegex = new RegExp(`(${angularSelectorPatterns.join('|')})`, 'gm');

  for (
    let angularSelectorMatchResult = angularSelectorRegex.exec(fileContent);
    angularSelectorMatchResult !== null;
    angularSelectorMatchResult = angularSelectorRegex.exec(fileContent)
  ) {
    const angularSelectorMatch = angularSelectorMatchResult[1];

    if (angularSelectorMatch in mangledSelectorTable || angularSelectorMatch.match(angularSelectorIgnoreRegex)) {
      continue;
    }

    mangledSelectorTable[angularSelectorMatch] = generateMinifiedSelector();
  }
}

/**
 * @param {string} featureFolderPath
 */
function mangleSelectors(featureFolderPath) {
  const originalSelectors = Object.keys(mangledSelectorTable).sort((a, b) => b.length - a.length);

  for (const fileName of getAllAcceptableFileNamesInFolder(featureFolderPath)) {
    try {
      const fileToUpdate = resolve(featureFolderPath, fileName);
      const updatedFileContent = readFileSync(fileToUpdate)
        .toString()
        .replace(
          new RegExp(
            /**
             * If a selector is preceded by `'`, `:`, `.`, backtick, a space, `<`, `</` or `--` or `"`(If not preceded with `path:`)
             */
            `(?<=(?:[':\\.\`\\s<]|(?:</)|--|(?<!path:)"))(?:${originalSelectors.map(e => `\\b${e}\\b`).join('|')})`,
            'gm'
          ),
          match => {
            const foundMangledSelector = mangledSelectorTable[match];

            if (foundMangledSelector) {
              return foundMangledSelector;
            }

            console.error(`Selector "${match}" not found in mangled selector table`);

            return match;
          }
        );

      writeFileSync(fileToUpdate, updatedFileContent);

      console.log(`Mangled selectors in file "${fileName}" in "${featureFolderPath}"`);
    } catch (error) {
      console.error(`Failed to mangle selectors in file "${fileName}" in "${featureFolderPath}"`);

      throw error;
    }
  }
}
