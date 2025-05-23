import { signal } from '@angular/core';
import { dto } from '@wails/models';

export type ClipboardItemType = 'TEXT' | 'IMAGE' | 'URL';

export class ClipboardItem {
  readonly id: string;
  readonly type: ClipboardItemType;
  readonly content: string;
  readonly isPinned = signal(false);
  readonly createdAt: number;

  pinnedAt = 0;

  constructor(source: dto.ClipboardItem) {
    this.id = source.id;
    this.type = source.type as unknown as ClipboardItemType;
    this.content = source.content;
    this.isPinned.set(source.isPinned);
    this.createdAt = source.createdAt;

    if (this.isPinned()) {
      this.pinnedAt = Date.now();
    }
  }

  togglePin() {
    this.isPinned.set(!this.isPinned());

    this.pinnedAt = Date.now();
  }
}
