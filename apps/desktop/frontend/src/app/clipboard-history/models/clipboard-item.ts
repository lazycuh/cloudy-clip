import { signal } from '@angular/core';
import { generateRandomString } from '@lazycuh/web-ui-common/utils/generate-random-string';

export class ClipboardItem {
  readonly id = generateRandomString();
  readonly timestamp = Date.now();
  readonly isPinned = signal(false);

  constructor(
    public readonly content: string,
    public readonly type: 'text' | 'image' | 'url'
  ) {}
}
