import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { IconComponent } from '@lazycuh/web-ui-common/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'message-box'
  },
  imports: [IconComponent, ActionContainerComponent],
  selector: 'lc-message-box',
  styleUrl: './message-box.component.scss',
  templateUrl: './message-box.component.html'
})
export class MessageBoxComponent {}
