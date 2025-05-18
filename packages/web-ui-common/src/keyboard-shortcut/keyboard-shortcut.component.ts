import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from '@angular/core';

import { isAppleDevice } from '@lazycuh/web-ui-common/utils/is-apple-device';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class]': '_isAppleDevice ? "os--apple" : "os--windows"',
    class: 'keyboard-shortcut'
  },
  imports: [],
  selector: 'lc-keyboard-shortcut',
  styleUrl: './keyboard-shortcut.component.scss',
  templateUrl: './keyboard-shortcut.component.html'
})
export class KeyboardShortcutComponent {
  readonly keys = input<string[]>();
  readonly apple = input<string[]>();
  readonly windows = input<string[]>();

  protected readonly _isAppleDevice = isAppleDevice();

  protected readonly _keys = computed(() => {
    return this._getKeys().map(key => key.toLowerCase());
  });

  private _getKeys() {
    if (this._isAppleDevice) {
      return this.apple() ?? this.keys() ?? [];
    }

    return this.windows() ?? this.keys() ?? [];
  }

  protected _mapKey(key: string) {
    if (key === 'ctrl') {
      return isAppleDevice() ? '⌘' : key;
    } else if (key === 'alt') {
      return isAppleDevice() ? '⌥' : key;
    } else if (key === 'shift') {
      return isAppleDevice() ? '⇧' : key;
    }

    return key;
  }
}
