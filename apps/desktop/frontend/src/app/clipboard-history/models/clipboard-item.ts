import { signal } from '@angular/core';
import { generateRandomString } from '@lazycuh/web-ui-common/utils/generate-random-string';

export class ClipboardItem {
  readonly id = generateRandomString();
  readonly isPinned = signal(false);
  readonly createdAt = Date.now();

  pinnedAt = Date.now();

  constructor(
    readonly content: string,
    readonly type: 'text' | 'image' | 'url'
  ) {}

  togglePin() {
    this.isPinned.set(!this.isPinned());

    this.pinnedAt = Date.now();
  }
}
