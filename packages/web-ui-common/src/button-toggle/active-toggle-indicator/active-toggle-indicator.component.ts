import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { executeUntil } from '@lazycuh/execute-until';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[style.transform]': '"translateX(" + _left() + "px)"',
    class: 'active-toggle-indicator'
  },
  selector: 'lc-active-toggle-indicator',
  styleUrls: ['./active-toggle-indicator.component.scss'],
  templateUrl: './active-toggle-indicator.component.html'
})
export class ActiveToggleIndicatorComponent {
  readonly activeToggle = input.required<HTMLElement | null | undefined>();

  protected readonly _left = signal(5);

  constructor() {
    afterNextRender({
      write: () => {
        void this._repositionActiveTabIndicator();
      }
    });

    effect(() => {
      void this._repositionActiveTabIndicator();
    });
  }

  private async _repositionActiveTabIndicator() {
    if (!this.activeToggle()) {
      return;
    }

    let toggleOffsetLeft = 0;

    await executeUntil(
      () => {
        toggleOffsetLeft = this.activeToggle()!.offsetLeft;

        return toggleOffsetLeft !== 0;
      },
      { delayMs: 32 }
    );

    /* istanbul ignore next -- @preserve */
    this._left.set(toggleOffsetLeft);
  }
}
