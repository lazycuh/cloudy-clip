import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';

import { ClickEventBubblingStopper } from '../utils/click-event-bubbling-stopper';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[style.display]': 'visible() ? "block": "none"',
    '[style.zIndex]': 'zIndex()',
    class: 'lc-backdrop'
  },
  selector: 'lc-backdrop',
  styleUrls: ['./backdrop.component.scss'],
  templateUrl: './backdrop.component.html'
})
export class BackdropComponent extends ClickEventBubblingStopper {
  readonly visible = input(false);
  readonly zIndex = input<string>();
}
