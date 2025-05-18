/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// @ts-check

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getDirName } from './get-dirname.js';

const dirname = getDirName();

const enFilePath = path.resolve(dirname, '..', 'src', 'locales', 'messages.json');
const enFileContent = JSON.parse(readFileSync(enFilePath).toString());

const localeIds = ['es', 'vi'];

for (const localeId of localeIds) {
  const localeFilePath = path.resolve(dirname, '..', 'src', 'locales', `messages.${localeId}.json`);
  const localeFileContent = JSON.parse(readFileSync(localeFilePath).toString());
  const currentLocaleTranslations = localeFileContent.translations;

  localeFileContent.translations = {};

  for (const [messageId, message] of Object.entries(enFileContent.translations)) {
    const trimmedEnglishMessage = message.trim();
    const existingTranslation = currentLocaleTranslations[messageId]?.trim();

    enFileContent.translations[messageId] = trimmedEnglishMessage;

    if (existingTranslation === undefined) {
      localeFileContent.translations[messageId] = trimmedEnglishMessage;
    } else {
      localeFileContent.translations[messageId] = existingTranslation;

      if (existingTranslation === trimmedEnglishMessage) {
        console.warn(`Message "${trimmedEnglishMessage}" has no translation for locale "${localeId}"`);
      }
    }
  }

  writeFileSync(localeFilePath, JSON.stringify(localeFileContent, null, 2));
}

writeFileSync(enFilePath, JSON.stringify(enFileContent, null, 2));
