import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { BackdropComponent } from '../../backdrop';
import { fadeIn } from '../../effect/fade-in';

@Component({
  animations: [
    fadeIn({
      duration: '250ms',
      easingFunction: 'cubic-bezier(0.04, 0.54, 0.25, 1)',
      name: 'fade-in'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    '[class.hidden]': '_visible() === false',
    class: 'indeterminate-progress'
  },
  imports: [MatProgressBarModule, BackdropComponent],
  selector: 'lc-indeterminate-progress',
  styleUrls: ['./indeterminate-progress.component.scss'],
  templateUrl: './indeterminate-progress.component.html'
})
export class IndeterminateProgressComponent {
  protected readonly _visible = signal(false);

  show() {
    this._visible.set(true);
  }

  hide() {
    this._visible.set(false);
  }
}
