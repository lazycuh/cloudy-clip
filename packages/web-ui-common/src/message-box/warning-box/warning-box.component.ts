import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

import { MessageBoxComponent } from '../message-box';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'warning-box'
  },
  imports: [MessageBoxComponent],
  selector: 'lc-warning-box',
  styleUrl: './warning-box.component.scss',
  templateUrl: './warning-box.component.html'
})
export class WarningBoxComponent {}
