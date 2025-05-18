import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'focus-box'
  },
  imports: [],
  selector: 'lc-focus-box',
  styleUrl: './focus-box.component.scss',
  templateUrl: './focus-box.component.html'
})
export class FocusBoxComponent {}
