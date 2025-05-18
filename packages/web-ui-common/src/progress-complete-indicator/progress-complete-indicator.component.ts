import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.is-animated]': 'animated()',
    class: 'progress-complete-indicator'
  },
  imports: [],
  selector: 'lc-progress-complete-indicator',
  styleUrl: './progress-complete-indicator.component.scss',
  templateUrl: './progress-complete-indicator.component.html'
})
export class ProgressCompleteIndicatorComponent {
  readonly animated = input.required<boolean>();
  readonly success = input(true);

  protected readonly _diameter = 100;
  protected readonly _margin = 10;
  protected readonly _radius = (this._diameter - this._margin * 2) / 2;
}
