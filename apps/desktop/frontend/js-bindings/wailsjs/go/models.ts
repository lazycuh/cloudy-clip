export namespace dto {
  export class ClipboardItem {
    id: string;
    type: 'TEXT' | 'IMAGE' | 'URL';
    content: string;
    createdAt: number;
    isPinned: boolean;
    pinnedAt: number;

    static createFrom(source: any = {}) {
      return new ClipboardItem(source);
    }

    constructor(source: any = {}) {
      if ('string' === typeof source) source = JSON.parse(source);
      this.id = source['id'];
      this.type = source['type'];
      this.content = source['content'];
      this.createdAt = source['createdAt'];
      this.isPinned = source['isPinned'];
      this.pinnedAt = source['pinnedAt'];
    }
  }
}
