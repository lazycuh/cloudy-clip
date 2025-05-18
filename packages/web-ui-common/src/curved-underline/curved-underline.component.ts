import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'curved-underline'
  },
  imports: [],
  selector: 'lc-curved-underline',
  styleUrl: './curved-underline.component.scss',
  templateUrl: './curved-underline.component.html'
})
export class CurvedUnderlineComponent {}
