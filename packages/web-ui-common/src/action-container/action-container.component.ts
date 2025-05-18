import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class]': '"layout--" + layout()',
    class: 'action-container'
  },
  imports: [],
  selector: 'lc-action-container',
  styleUrl: './action-container.component.scss',
  templateUrl: './action-container.component.html'
})
export class ActionContainerComponent {
  readonly layout = input<'row' | 'column'>('row');
}
