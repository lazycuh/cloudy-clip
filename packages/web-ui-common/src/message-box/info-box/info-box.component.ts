import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

import { MessageBoxComponent } from '../message-box';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'info-box'
  },
  imports: [MessageBoxComponent],
  selector: 'lc-info-box',
  styleUrl: './info-box.component.scss',
  templateUrl: './info-box.component.html'
})
export class InfoBoxComponent {}
