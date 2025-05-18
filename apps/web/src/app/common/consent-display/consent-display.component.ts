import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'consent-display'
  },
  selector: 'lc-consent-display',
  styleUrl: './consent-display.component.scss',
  templateUrl: './consent-display.component.html'
})
export class ConsentDisplayComponent {}
