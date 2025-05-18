import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'terms-of-service'
  },
  imports: [],
  selector: 'lc-terms-of-service',
  styleUrl: './terms-of-service.component.scss',
  templateUrl: './terms-of-service.component.html'
})
export class TermsOfServiceComponent {}
