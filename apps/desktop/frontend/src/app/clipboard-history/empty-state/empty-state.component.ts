import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';

@Component({
  animations: [fadeIn({ duration: '0.5s' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'empty-state'
  },
  selector: 'lc-empty-state',
  styleUrl: './empty-state.component.scss',
  templateUrl: './empty-state.component.html'
})
export class EmptyStateComponent {}
