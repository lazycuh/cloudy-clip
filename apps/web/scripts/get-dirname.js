import { fileURLToPath } from 'node:url';

export function getDirName() {
  return fileURLToPath(new URL('.', import.meta.url));
}
