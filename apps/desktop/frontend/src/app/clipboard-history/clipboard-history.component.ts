import { DatePipe } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { NotificationService } from '@lazycuh/angular-notification';
import { TooltipDirective } from '@lazycuh/angular-tooltip';
import { Logger } from '@lazycuh/logging';
import { SearchBoxFormFieldComponent } from '@lazycuh/web-ui-common/form/search-box-form-field';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { TruncatedTextComponent } from '@lazycuh/web-ui-common/truncated-text';
import { isValidHyperlink } from '@lazycuh/web-ui-common/utils/is-valid-hyperlink';
import { GetLatestClipboardItem } from '@wails/bindings/App';
import { BrowserOpenURL, ClipboardSetText } from '@wails/runtime/runtime';

import { EmptyStateComponent } from './empty-state';
import { ClipboardItem } from './models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'clipboard-history'
  },
  imports: [
    SearchBoxFormFieldComponent,
    IconComponent,
    MatRipple,
    DatePipe,
    TooltipDirective,
    TruncatedTextComponent,
    EmptyStateComponent
  ],
  selector: 'lc-clipboard-history',
  styleUrl: './clipboard-history.component.scss',
  templateUrl: './clipboard-history.component.html'
})
export class ClipboardHistoryComponent {
  protected readonly _clipboardItems = signal<ClipboardItem[]>([]);

  private readonly _notificationService = inject(NotificationService);
  private readonly _confirmationCaptureService = inject(ConfirmationCaptureService);
  private readonly _logger = new Logger('ClipboardHistoryComponent');

  constructor() {
    afterNextRender({
      write: () => {
        void this._init();
      }
    });
  }

  private async _init() {
    await this._refreshClipboardHistory();

    setInterval(() => {
      void this._refreshClipboardHistory();
    }, 1000);
  }

  private async _refreshClipboardHistory() {
    const clipboardItem = await GetLatestClipboardItem();

    if (clipboardItem.Text !== '') {
      this._storeClipboardItem(
        new ClipboardItem(clipboardItem.Text, !isValidHyperlink(clipboardItem.Text) ? 'text' : 'url')
      );
    } else if (clipboardItem.Image !== '') {
      this._storeClipboardItem(new ClipboardItem(clipboardItem.Image, 'image'));
    }
  }

  private _storeClipboardItem(item: ClipboardItem) {
    this._clipboardItems.set([item, ...this._clipboardItems()]);

    this._sortClipboardItems();
  }

  protected async _onClearClipboardHistory() {
    const confirmed = await this._confirmationCaptureService.open({
      content: $localize`Are you sure you want to clear your clipboard history?`
    });

    if (confirmed) {
      this._clipboardItems.set([]);
    }
  }

  protected _onPinOrUnpinClipboardItem(item: ClipboardItem) {
    item.togglePin();

    this._sortClipboardItems();
  }

  private _sortClipboardItems() {
    this._clipboardItems.update(items => {
      return items.sort((a, b) => {
        if (!a.isPinned() && !b.isPinned()) {
          // if a is created before, then a's `createdAt` is less than b's `createdAt`
          // so we need to reverse the order
          // to make the latest created item on top
          return b.createdAt - a.createdAt;
        }

        if (a.isPinned() && !b.isPinned()) {
          return -1;
        }

        if (!a.isPinned() && b.isPinned()) {
          return 1;
        }

        return b.pinnedAt - a.pinnedAt;
      });
    });
  }

  protected async _onCopyClipboardItemToClipboard(item: ClipboardItem) {
    if (item.type !== 'image') {
      const copied = await ClipboardSetText(item.content);

      this._notificationService.open({
        content: copied ? $localize`Copied to clipboard` : $localize`Failed to copy to clipboard`
      });
    }
  }

  protected async _onDeleteClipboardItem(item: ClipboardItem) {
    const confirmed = await this._confirmationCaptureService.open({
      content: $localize`Are you sure you want to delete this clipboard item?`
    });

    if (confirmed) {
      this._clipboardItems.set(this._clipboardItems().filter(i => i.id !== item.id));
    }
  }

  protected _onSearchBoxValueChange(searchTerm: string) {
    this._clipboardItems.set(
      this._clipboardItems().filter(item => item.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  protected _onOpenClipboardItemAsLink(item: ClipboardItem) {
    BrowserOpenURL(item.content);
  }
}
